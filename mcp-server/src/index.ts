import fs from 'node:fs'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import cors from 'cors'
import express from 'express'
import { handleHttpMcpRequest } from './mcp-http'
import { dashboardClients, getMetricsData, metrics, trackError, trackToolCall } from './metrics'
import { getAllToolMetadata, getToolHandler, getToolsByCategory, listAllTools, registerAllTools } from './tools/index'
import { initializeVSCodeAdapter } from './vscode-adapter'
import { getGatewayClient } from './vscode-gateway-client'

// Read MCP port from file if it exists, otherwise use environment or default
function getMcpPort(): number {
  // First check environment variable
  if (process.env.MCP_PORT) {
    return Number.parseInt(process.env.MCP_PORT)
  }

  // Try to read from .mcp_server_port file
  try {
    const portFilePath = path.join(process.cwd(), '..', '.mcp_server_port')
    const portContent = fs.readFileSync(portFilePath, 'utf-8').trim()
    const port = Number.parseInt(portContent)
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      console.log(`📁 Read MCP port ${port} from .mcp_server_port file`)
      return port
    }
  }
  catch (error) {
    // File doesn't exist or can't be read, use default
  }

  // Default port
  return 9700
}

function getGatewayPort(): number {
  // Priority order:
  // 1. .vscode_gateway_port file (set by VSCode extension)
  // 2. GATEWAY_PORT environment variable
  // 3. Default 9600

  try {
    // Using dynamic imports in sync function
    // eslint-disable-next-line ts/no-require-imports
    const fs = require('node:fs')
    // eslint-disable-next-line ts/no-require-imports
    const path = require('node:path')
    const portFile = path.join('..', '.vscode_gateway_port')

    if (fs.existsSync(portFile)) {
      const fileContent = fs.readFileSync(portFile, 'utf8').trim()
      const filePort = Number.parseInt(fileContent)
      if (!Number.isNaN(filePort) && filePort > 0 && filePort < 65536) {
        console.log(`🔍 Using VSCode Gateway port ${filePort} from .vscode_gateway_port file`)
        return filePort
      }
      else {
        console.warn(`⚠️  Invalid port in .vscode_gateway_port file: ${fileContent}`)
      }
    }
  }
  catch (error: any) {
    console.warn(`⚠️  Error reading .vscode_gateway_port file: ${error.message}`)
  }

  // Fallback to environment variable
  if (process.env.GATEWAY_PORT) {
    const envPort = Number.parseInt(process.env.GATEWAY_PORT)
    if (!Number.isNaN(envPort)) {
      console.log(`🔍 Using VSCode Gateway port ${envPort} from GATEWAY_PORT environment variable`)
      return envPort
    }
  }

  // Default fallback
  console.log(`🔍 Using default VSCode Gateway port 9600`)
  return 9600
}

const GATEWAY_PORT = getGatewayPort()
const MCP_PORT = getMcpPort()

// Session management for MCP protocol
interface SessionInfo {
  transport: StreamableHTTPServerTransport
  createdAt: number
  lastActivity: number
}

const sessions: { [sessionId: string]: SessionInfo } = {}

// Singleton server for sessionless mode
let singletonServer: McpServer | null = null
let singletonTransport: (StreamableHTTPServerTransport & { sessionId?: string }) | null = null

// Export the singleton server for use in other modules
export function getSingletonServer(): McpServer | null {
  return singletonServer
}

