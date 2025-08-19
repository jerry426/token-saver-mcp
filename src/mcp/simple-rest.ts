import type { Express } from 'express'
import { getCallHierarchy } from '../lsp/call-hierarchy'
import { getCodeActions } from '../lsp/code-actions'
import { getCompletions } from '../lsp/completion'
import { getDefinition } from '../lsp/definition'
import { getDiagnostics } from '../lsp/diagnostics'
import { getDocumentSymbols } from '../lsp/document-symbols'
import { getHover } from '../lsp/hover'
import { getImplementations } from '../lsp/implementations'
import { getReferences } from '../lsp/references'
import { rename } from '../lsp/rename'
import { getSemanticTokens } from '../lsp/semantic-tokens'
import { getSupportedLanguages } from '../lsp/supported-languages'
import { searchText } from '../lsp/text-search'
import { getTypeDefinition } from '../lsp/type-definition'
import { logger } from '../utils'
import { addBrowserHelpers } from './browser-helpers'
import { addBrowserTools } from './browser-tools'
import { bufferResponse, getBufferStats, retrieveBuffer } from './buffer-manager'

// Token savings estimates (same as in tools.ts)
const TOKEN_SAVINGS_ESTIMATES: Record<string, number> = {
  get_hover: 500,
  get_completions: 1500,
  get_definition: 2000,
  get_type_definition: 2000,
  get_references: 5000,
  find_implementations: 4000,
  get_document_symbols: 3000,
  get_call_hierarchy: 3500,
  rename_symbol: 10000,
  get_code_actions: 1000,
  get_diagnostics: 2000,
  get_semantic_tokens: 1000,
  search_text: 5000,
  retrieve_buffer: 0,
  get_buffer_stats: 0,
  get_instructions: 0,
  get_supported_languages: 100,
  // CDP tools
  execute_in_browser: 500,
  navigate_browser: 200,
  click_element: 300,
  type_in_browser: 300,
  get_browser_console: 1000,
  get_dom_snapshot: 2000,
  take_screenshot: 1000,
  wait_for_element: 200,
  test_react_component: 3000,
  test_api_endpoint: 2000,
  test_form_validation: 2500,
  check_page_performance: 3000,
  debug_javascript_error: 4000,
}

// Tool registry for direct execution
const toolRegistry: Record<string, (args: any) => Promise<any>> = {
  // LSP tools
  get_completions: async ({ uri, line, character }) => {
    const result = await getCompletions(uri, line, character)
    return bufferResponse('get_completions', result)
  },
  get_definition: async ({ uri, line, character }) => {
    return await getDefinition(uri, line, character)
  },
  get_type_definition: async ({ uri, line, character }) => {
    return await getTypeDefinition(uri, line, character)
  },
  get_references: async ({ uri, line, character }) => {
    return await getReferences(uri, line, character)
  },
  find_implementations: async ({ uri, line, character }) => {
    return await getImplementations(uri, line, character)
  },
  get_hover: async ({ uri, line, character }) => {
    return await getHover(uri, line, character)
  },
  get_document_symbols: async ({ uri }) => {
    const result = await getDocumentSymbols(uri)
    return bufferResponse('get_document_symbols', result)
  },
  get_call_hierarchy: async ({ uri, line, character, direction }) => {
    const result = await getCallHierarchy(uri, line, character, direction)
    return bufferResponse('get_call_hierarchy', result)
  },
  rename_symbol: async ({ uri, line, character, newName }) => {
    return await rename(uri, line, character, newName)
  },
  get_code_actions: async ({ uri, line, character }) => {
    return await getCodeActions(uri, line, character)
  },
  get_diagnostics: async ({ uri }) => {
    const result = await getDiagnostics(uri)
    return bufferResponse('get_diagnostics', result)
  },
  get_semantic_tokens: async ({ uri }) => {
    const result = await getSemanticTokens(uri)
    return bufferResponse('get_semantic_tokens', result)
  },
  search_text: async (args) => {
    const { query, ...options } = args
    const result = await searchText(query, options)
    return bufferResponse('search_text', result)
  },
  // System tools
  retrieve_buffer: async ({ bufferId }) => {
    return retrieveBuffer(bufferId)
  },
  get_buffer_stats: async () => {
    return getBufferStats()
  },
  get_instructions: async () => {
    return await getInstructions()
  },
  get_supported_languages: async () => {
    return getSupportedLanguages()
  },
}

