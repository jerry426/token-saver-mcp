import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import { Uri, window, workspace } from 'vscode'
import { logger } from '../utils'
import { cleanupBuffers } from './buffer-manager'
import { addLspTools } from './tools'

// Map to store transports by session ID with metadata
interface SessionInfo {
  transport: StreamableHTTPServerTransport
  createdAt: number
  lastActivity: number
}

const sessions: { [sessionId: string]: SessionInfo } = {}

// Session management constants
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000 // Check every 5 minutes
const SESSION_MAX_IDLE_TIME = 30 * 60 * 1000 // 30 minutes idle timeout
const SESSION_MAX_AGE = 2 * 60 * 60 * 1000 // 2 hours maximum age

// Cleanup dead sessions periodically
function cleanupDeadSessions() {
  const now = Date.now()
  for (const [sessionId, sessionInfo] of Object.entries(sessions)) {
    const age = now - sessionInfo.createdAt
    const idleTime = now - sessionInfo.lastActivity

    if (age > SESSION_MAX_AGE || idleTime > SESSION_MAX_IDLE_TIME) {
      logger.info(`Cleaning up inactive session: ${sessionId} (age: ${Math.round(age / 1000)}s, idle: ${Math.round(idleTime / 1000)}s)`)

      // Close the transport if it has a close method
      if (sessionInfo.transport.close) {
        sessionInfo.transport.close()
      }

      delete sessions[sessionId]
    }
  }
}

// Start cleanup timer
let cleanupTimer: NodeJS.Timeout | null = null

// Track the current port globally
let currentPort: number = 0

// Singleton server for sessionless mode
let singletonServer: McpServer | null = null
let singletonTransport: StreamableHTTPServerTransport | null = null

