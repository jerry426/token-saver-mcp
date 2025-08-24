import type { Request, Response } from 'express'
import { trackError, trackToolCall } from './metrics'
import { getAllToolMetadata, getToolHandler } from './tools/index'

// Handle HTTP MCP requests (non-streaming)
export async function handleHttpMcpRequest(req: Request, res: Response) {
  try {
    const { method, params, id } = req.body

    // Handle different MCP methods
    switch (method) {
      case 'initialize': {
        const result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'token-saver-mcp',
            version: '2.0.0',
          },
        }

        res.json({
          jsonrpc: '2.0',
          id,
          result,
        })
        break
      }

      case 'initialized': {
        // Client is ready, just acknowledge
        res.json({
          jsonrpc: '2.0',
          id,
          result: {},
        })
        break
      }

      case 'tools/list': {
        // Get all registered tools from the modular system
        const modularMetadata = getAllToolMetadata()

        // Convert to MCP format with inputSchema
        const tools = modularMetadata.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        }))

        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools,
          },
        })
        break
      }

      case 'tools/call': {
        // Call a specific tool
        const { name, arguments: args } = params

        // Debug logging for Claude Code integration
        console.log(`[MCP Debug] Tool: ${name}`)
        console.log(`[MCP Debug] Raw arguments:`, JSON.stringify(args))
        console.log(`[MCP Debug] Arguments type:`, typeof args)

        // Handle Claude Code's wrapped arguments format
        let actualArgs = args
        if (args && typeof args === 'object' && 'properties' in args) {
          // Claude Code wraps arguments in a "properties" field as a JSON string
          try {
            actualArgs = typeof args.properties === 'string'
              ? JSON.parse(args.properties)
              : args.properties
            console.log(`[MCP Debug] Unwrapped arguments:`, JSON.stringify(actualArgs))
          }
          catch (e) {
            console.error(`[MCP Debug] Failed to parse properties:`, e)
          }
        }

        // Get the tool handler from the modular system
        const handler = getToolHandler(name)

        if (!handler) {
          res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: `Tool not found: ${name}`,
            },
          })
          trackError(name)
          return
        }

        try {
          const startTime = Date.now()
          // Execute the tool handler with unwrapped arguments
          const result = await handler(actualArgs)

          // Track metrics
          const responseTime = Date.now() - startTime
          trackToolCall(name, responseTime)

          // Return MCP-formatted response
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            },
          })
        }
        catch (error: any) {
          trackError(name)
          res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: error.message,
            },
          })
        }
        break
      }

      default: {
        res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        })
      }
    }
  }
  catch (error: any) {
    console.error('MCP HTTP error:', error)
    res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message,
      },
    })
  }
}
