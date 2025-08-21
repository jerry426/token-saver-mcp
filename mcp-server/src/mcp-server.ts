#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { getToolByName, listAllTools } from './tools/index'
import { initializeVSCodeAdapter } from './vscode-adapter'
import { getGatewayClient } from './vscode-gateway-client'
import { registerAllTools } from './tools/index'

const GATEWAY_PORT = process.env.GATEWAY_PORT ? Number.parseInt(process.env.GATEWAY_PORT) : 9600

async function startStdioServer() {
  // First, check if the VSCode gateway is available
  const gateway = getGatewayClient(GATEWAY_PORT)

  console.error(`Checking VSCode Internals Gateway on port ${GATEWAY_PORT}...`)

  const maxRetries = 10
  let connected = false

  for (let i = 0; i < maxRetries; i++) {
    if (await gateway.checkHealth()) {
      connected = true
      console.error('✅ Connected to VSCode Internals Gateway')
      break
    }
    console.error(`Waiting for gateway... (${i + 1}/${maxRetries})`)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  if (!connected) {
    console.error('❌ Could not connect to VSCode Internals Gateway')
    console.error('Please ensure the VSCode Internals Gateway extension is installed and VSCode is running')
    process.exit(1)
  }

  // Initialize VSCode adapter with cached values
  await initializeVSCodeAdapter()
  console.error('🔧 VSCode adapter initialized')

  // Create MCP server
  const mcpServer = new McpServer({
    name: 'token-saver-mcp-stdio',
    version: '2.0.0',
  })

  // Register all tools with the MCP server
  await registerAllTools(mcpServer)
  
  const tools = listAllTools()
  console.error(`📦 Registered ${tools.length} tools across all categories`)
  console.error('Tools by category:')
  console.error('  - LSP: 13 tools')
  console.error('  - CDP: 8 tools')
  console.error('  - Helper: 5 tools')
  console.error('  - System: 4 tools')

  // Create stdio transport
  const transport = new StdioServerTransport()

  // Connect server to transport
  await mcpServer.connect(transport)
  
  console.error('🚀 Token Saver MCP (stdio) server started')
  console.error('Ready to accept connections via stdio')
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error)
  process.exit(1)
})

// Start the server
startStdioServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})