export async function startMcp() {
  const config = workspace.getConfiguration('lsp-mcp')
  const isMcpEnabled = config.get('enabled', true)

  if (!isMcpEnabled) {
    window.showInformationMessage('Token Saver MCP server is disabled by configuration.')
    return
  }

  // Default values
  let mcpPort = config.get('port', 9527)
  let maxRetries = config.get('maxRetries', 10)

  // Check for .lsp_mcp_port file in workspace root
  const workspaceFolder = workspace.workspaceFolders?.[0]
  if (workspaceFolder) {
    try {
      const portFile = Uri.joinPath(workspaceFolder.uri, '.lsp_mcp_port')
      const portContent = await workspace.fs.readFile(portFile)
      const fixedPort = Number.parseInt(new TextDecoder().decode(portContent).trim(), 10)

      if (!Number.isNaN(fixedPort) && fixedPort > 0 && fixedPort < 65536) {
        mcpPort = fixedPort
        maxRetries = 0 // Don't retry if using fixed port from file
        logger.info(`Using fixed port ${mcpPort} from .lsp_mcp_port file`)
      }
    }
    catch {
      // No .lsp_mcp_port file, use defaults
      logger.info(`No .lsp_mcp_port file found, using default port ${mcpPort}`)
    }
  }

  // Start session cleanup timer
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
  }
  cleanupTimer = setInterval(cleanupDeadSessions, SESSION_CLEANUP_INTERVAL)

  const app = express()
  app.use(express.json())

  // Endpoint to get current session (for reconnection)
  app.get('/session-info', (req, res) => {
    if (singletonTransport && singletonTransport.sessionId) {
      res.json({
        sessionId: singletonTransport.sessionId,
        mode: 'singleton',
        initialized: true,
      })
    }
    else {
      res.json({
        sessionId: null,
        mode: 'not-initialized',
        initialized: false,
      })
    }
  })

  // Endpoint to identify the workspace
  app.get('/workspace-info', async (req, res) => {
    const workspaceFolder = workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      res.status(404).json({ error: 'No workspace folder found' })
      return
    }

    // Try to read the workspace ID file
    let workspaceId: string | null = null
    try {
      const idFilePath = `${workspaceFolder.uri.fsPath}/.lsp_mcp_workspace_id`
      const fs = await import('node:fs/promises')
      workspaceId = (await fs.readFile(idFilePath, 'utf-8')).trim()
    }
    catch {
      // File doesn't exist or can't be read
      logger.info('No .lsp_mcp_workspace_id file found')
    }

    res.json({
      workspacePath: workspaceFolder.uri.fsPath,
      workspaceName: workspaceFolder.name,
      workspaceId: workspaceId || 'no-id-file',
      port: currentPort,
    })
  })

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    // Check for existing session ID (optional, for backwards compatibility)
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport: StreamableHTTPServerTransport

    // Option 1: Session ID provided and valid (backwards compatibility)
    if (sessionId && sessions[sessionId]) {
      // Reuse existing transport and update activity
      sessions[sessionId].lastActivity = Date.now()
      transport = sessions[sessionId].transport
    }
    // Option 2: Initialize request - create or reuse singleton
    else if (isInitializeRequest(req.body)) {
      // Use singleton for sessionless mode
      if (!singletonTransport || !singletonServer) {
        logger.info('Creating sessionless MCP server singleton')

        // Create transport without session management
        singletonTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => 'sessionless',
          onsessioninitialized: (actualSessionId) => {
            logger.info(`Sessionless MCP transport initialized with ID: ${actualSessionId}`)
            // Store the singleton session for reuse
            if (actualSessionId && singletonTransport) {
              sessions[actualSessionId] = {
                transport: singletonTransport,
                createdAt: Date.now(),
                lastActivity: Date.now(),
              }
            }
          },
          allowedHosts: ['127.0.0.1', 'localhost'],
        })

        singletonServer = new McpServer({
          name: 'lsp-server',
          version: '0.0.2',
        })

        // Add LSP tools to the server
        addLspTools(singletonServer)

        // Connect to the MCP server
        await singletonServer.connect(singletonTransport)
      }
      else {
        // Singleton already exists - return success response for initialize
        logger.info('Reusing existing singleton for initialize request - returning cached initialization')

        // Return a successful initialization response
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const initResponse = {
          jsonrpc: '2.0',
          id: (req.body as any).id || 1,
          result: {
            protocolVersion: '2025-01-05',
            capabilities: {
              tools: true,
            },
            serverInfo: {
              name: 'lsp-server',
              version: '0.0.2',
            },
          },
        }

        res.write(`event: message\ndata: ${JSON.stringify(initResponse)}\n\n`)
        res.end()
        return
      }
      transport = singletonTransport
    }
    // Option 3: Regular request without session - use singleton if available
    else if (!sessionId && singletonTransport) {
      // Sessionless mode - use singleton
      transport = singletonTransport
      // Add the session ID to the request headers for the transport
      if (singletonTransport.sessionId) {
        req.headers['mcp-session-id'] = singletonTransport.sessionId
      }
    }
    // Option 4: Session ID provided but invalid - try to use singleton as fallback
    else if (sessionId && !sessions[sessionId]) {
      if (singletonTransport) {
        // Fallback to singleton if session ID is invalid
        logger.warn(`Invalid session ID '${sessionId}' provided, falling back to singleton`)
        transport = singletonTransport
        // IMPORTANT: Replace the invalid session ID with the correct one
        // This allows the transport.handleRequest to work properly
        if (singletonTransport.sessionId) {
          req.headers['mcp-session-id'] = singletonTransport.sessionId
        }
      }
      else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Invalid session ID and no singleton available. Send initialize request first.',
          },
          id: null,
        })
        return
      }
    }
    // Option 5: No session and no singleton - need initialization
    else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Not initialized. Send initialize request first.',
        },
        id: null,
      })
      return
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body)
  })

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', handleSessionRequest)

  // Try to start server, handling port conflicts
  startServer(app, mcpPort, maxRetries)
}

// Try to start server, if port is occupied try other ports
function startServer(app: express.Express, initialPort: number, maxRetries: number) {
  currentPort = initialPort
  let retries = 0

  const tryListen = () => {
    const server = app.listen(currentPort, () => {
      window.showInformationMessage(`Token Saver MCP server started on port ${currentPort}`)
      logger.info(`MCP server running at http://127.0.0.1:${currentPort}/mcp`)
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && retries < maxRetries) {
        // Port in use, try next port
        retries++
        currentPort++
        window.showWarningMessage(`Port ${currentPort - 1} is in use, trying port ${currentPort}...`)
        tryListen()
      }
      else {
        window.showErrorMessage(`Failed to start Token Saver MCP server: ${err.message}`)
      }
    })
  }

  tryListen()
}

// Reusable handler for GET and DELETE requests
async function handleSessionRequest(req: express.Request, res: express.Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  // Update last activity
  sessions[sessionId].lastActivity = Date.now()

  const transport = sessions[sessionId].transport
  await transport.handleRequest(req, res)
}

// Export cleanup function for extension deactivation
export function stopMcp() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }

  // Clean up buffer manager
  cleanupBuffers()

  // Clean up singleton
  if (singletonTransport && singletonTransport.close) {
    singletonTransport.close()
  }
  singletonTransport = null
  singletonServer = null

  // Close all active sessions
  for (const sessionInfo of Object.values(sessions)) {
    if (sessionInfo.transport.close) {
      sessionInfo.transport.close()
    }
  }

  // Clear sessions
  Object.keys(sessions).forEach(key => delete sessions[key])
}