// Get instructions for using the tools
async function getInstructions(): Promise<string> {
  try {
    const { workspace, Uri, extensions } = await import('vscode')

    // Get the Token Saver MCP extension
    const extension = extensions.getExtension('jerry426.token-saver-mcp')
    if (!extension) {
      return 'Error: Token Saver MCP extension not found'
    }

    // Read README_USAGE_GUIDE.md from root directory
    const extensionPath = Uri.file(extension.extensionPath)
    const instructionsPath = Uri.joinPath(extensionPath, 'README_USAGE_GUIDE.md')

    const fileContent = await workspace.fs.readFile(instructionsPath)
    const instructions = new TextDecoder().decode(fileContent)

    logger.info('Returned AI instructions from README_USAGE_GUIDE.md (REST endpoint)')
    return instructions
  }
  catch (error) {
    logger.error('Failed to read README_USAGE_GUIDE.md from REST endpoint', error)

    // Return a fallback minimal instructions
    return `# Token Saver MCP - AI Instructions
Error: Could not read README_USAGE_GUIDE.md from extension directory.
Please ensure Token Saver MCP is properly installed.

For documentation, visit: https://github.com/jerry426/token-saver-mcp`
  }
}

// Helper function to create self-describing responses
function createSelfDescribingResponse(toolName: string, result: any): any {
  // Determine result type and create human-readable summary
  let resultType = 'unknown'
  let resultCount = 0
  let humanReadable = ''

  // Handle different tool response patterns
  if (Array.isArray(result)) {
    resultType = 'array'
    resultCount = result.length

    // Tool-specific summaries
    switch (toolName) {
      case 'get_definition':
      case 'get_type_definition':
        resultType = 'locations'
        humanReadable = resultCount === 0
          ? 'No definitions found'
          : resultCount === 1
            ? `Definition found at line ${result[0].range?.start?.line + 1} in ${result[0].uri?.split('/').pop()}`
            : `Found ${resultCount} definitions`
        break

      case 'get_references':
        resultType = 'locations'
        humanReadable = resultCount === 0
          ? 'No references found'
          : `Found ${resultCount} reference${resultCount !== 1 ? 's' : ''}`
        break

      case 'find_implementations':
        resultType = 'locations'
        humanReadable = resultCount === 0
          ? 'No implementations found'
          : `Found ${resultCount} implementation${resultCount !== 1 ? 's' : ''}`
        break

      case 'get_hover':
        resultType = 'hover'
        humanReadable = result[0]?.contents?.[0]?.value
          ? 'Hover information available'
          : 'No hover information'
        break

      case 'get_completions':
        resultType = 'completions'
        humanReadable = `Found ${resultCount} completion suggestion${resultCount !== 1 ? 's' : ''}`
        break

      case 'get_document_symbols':
        resultType = 'symbols'
        humanReadable = `Found ${resultCount} symbol${resultCount !== 1 ? 's' : ''} in document`
        break

      case 'get_code_actions':
        resultType = 'codeActions'
        humanReadable = resultCount === 0
          ? 'No code actions available'
          : `Found ${resultCount} code action${resultCount !== 1 ? 's' : ''}`
        break

      case 'get_diagnostics':
        resultType = 'diagnostics'
        humanReadable = resultCount === 0
          ? 'No diagnostics found'
          : `Found ${resultCount} diagnostic${resultCount !== 1 ? 's' : ''}`
        break

      case 'search_text':
        resultType = 'searchResults'
        humanReadable = resultCount === 0
          ? 'No matches found'
          : `Found matches in ${resultCount} file${resultCount !== 1 ? 's' : ''}`
        break

      case 'get_call_hierarchy':
        resultType = 'callHierarchy'
        humanReadable = `Found ${resultCount} call${resultCount !== 1 ? 's' : ''}`
        break

      // Browser tools
      case 'get_browser_console':
        resultType = 'consoleMessages'
        humanReadable = resultCount === 0
          ? 'No console messages'
          : `Found ${resultCount} console message${resultCount !== 1 ? 's' : ''}`
        break

      default:
        humanReadable = `Returned ${resultCount} item${resultCount !== 1 ? 's' : ''}`
    }
  }
  else if (result && typeof result === 'object') {
    // Handle object responses
    if (result.bufferId) {
      resultType = 'buffered'
      resultCount = 1
      humanReadable = `Response buffered (ID: ${result.bufferId}). Use retrieve_buffer to get full data.`
    }
    else if (result.edit || result.documentChanges) {
      resultType = 'workspaceEdit'
      const editCount = result.edit?.changes ? Object.keys(result.edit.changes).length : 0
      resultCount = editCount
      humanReadable = editCount === 0
        ? 'No edits required'
        : `Would modify ${editCount} file${editCount !== 1 ? 's' : ''}`
    }
    else if (toolName === 'get_buffer_stats') {
      resultType = 'stats'
      resultCount = 1
      humanReadable = `${result.activeBuffers || 0} active buffer${result.activeBuffers !== 1 ? 's' : ''}, ${result.totalSize || 0} bytes total`
    }
    else if (toolName === 'get_supported_languages') {
      resultType = 'languages'
      resultCount = result.totalCount || 0
      humanReadable = `${resultCount} language${resultCount !== 1 ? 's' : ''} supported`
    }
    else if (toolName === 'get_semantic_tokens') {
      resultType = 'semanticTokens'
      resultCount = result.data?.length || 0
      humanReadable = `${resultCount} semantic token${resultCount !== 1 ? 's' : ''} found`
    }
    else if (toolName === 'get_dom_snapshot') {
      resultType = 'domSnapshot'
      resultCount = 1
      humanReadable = `DOM snapshot captured (${result.forms?.length || 0} forms, ${result.links?.length || 0} links, ${result.images?.length || 0} images)`
    }
    else if (toolName === 'take_screenshot') {
      resultType = 'screenshot'
      resultCount = 1
      humanReadable = 'Screenshot captured successfully'
    }
    else if (toolName === 'execute_in_browser' || toolName === 'test_react_component' || toolName === 'test_api_endpoint') {
      resultType = 'browserResult'
      resultCount = 1
      humanReadable = result.error ? `Operation failed: ${result.error}` : 'Operation completed successfully'
    }
    else if (toolName === 'check_page_performance') {
      resultType = 'performanceMetrics'
      resultCount = 1
      humanReadable = `Page loaded in ${result.loadTime || 'unknown'}ms`
    }
    else {
      resultType = 'object'
      resultCount = 1
      humanReadable = 'Operation completed successfully'
    }
  }
  else if (typeof result === 'string') {
    resultType = 'string'
    resultCount = 1
    if (toolName === 'get_instructions') {
      humanReadable = 'Instructions retrieved successfully'
    }
    else {
      humanReadable = result.length > 100
        ? `Returned text (${result.length} characters)`
        : result
    }
  }
  else if (result === null || result === undefined) {
    resultType = 'null'
    resultCount = 0
    humanReadable = 'No data returned'
  }
  else {
    resultType = typeof result
    resultCount = 1
    humanReadable = `Returned ${resultType} value`
  }

  return {
    tool: toolName,
    success: true,
    resultType,
    resultCount,
    data: result,
    humanReadable,
  }
}

