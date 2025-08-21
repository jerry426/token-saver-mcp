import type { Server } from 'node:http'
import cors from 'cors'
import express from 'express'
import * as vscode from 'vscode'

let server: Server | undefined
let requestCounter = 0
const responseBuffers = new Map<string, any>()

// Commands that require workspace
const WORKSPACE_COMMANDS = [
  'workbench.action.tasks.runTask',
  'workbench.action.debug.start',
  'vscode.executeWorkspaceSymbolProvider',
]

// Commands that require active editor
const EDITOR_COMMANDS = [
  'editor.action.formatDocument',
  'editor.action.organizeImports',
  'vscode.executeDefinitionProvider',
  'vscode.executeHoverProvider',
]

export function activate(context: vscode.ExtensionContext) {
  const app = express()
  app.use(express.json({ limit: '50mb' }))
  app.use(cors())

  const outputChannel = vscode.window.createOutputChannel('VSCode Internals Gateway')

  // Request logging middleware
  app.use((req: express.Request & { id?: number, startTime?: number }, res: express.Response, next: express.NextFunction) => {
    req.id = ++requestCounter
    req.startTime = Date.now()

    outputChannel.appendLine(`[${req.id}] ${new Date().toISOString()} ${req.method} ${req.path}`)

    // Log response when finished
    const originalSend = res.send
    res.send = function (data: any) {
      const duration = req.startTime ? Date.now() - req.startTime : 0
      outputChannel.appendLine(`[${req.id}] Completed in ${duration}ms`)
      return originalSend.call(this, data)
    }

    next()
  })

  // Health check endpoint with enhanced info
  app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({
      status: 'healthy',
      version: '2.1.0',
      vscodeVersion: vscode.version,
      uptime: process.uptime(),
      requestsServed: requestCounter,
      workspace: vscode.workspace.name || 'No workspace',
      workspaceFolders: vscode.workspace.workspaceFolders?.length || 0,
      activeEditor: !!vscode.window.activeTextEditor,
      bufferedResponses: responseBuffers.size,
    })
  })

  // Universal command executor with robustness
  app.post('/execute-command', async (req: express.Request & { id?: number }, res: express.Response) => {
    const requestId = req.id

    try {
      const { command, args = [], timeout = 30000 } = req.body

      // Validate command
      if (!command || typeof command !== 'string') {
        outputChannel.appendLine(`[${requestId}] ERROR: Invalid command parameter`)
        return res.status(400).json({
          success: false,
          error: 'Invalid command parameter: must be a string',
          requestId,
        })
      }

      outputChannel.appendLine(`[${requestId}] Executing: ${command}`)

      // Check workspace requirement
      if (WORKSPACE_COMMANDS.some(cmd => command.includes(cmd))) {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'This command requires a workspace to be open',
            command,
            requestId,
          })
        }
      }

      // Check editor requirement
      if (EDITOR_COMMANDS.some(cmd => command.includes(cmd))) {
        if (!vscode.window.activeTextEditor) {
          return res.status(400).json({
            success: false,
            error: 'This command requires an active text editor',
            command,
            requestId,
          })
        }
      }

      // Process arguments - parse file URIs
      const processedArgs = args.map((arg: any) => {
        if (typeof arg === 'string' && arg.startsWith('file://')) {
          return vscode.Uri.parse(arg)
        }
        return arg
      })

      // Execute with timeout
      let timeoutHandle: NodeJS.Timeout | undefined

      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Command execution timeout after ${timeout}ms`))
        }, timeout)
      })

      const commandPromise = vscode.commands.executeCommand(command, ...processedArgs)

      try {
        const result = await Promise.race([commandPromise, timeoutPromise])

        if (timeoutHandle)
          clearTimeout(timeoutHandle)

        // Check response size
        const resultStr = JSON.stringify(result)

        if (resultStr.length > 1000000) { // 1MB threshold
          // Buffer large response
          const bufferId = `buffer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          responseBuffers.set(bufferId, result)

          // Auto-cleanup after 5 minutes
          setTimeout(() => {
            responseBuffers.delete(bufferId)
            outputChannel.appendLine(`[${requestId}] Buffer ${bufferId} expired`)
          }, 5 * 60 * 1000)

          outputChannel.appendLine(`[${requestId}] Large response buffered: ${bufferId} (${resultStr.length} bytes)`)

          res.json({
            success: true,
            buffered: true,
            bufferId,
            size: resultStr.length,
            message: 'Response too large, stored in buffer. Use /buffer/:id to retrieve.',
            requestId,
          })
        }
        else {
          res.json({
            success: true,
            result,
            requestId,
          })
        }
      }
      catch (timeoutError: any) {
        if (timeoutHandle)
          clearTimeout(timeoutHandle)
        outputChannel.appendLine(`[${requestId}] ERROR: ${timeoutError.message}`)
        res.status(408).json({
          success: false,
          error: timeoutError.message,
          requestId,
        })
      }
    }
    catch (error: any) {
      outputChannel.appendLine(`[${requestId}] ERROR: ${error.message}`)
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        requestId,
      })
    }
  })

  // Retrieve buffered responses
  app.get('/buffer/:id', (req: express.Request & { id?: number }, res: express.Response) => {
    const bufferId = req.params.id
    const requestId = req.id

    if (!responseBuffers.has(bufferId)) {
      outputChannel.appendLine(`[${requestId}] Buffer not found: ${bufferId}`)
      return res.status(404).json({
        success: false,
        error: 'Buffer not found or expired',
        bufferId,
        requestId,
      })
    }

    const data = responseBuffers.get(bufferId)
    responseBuffers.delete(bufferId) // One-time retrieval

    outputChannel.appendLine(`[${requestId}] Retrieved buffer: ${bufferId}`)
    res.json({
      success: true,
      result: data,
      bufferId,
      requestId,
    })
  })

  // Direct Language API access with validation
  app.post('/languages-api', async (req: express.Request & { id?: number }, res: express.Response) => {
    const requestId = req.id

    try {
      const { method, args = [] } = req.body

      if (!method || typeof method !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid method parameter',
          requestId,
        })
      }

      outputChannel.appendLine(`[${requestId}] Languages API: ${method}`)

      let result: any

      switch (method) {
        case 'getDiagnostics':
          result = args[0]
            ? vscode.languages.getDiagnostics(vscode.Uri.parse(args[0]))
            : vscode.languages.getDiagnostics()
          break

        case 'getLanguages':
          result = await vscode.languages.getLanguages()
          break

        case 'match':
          const [selector, document] = args
          result = vscode.languages.match(selector, document)
          break

        default:
          throw new Error(`Unknown languages API method: ${method}`)
      }

      res.json({
        success: true,
        result,
        requestId,
      })
    }
    catch (error: any) {
      outputChannel.appendLine(`[${requestId}] ERROR: ${error.message}`)
      res.status(500).json({
        success: false,
        error: error.message,
        requestId,
      })
    }
  })

  // Workspace API access with validation
  app.post('/workspace-api', async (req: express.Request & { id?: number }, res: express.Response) => {
    const requestId = req.id

    try {
      const { method, args = [] } = req.body

      if (!method || typeof method !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid method parameter',
          requestId,
        })
      }

      outputChannel.appendLine(`[${requestId}] Workspace API: ${method}`)

      // Check if workspace is available
      if (!vscode.workspace.workspaceFolders && method !== 'getConfiguration') {
        return res.status(400).json({
          success: false,
          error: 'No workspace open',
          method,
          requestId,
        })
      }

      let result: any

      switch (method) {
        case 'findFiles':
          result = await vscode.workspace.findFiles(args[0], args[1], args[2])
          break

        case 'findTextInFiles':
          // Handle the callback-based findTextInFiles API
          const [searchQuery, searchOptions = {}] = args
          const searchResults: any[] = []
          
          // Process include/exclude patterns
          const processedOptions: any = {
            maxResults: searchOptions.maxResults || 100,
          }
          
          // Handle include patterns
          if (searchOptions.include && vscode.workspace.workspaceFolders?.[0]) {
            const patterns = Array.isArray(searchOptions.include) 
              ? searchOptions.include 
              : [searchOptions.include]
            processedOptions.include = new vscode.RelativePattern(
              vscode.workspace.workspaceFolders[0],
              patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0]
            )
          }
          
          // Handle exclude patterns  
          if (searchOptions.exclude) {
            const patterns = Array.isArray(searchOptions.exclude)
              ? searchOptions.exclude
              : [searchOptions.exclude]
            processedOptions.exclude = patterns.length > 1 
              ? `{${patterns.join(',')}}` 
              : patterns[0]
          } else {
            // Default excludes
            processedOptions.exclude = '**/node_modules/**'
          }
          
          // Create a promise that collects all results
          await new Promise<void>((resolve, reject) => {
            try {
              // @ts-ignore - findTextInFiles may not be available in older VSCode versions
              if (!vscode.workspace.findTextInFiles) {
                resolve()
                return
              }
              
              // @ts-ignore
              vscode.workspace.findTextInFiles(
                searchQuery,
                processedOptions,
                (result: any) => {
                  // Callback is called for each result
                  if (result && result.uri && result.ranges) {
                    searchResults.push({
                      uri: result.uri.toString(),
                      ranges: result.ranges.map((r: any) => ({
                        start: { line: r.start.line, character: r.start.character },
                        end: { line: r.end.line, character: r.end.character },
                      })),
                      preview: result.preview?.text || '',
                    })
                  }
                },
                // Token for cancellation (not used here)
                undefined
              ).then(
                () => resolve(),
                (error: any) => reject(error)
              )
            } catch (error) {
              reject(error)
            }
          })
          
          result = searchResults
          break

        case 'openTextDocument':
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(args[0]))
          result = {
            uri: doc.uri.toString(),
            languageId: doc.languageId,
            version: doc.version,
            lineCount: doc.lineCount,
          }
          break

        case 'getConfiguration':
          result = vscode.workspace.getConfiguration(args[0]).get(args[1])
          break

        case 'getWorkspaceFolders':
          result = vscode.workspace.workspaceFolders?.map(f => ({
            uri: f.uri.toString(),
            name: f.name,
            index: f.index,
          }))
          break

        default:
          throw new Error(`Unknown workspace API method: ${method}`)
      }

      res.json({
        success: true,
        result,
        requestId,
      })
    }
    catch (error: any) {
      outputChannel.appendLine(`[${requestId}] ERROR: ${error.message}`)
      res.status(500).json({
        success: false,
        error: error.message,
        requestId,
      })
    }
  })

  // Window API access
  app.post('/window-api', async (req: express.Request & { id?: number }, res: express.Response) => {
    const requestId = req.id

    try {
      const { method, args = [] } = req.body

      if (!method || typeof method !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid method parameter',
          requestId,
        })
      }

      outputChannel.appendLine(`[${requestId}] Window API: ${method}`)

      let result: any

      switch (method) {
        case 'showInformationMessage':
          result = await vscode.window.showInformationMessage(args[0], ...args.slice(1))
          break

        case 'showErrorMessage':
          result = await vscode.window.showErrorMessage(args[0], ...args.slice(1))
          break

        case 'showWarningMessage':
          result = await vscode.window.showWarningMessage(args[0], ...args.slice(1))
          break

        case 'setStatusBarMessage':
          vscode.window.setStatusBarMessage(args[0], args[1])
          result = true
          break

        case 'getActiveTextEditor':
          const editor = vscode.window.activeTextEditor
          result = editor
            ? {
                document: {
                  uri: editor.document.uri.toString(),
                  languageId: editor.document.languageId,
                  lineCount: editor.document.lineCount,
                },
                selection: editor.selection,
                viewColumn: editor.viewColumn,
              }
            : null
          break

        default:
          throw new Error(`Unknown window API method: ${method}`)
      }

      res.json({
        success: true,
        result,
        requestId,
      })
    }
    catch (error: any) {
      outputChannel.appendLine(`[${requestId}] ERROR: ${error.message}`)
      res.status(500).json({
        success: false,
        error: error.message,
        requestId,
      })
    }
  })

  // Extension API access
  app.post('/extension-api', async (req: express.Request & { id?: number }, res: express.Response) => {
    const requestId = req.id

    try {
      const { method, args = [] } = req.body

      if (!method || typeof method !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid method parameter',
          requestId,
        })
      }

      outputChannel.appendLine(`[${requestId}] Extension API: ${method}`)

      let result: any

      switch (method) {
        case 'getExtension':
          const ext = vscode.extensions.getExtension(args[0])
          result = ext
            ? {
                id: ext.id,
                extensionPath: ext.extensionPath,
                isActive: ext.isActive,
                packageJSON: ext.packageJSON,
              }
            : null
          break

        case 'getAllExtensions':
          result = vscode.extensions.all.map(ext => ({
            id: ext.id,
            extensionPath: ext.extensionPath,
            isActive: ext.isActive,
            packageJSON: ext.packageJSON,
          }))
          break

        default:
          throw new Error(`Unknown extension API method: ${method}`)
      }

      res.json({
        success: true,
        result,
        requestId,
      })
    }
    catch (error: any) {
      outputChannel.appendLine(`[${requestId}] ERROR: ${error.message}`)
      res.status(500).json({
        success: false,
        error: error.message,
        requestId,
      })
    }
  })

  // Clear buffers endpoint
  app.post('/admin/clear-buffers', (req: express.Request & { id?: number }, res: express.Response) => {
    const requestId = req.id
    const count = responseBuffers.size
    responseBuffers.clear()

    outputChannel.appendLine(`[${requestId}] Cleared ${count} buffers`)
    res.json({
      success: true,
      message: `Cleared ${count} buffers`,
      requestId,
    })
  })

  // List buffers endpoint
  app.get('/admin/buffers', (req: express.Request & { id?: number }, res: express.Response) => {
    const requestId = req.id
    const buffers = Array.from(responseBuffers.keys()).map(id => ({
      id,
      size: JSON.stringify(responseBuffers.get(id)).length,
    }))

    res.json({
      success: true,
      buffers,
      count: buffers.length,
      requestId,
    })
  })

  // Start server with retry logic and better error handling
  // Check for port override file first
  let startPort = 9600 // Default port
  
  if (vscode.workspace.workspaceFolders?.[0]) {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath
    const portFile = require('path').join(workspaceRoot, '.vscode_gateway_port')
    
    try {
      const fs = require('fs')
      if (fs.existsSync(portFile)) {
        const fileContent = fs.readFileSync(portFile, 'utf8').trim()
        const filePort = parseInt(fileContent)
        if (!isNaN(filePort) && filePort > 0 && filePort < 65536) {
          startPort = filePort
          outputChannel.appendLine(`Using port ${startPort} from .vscode_gateway_port file`)
        } else {
          outputChannel.appendLine(`Invalid port in .vscode_gateway_port file: ${fileContent}, using default ${startPort}`)
        }
      }
    } catch (error: any) {
      outputChannel.appendLine(`Error reading .vscode_gateway_port file: ${error.message}, using default ${startPort}`)
    }
  }
  
  const maxRetries = 10

  let currentPort = startPort
  let retries = 0

  const tryListen = () => {
    server = app.listen(currentPort, '127.0.0.1', () => {
      outputChannel.appendLine(`VSCode Internals Gateway listening on port ${currentPort}`)
      outputChannel.show(true)
      
      // Write the actual port back to .vscode_gateway_port file for MCP server coordination
      if (vscode.workspace.workspaceFolders?.[0]) {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath
        const portFile = require('path').join(workspaceRoot, '.vscode_gateway_port')
        
        try {
          const fs = require('fs')
          fs.writeFileSync(portFile, currentPort.toString())
          outputChannel.appendLine(`Updated .vscode_gateway_port with actual port: ${currentPort}`)
        } catch (error: any) {
          outputChannel.appendLine(`Warning: Could not write .vscode_gateway_port file: ${error.message}`)
        }
      }

      // Show status message with context about port selection
      const portMessage = currentPort === startPort 
        ? `VSCode Internals Gateway started on port ${currentPort}`
        : `VSCode Internals Gateway started on port ${currentPort} (auto-selected due to conflict)`
        
      vscode.window.showInformationMessage(portMessage)

      // Store the actual port in global state
      context.globalState.update('gatewayPort', currentPort)
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && retries < maxRetries) {
        retries++
        currentPort++
        outputChannel.appendLine(`Port ${currentPort - 1} in use, trying ${currentPort}...`)
        setTimeout(tryListen, 100)
      }
      else {
        outputChannel.appendLine(`Failed to start: ${err.message}`)
        vscode.window.showErrorMessage(`Failed to start VSCode Internals Gateway: ${err.message}`)
      }
    })

    // Handle server crashes
    if (server) {
      server.on('close', () => {
        outputChannel.appendLine('Server closed unexpectedly')
        if (context.subscriptions.length > 0) { // Still active
          outputChannel.appendLine('Attempting to restart...')
          setTimeout(tryListen, 1000)
        }
      })
    }
  }

  tryListen()

  // Register commands
  const showPortCommand = vscode.commands.registerCommand('vscode-internals-gateway.showPort', () => {
    vscode.window.showInformationMessage(`VSCode Internals Gateway is running on port ${currentPort}`)
  })

  const showLogsCommand = vscode.commands.registerCommand('vscode-internals-gateway.showLogs', () => {
    outputChannel.show()
  })

  const restartCommand = vscode.commands.registerCommand('vscode-internals-gateway.restart', () => {
    outputChannel.appendLine('Manual restart requested')
    if (server) {
      server.close(() => {
        tryListen()
      })
    }
  })

  context.subscriptions.push(showPortCommand, showLogsCommand, restartCommand)
}

export function deactivate() {
  if (server) {
    server.close()
  }
  responseBuffers.clear()
}