async function startServer() {
  // First, check if the VSCode gateway is available
  const gateway = getGatewayClient(GATEWAY_PORT)

  console.warn(`Checking VSCode Internals Gateway on port ${GATEWAY_PORT}...`)

  const maxRetries = 10
  let connected = false

  for (let i = 0; i < maxRetries; i++) {
    if (await gateway.checkHealth()) {
      connected = true
      console.warn('✅ Connected to VSCode Internals Gateway')
      break
    }
    console.warn(`Waiting for gateway... (${i + 1}/${maxRetries})`)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  if (!connected) {
    console.error('❌ Could not connect to VSCode Internals Gateway')
    console.error('Please ensure the VSCode Internals Gateway extension is installed and VSCode is running')
    process.exit(1)
  }

  // Initialize VSCode adapter with cached values
  await initializeVSCodeAdapter()
  console.warn('🔧 VSCode adapter initialized')

  // Create Express app for REST API
  const app = express()
  app.use(cors())

  // Add request logging to debug Claude connection attempts
  app.use((req, res, next) => {
    if (req.path === '/mcp') {
      console.log(`[MCP Request] ${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip}`)
      console.log(`[MCP Headers] ${JSON.stringify(req.headers)}`)
    }
    next()
  })

  app.use(express.json({ limit: '50mb' }))

  // Serve static files (memory viewer)
  app.use('/static', express.static(path.join(__dirname, 'static')))

  // Memory viewer page
  app.get('/memory-viewer', (_req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'memory-viewer.html'))
  })

  // Direct memory API for viewer with pagination and filtering
  app.get('/api/memories', (req, res) => {
    try {
      const { memoryDb } = require('./db/memory-db')
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const offset = (page - 1) * limit
      
      const search = req.query.search as string || ''
      const scope = req.query.scope as string || ''
      const importance = req.query.importance as string || ''
      const dateFrom = req.query.dateFrom as string || ''
      const dateTo = req.query.dateTo as string || ''
      const sortBy = req.query.sortBy as string || 'updated_at'
      const sortOrder = req.query.sortOrder as string || 'DESC'
      
      // Build query
      let query = 'SELECT * FROM memories WHERE 1=1'
      let countQuery = 'SELECT COUNT(*) as total FROM memories WHERE 1=1'
      const params: any[] = []
      const countParams: any[] = []
      
      if (search) {
        query += ' AND (key LIKE ? OR value LIKE ? OR markdown LIKE ?)'
        countQuery += ' AND (key LIKE ? OR value LIKE ? OR markdown LIKE ?)'
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern)
        countParams.push(searchPattern, searchPattern, searchPattern)
      }
      
      if (scope) {
        query += ' AND scope = ?'
        countQuery += ' AND scope = ?'
        params.push(scope)
        countParams.push(scope)
      }
      
      if (importance) {
        query += ' AND importance = ?'
        countQuery += ' AND importance = ?'
        params.push(importance)
        countParams.push(importance)
      }
      
      if (dateFrom) {
        query += ' AND updated_at >= ?'
        countQuery += ' AND updated_at >= ?'
        params.push(dateFrom)
        countParams.push(dateFrom)
      }
      
      if (dateTo) {
        query += ' AND updated_at <= ?'
        countQuery += ' AND updated_at <= ?'
        params.push(dateTo)
        countParams.push(dateTo)
      }
      
      // Add sorting
      const validSortColumns = ['updated_at', 'created_at', 'access_count', 'importance', 'key']
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'updated_at'
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      query += ` ORDER BY ${sortColumn} ${order}`
      
      // Add pagination
      query += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
      
      // Execute queries
      const totalResult = memoryDb.db.prepare(countQuery).get(...countParams) as { total: number }
      const memories = memoryDb.db.prepare(query).all(...params)
      
      res.json({
        success: true,
        memories,
        pagination: {
          page,
          limit,
          total: totalResult.total,
          totalPages: Math.ceil(totalResult.total / limit)
        }
      })
    } catch (error: any) {
      res.json({ success: false, error: error.message })
    }
  })

  // Memory count endpoint for notification system
  app.get('/api/memories/count', (_req, res) => {
    try {
      const { memoryDb } = require('./db/memory-db')
      const result = memoryDb.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }
      res.json({ 
        success: true, 
        count: result.count,
        timestamp: new Date().toISOString()
      })
    } catch (error: any) {
      res.json({ success: false, error: error.message, count: 0 })
    }
  })

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      gateway: 'connected',
      port: MCP_PORT,
    })
  })

  // Dashboard endpoint - serve HTML file
  app.get('/dashboard', (_req, res) => {
    const dashboardPath = path.join(__dirname, '..', 'dashboard.html')
    res.sendFile(dashboardPath)
  })

  // Metrics endpoint
  app.get('/metrics', (_req, res) => {
    res.json(getMetricsData())
  })

  // Workspace info endpoint
  app.get('/workspace-info', async (_req, res) => {
    try {
      const gatewayClient = getGatewayClient()
      const workspaceInfo = await gatewayClient.executeCommand('vscode.workspace.workspaceFolders')
      const path = workspaceInfo?.[0]?.uri?.fsPath || process.cwd()
      res.json({
        workspacePath: path,
        port: MCP_PORT,
      })
    }
    catch (error) {
      res.json({
        workspacePath: process.cwd(),
        port: MCP_PORT,
      })
    }
  })

  // Available tools endpoint
  app.get('/available-tools', (_req, res) => {
    // Get all tools from the modular system
    const modularTools = getAllToolMetadata()

    // Get metrics data which includes tool usage
    const metricsData = getMetricsData()

    // Group by category and add call counts
    const tools = modularTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category, // Keep original category
      displayCategory: tool.category === 'helper' ? 'cdp' : tool.category, // Helper tools are CDP-related
      callCount: metrics.toolUsage.get(tool.name) || 0,
    }))

    res.json({
      tools,
      totalTokensSaved: metricsData.totalTokensSaved,
    })
  })

  // SSE endpoint for real-time dashboard updates
  app.get('/dashboard-events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Add client to the set
    dashboardClients.add(res)

    // Send initial data
    res.write(`data: ${JSON.stringify(getMetricsData())}\n\n`)

    // Clean up on disconnect
    req.on('close', () => {
      dashboardClients.delete(res)
    })
  })

  // Simple REST endpoint for tools
  app.post('/mcp/simple', async (req, res) => {
    try {
      const { method, params } = req.body

      if (method === 'tools/list') {
        const tools = listAllTools()
        res.json({
          tools,
          count: tools.length,
          categories: getToolsByCategory(),
        })
        return
      }

      if (method === 'tools/call') {
        const { name, arguments: args } = params

        const handler = getToolHandler(name)
        if (!handler) {
          res.status(404).json({ error: `Tool not found: ${name}` })
          return
        }

        try {
          // Track timing
          const startTime = Date.now()

          // Call the tool handler with the arguments
          const result = await handler(args)

          // Track successful call
          const responseTime = Date.now() - startTime
          trackToolCall(name, responseTime)

          res.json({ success: true, result })
        }
        catch (toolError: any) {
          console.error(`Error executing tool ${name}:`, toolError)

          // Track error
          trackError(name)

          res.status(500).json({
            error: toolError.message,
            tool: name,
          })
        }
        return
      }

      res.status(400).json({ error: `Unknown method: ${method}` })
    }
    catch (error: any) {
      console.error('Error handling request:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // MCP Protocol endpoint (non-streaming HTTP) for Claude
  // MUST be /mcp per Anthropic documentation
  app.post('/mcp', handleHttpMcpRequest)

  // Shared handler for streaming MCP requests
  const handleStreamingMcpRequest = async (req: express.Request, res: express.Response) => {
    try {
      // Check for existing session ID (optional, for backwards compatibility)
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      let transport: StreamableHTTPServerTransport

      // Option 1: Session ID provided and valid
      if (sessionId && sessions[sessionId]) {
        sessions[sessionId].lastActivity = Date.now()
        transport = sessions[sessionId].transport
      }
      // Option 2: Initialize request - create or reuse singleton
      else if (isInitializeRequest(req.body)) {
        console.warn('Detected initialize request:', JSON.stringify(req.body))
        // Use singleton for sessionless mode
        if (!singletonTransport || !singletonServer) {
          console.warn('Creating new MCP singleton server')

          // Create transport without session management
          singletonTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => 'sessionless',
            onsessioninitialized: (actualSessionId) => {
              console.warn(`Sessionless MCP transport initialized with ID: ${actualSessionId}`)
              // Store the singleton session for reuse
              if (actualSessionId && singletonTransport) {
                // Store sessionId on transport for later reference
                singletonTransport.sessionId = actualSessionId
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
            name: 'token-saver-mcp',
            version: '2.0.0',
          })

          // Register all tools with the MCP server
          await registerAllTools(singletonServer)

          // Connect to the MCP server
          await singletonServer.connect(singletonTransport)
        }
        else {
          // Singleton already exists - return cached initialization
          console.warn('Reusing existing singleton for initialize request')

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
                name: 'token-saver-mcp',
                version: '2.0.0',
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
          console.warn(`Invalid session ID '${sessionId}' provided, falling back to singleton`)
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

      // Handle the request through the transport
      await transport.handleRequest(req, res, req.body)
    }
    catch (error: any) {
      console.error('Error handling MCP request:', error)
      res.status(500).json({ error: error.message })
    }
  }

  // MCP Protocol endpoint for Gemini (streaming)
  app.post('/mcp-gemini', handleStreamingMcpRequest)

  // MCP Protocol endpoint (streaming) - MOVED to avoid conflicts
  app.post('/mcp-streaming', handleStreamingMcpRequest)

  // Start Express server (always runs, even in stdio mode)
  // Explicitly bind to IPv4 127.0.0.1 to avoid IPv6 issues
  const server = app.listen(MCP_PORT, '127.0.0.1', () => {
    console.log(`
🚀 Token Saver MCP Server running on 127.0.0.1:${MCP_PORT}`)
    console.log(`   MCP Protocol: http://127.0.0.1:${MCP_PORT}/mcp (for Claude Code)`)
    console.log(`   REST API: http://localhost:${MCP_PORT}/mcp/simple`)
    console.log(`   📊 Dashboard: http://localhost:${MCP_PORT}/dashboard`)
    console.log(`   Gateway: Connected to VSCode on port ${GATEWAY_PORT}`)
    console.log(`   Tools: All ${getAllToolMetadata().length} tools loaded successfully`)
    console.log(`
📝 Development mode: Changes will hot-reload automatically`)
  })

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${MCP_PORT} is already in use`)
      process.exit(1)
    }
    else {
      console.error(`Server error:`, err)
      process.exit(1)
    }
  })
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