// Browser tools will be added dynamically
let browserToolsInitialized = false

/**
 * Initialize browser tools if not already done
 */
async function initBrowserTools() {
  if (browserToolsInitialized)
    return

  // Create a mock server object that just collects tools
  const mockServer = {
    registerTool: (name: string, _schema: any, handler: any) => {
      toolRegistry[name] = handler
    },
  }

  // Add browser tools to our registry
  addBrowserTools(mockServer as any)

  // Add browser helper tools (high-level testing/debugging tools)
  addBrowserHelpers(mockServer as any)

  browserToolsInitialized = true
}

/**
 * Register simple REST endpoints for MCP
 */
export function registerSimpleRestEndpoints(app: Express, metrics: any) {
  // Initialize browser tools
  initBrowserTools().catch((error) => {
    logger.error('Failed to initialize browser tools:', error)
  })

  /**
   * Simple REST endpoint for tool execution
   * Works with any HTTP client (curl, Postman, Gemini CLI, etc.)
   */
  app.post('/mcp/simple', async (req, res) => {
    const startTime = Date.now()

    try {
      const { method, params, id } = req.body

      // Handle different methods
      if (method === 'initialize') {
        // Simple initialization response
        res.json({
          jsonrpc: '2.0',
          id: id || 1,
          result: {
            protocolVersion: '1.0.0',
            serverInfo: {
              name: 'token-saver-mcp',
              version: '1.0.2',
            },
            capabilities: {
              tools: true,
            },
          },
        })
        return
      }

      if (method === 'tools/list') {
        // Return list of available tools
        const tools = Object.keys(toolRegistry).map(name => ({
          name,
          description: `Execute ${name} tool`,
          estimatedTokensSaved: TOKEN_SAVINGS_ESTIMATES[name] || 0,
        }))

        res.json({
          jsonrpc: '2.0',
          id: id || 1,
          result: { tools },
        })
        return
      }

      if (method === 'tools/call') {
        const { name, arguments: args } = params

        // Check if tool exists
        if (!toolRegistry[name]) {
          res.status(404).json({
            jsonrpc: '2.0',
            id: id || 1,
            error: {
              code: -32601,
              message: `Tool not found: ${name}`,
            },
          })
          return
        }

        // Execute the tool
        try {
          const result = await toolRegistry[name](args || {})

          // Update metrics
          const responseTime = Date.now() - startTime
          metrics.totalRequests++
          metrics.successCount++

          // Track tool usage
          const currentCount = metrics.toolUsage.get(name) || 0
          metrics.toolUsage.set(name, currentCount + 1)

          // Track token savings
          const tokensSaved = TOKEN_SAVINGS_ESTIMATES[name] || 0
          if (tokensSaved > 0) {
            const currentSaved = metrics.tokenSavings.get(name) || 0
            metrics.tokenSavings.set(name, currentSaved + tokensSaved)
            metrics.totalTokensSaved += tokensSaved
          }

          // Update response time history
          metrics.responseTimeHistory.push(responseTime)
          if (metrics.responseTimeHistory.length > 100) {
            metrics.responseTimeHistory.shift()
          }

          // Add to recent activity
          metrics.recentActivity.push({
            timestamp: Date.now(),
            method: 'tools/call',
            tool: name,
            status: 'success',
            responseTime,
            tokensSaved,
          })
          if (metrics.recentActivity.length > 50) {
            metrics.recentActivity.shift()
          }

          // Return success response with self-describing format
          const selfDescribingResult = createSelfDescribingResponse(name, result)
          res.json({
            jsonrpc: '2.0',
            id: id || 1,
            result: selfDescribingResult,
          })
        }
        catch (error: any) {
          logger.error(`Tool execution failed for ${name}:`, error)

          // Update error metrics
          metrics.totalRequests++
          metrics.errorCount++

          res.status(500).json({
            jsonrpc: '2.0',
            id: id || 1,
            error: {
              code: -32603,
              message: error.message || 'Internal error',
            },
          })
        }
        return
      }

      // Unknown method
      res.status(400).json({
        jsonrpc: '2.0',
        id: id || 1,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      })
    }
    catch (error: any) {
      logger.error('Simple REST endpoint error:', error)
      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id || 1,
        error: {
          code: -32603,
          message: error.message || 'Internal error',
        },
      })
    }
  })

  // Health check endpoint
  app.get('/mcp/health', (_req, res) => {
    res.json({
      status: 'healthy',
      version: '1.0.2',
      tools: Object.keys(toolRegistry).length,
      uptime: process.uptime(),
    })
  })

  logger.info('Simple REST endpoints registered at /mcp/simple')
}
