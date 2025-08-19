import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  getCallHierarchy,
  getCodeActions,
  getCompletions,
  getDefinition,
  getDiagnostics,
  getDocumentSymbols,
  getHover,
  getImplementations,
  getReferences,
  getSemanticTokens,
  getTypeDefinition,
  rename,
  searchText,
} from '../lsp'
import { logger } from '../utils'
import { bufferResponse, getBufferStats, retrieveBuffer } from './buffer-manager'

const uriDesc = `The file URI in encoded format:
- Windows: "file:///c%3A/path/to/file.ts" (drive letter and colon, ":" encoded as "%3A")
- Unix-like: "file:///home/user/file.ts"
Must start with "file:///" and have special characters URI-encoded`

export async function addLspTools(server: McpServer) {
  server.registerTool(
    'get_completions',
    {
      title: 'Get Code Completions',
      description: 'Get code completion suggestions for a given position in a document.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getCompletions(uri, line, character)

      // Apply buffering if needed (completions can be very large)
      const bufferedResponse = bufferResponse('get_completions', result)

      if (bufferedResponse.metadata) {
        logger.info(`Completions returned buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'buffered_response',
              ...bufferedResponse,
            }, null, 2),
          }],
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_definition',
    {
      title: 'Get Definition',
      description: 'Get the definition location of a symbol.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getDefinition(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_type_definition',
    {
      title: 'Get Type Definition',
      description: 'Get the type definition location of a symbol.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getTypeDefinition(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_code_actions',
    {
      title: 'Get Code Actions',
      description: 'Get available code actions (quick fixes, refactorings) at a given position.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getCodeActions(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.registerTool(
    'get_diagnostics',
    {
      title: 'Get Diagnostics',
      description: 'Get diagnostics (errors, warnings, info, hints) for a file or all files.',
      inputSchema: {
        uri: z.string().optional().describe('Optional file URI to get diagnostics for. If not provided, gets diagnostics for all files.'),
      },
    },
    async ({ uri }) => {
      const result = await getDiagnostics(uri)

      // Apply buffering if needed (diagnostics for all files can be large)
      const bufferedResponse = bufferResponse('get_diagnostics', result)

      if (bufferedResponse.metadata) {
        logger.info(`Diagnostics returned buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'buffered_response',
              ...bufferedResponse,
            }, null, 2),
          }],
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.registerTool(
    'get_semantic_tokens',
    {
      title: 'Get Semantic Tokens',
      description: 'Get semantic tokens (detailed syntax highlighting) for a document.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
      },
    },
    async ({ uri }) => {
      const result = await getSemanticTokens(uri)

      // Apply buffering as semantic tokens can be very large
      const bufferedResponse = bufferResponse('get_semantic_tokens', result)

      if (bufferedResponse.metadata) {
        logger.info(`Semantic tokens returned buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'buffered_response',
              ...bufferedResponse,
            }, null, 2),
          }],
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.registerTool(
    'get_hover',
    {
      title: 'Get Hover Information',
      description: 'Get hover information for a symbol at a given position.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getHover(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_references',
    {
      title: 'Get References',
      description: 'Find all references to a symbol.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getReferences(uri, line, character)

      // Apply buffering if needed
      const bufferedResponse = bufferResponse('get_references', result)

      if (bufferedResponse.metadata) {
        logger.info(`References returned buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'buffered_response',
              ...bufferedResponse,
            }, null, 2),
          }],
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_document_symbols',
    {
      title: 'Get Document Symbols',
      description: 'Get all symbols (classes, methods, functions, variables, etc.) in a document with hierarchical structure.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
      },
    },
    async ({ uri }) => {
      const result = await getDocumentSymbols(uri)

      // Apply buffering if needed
      const bufferedResponse = bufferResponse('get_document_symbols', result)

      if (bufferedResponse.metadata) {
        logger.info(`Document symbols returned buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'buffered_response',
              ...bufferedResponse,
            }, null, 2),
          }],
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.registerTool(
    'get_call_hierarchy',
    {
      title: 'Get Call Hierarchy',
      description: 'Trace function calls - find who calls a function (incoming) or what a function calls (outgoing).',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
        direction: z.enum(['incoming', 'outgoing']).optional().describe('Direction: "incoming" for callers, "outgoing" for callees (default: incoming)'),
      },
    },
    async ({ uri, line, character, direction }) => {
      const result = await getCallHierarchy(uri, line, character, direction || 'incoming')
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.registerTool(
    'find_implementations',
    {
      title: 'Find Implementations',
      description: 'Find all implementations of an interface or abstract class.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getImplementations(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'rename_symbol',
    {
      title: 'Rename Symbol',
      description: 'Rename a symbol across the workspace.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
        newName: z.string().describe('The new name for the symbol.'),
      },
    },
    async ({ uri, line, character, newName }) => {
      const result = await rename(uri, line, character, newName)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'search_text',
    {
      title: 'Search Text in Files',
      description: 'Search for text across all files in the workspace. Returns file locations and positions that can be used with other tools like get_definition or get_references.',
      inputSchema: {
        query: z.string().describe('The text pattern to search for'),
        useRegExp: z.boolean().optional().describe('Use regular expression pattern (default: false)'),
        isCaseSensitive: z.boolean().optional().describe('Case sensitive search (default: false)'),
        matchWholeWord: z.boolean().optional().describe('Match whole word only (default: false)'),
        maxResults: z.number().optional().describe('Maximum number of results (default: 100)'),
        includes: z.array(z.string()).optional().describe('Glob patterns to include (e.g., ["**/*.ts"])'),
        excludes: z.array(z.string()).optional().describe('Glob patterns to exclude (default: node_modules, .git, dist, out)'),
      },
    },
    async ({ query, useRegExp, isCaseSensitive, matchWholeWord, maxResults, includes, excludes }) => {
      const results = await searchText(query, {
        useRegExp,
        isCaseSensitive,
        matchWholeWord,
        maxResults,
        includes,
        excludes,
      })

      // Format results for better readability
      const formattedResults = results.map(r => ({
        file: r.uri.split('/').pop(),
        uri: r.uri,
        matches: r.ranges.length,
        firstMatch: r.ranges[0]
          ? {
              line: r.ranges[0].start.line + 1, // Convert to 1-based for display
              character: r.ranges[0].start.character,
            }
          : null,
        preview: r.preview.trim(),
      }))

      // Apply buffering if needed
      const bufferedResponse = bufferResponse('search_text', formattedResults)

      // Check if we got a buffered response or original data
      if (bufferedResponse.metadata) {
        logger.info(`Search returned buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'buffered_response',
              ...bufferedResponse,
            }, null, 2),
          }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedResults, null, 2),
        }],
      }
    },
  )

  // Add buffer management tools
  server.registerTool(
    'retrieve_buffer',
    {
      title: 'Retrieve Buffered Data',
      description: 'Retrieve the full data from a buffered response using its buffer ID',
      inputSchema: {
        bufferId: z.string().describe('The buffer ID returned in a buffered response'),
      },
    },
    async ({ bufferId }) => {
      const data = retrieveBuffer(bufferId)

      if (!data) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Buffer not found or expired',
              bufferId,
            }),
          }],
        }
      }

      logger.info(`Retrieved buffer ${bufferId}`)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    },
  )

  server.registerTool(
    'get_buffer_stats',
    {
      title: 'Get Buffer Statistics',
      description: 'Get statistics about currently buffered responses',
      inputSchema: {},
    },
    async () => {
      const stats = getBufferStats()
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] }
    },
  )

  server.registerTool(
    'get_supported_languages',
    {
      title: 'Get Supported Languages',
      description: 'Get a list of all languages registered in VSCode, organized by category (programming, web, data, etc.). Also shows which languages are currently active in the workspace.',
      inputSchema: {},
    },
    async () => {
      const { getSupportedLanguages } = await import('../lsp/supported-languages')
      const result = await getSupportedLanguages()
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.registerTool(
    'get_instructions',
    {
      title: 'Get Usage Instructions',
      description: 'Get comprehensive instructions for ALL Token Saver MCP tools (both LSP and CDP). Returns a complete guide with tool descriptions, decision trees, examples, and workflows for both code navigation and browser control.',
      inputSchema: {},
    },
    async () => {
      const { workspace, Uri, extensions } = await import('vscode')
      
      // Get the Token Saver MCP extension
      const extension = extensions.getExtension('jerry426.token-saver-mcp')
      if (!extension) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Token Saver MCP extension not found',
          }],
        }
      }

      // Try to read INSTRUCTIONS_COMBINED.md from extension directory
      const extensionPath = Uri.file(extension.extensionPath)
      const combinedPath = Uri.joinPath(extensionPath, 'AI-instructions', 'INSTRUCTIONS_COMBINED.md')
      
      try {
        const fileContent = await workspace.fs.readFile(combinedPath)
        const instructions = new TextDecoder().decode(fileContent)
        
        logger.info('Returned combined instructions from AI-instructions/INSTRUCTIONS_COMBINED.md')
        
        return {
          content: [{
            type: 'text',
            text: instructions,
          }],
        }
      }
      catch (combinedError) {
        // Fallback to AI-MCP-USER.md for backwards compatibility
        const userPath = Uri.joinPath(extensionPath, 'AI-instructions', 'AI-MCP-USER.md')
        
        try {
          const fileContent = await workspace.fs.readFile(userPath)
          const instructions = new TextDecoder().decode(fileContent)
          
          logger.info('Returned usage instructions from AI-MCP-USER.md (fallback)')
          
          return {
            content: [{
              type: 'text',
              text: instructions,
            }],
          }
        }
        catch (userError) {
          logger.error('Failed to read instructions files', { combinedError, userError })
          return {
            content: [{
              type: 'text',
              text: `Error: Could not read instructions. Please ensure INSTRUCTIONS_COMBINED.md or AI-MCP-USER.md exists in the AI-instructions directory.`,
            }],
          }
        }
      }
    },
  )

  // Add browser tools
  const { addBrowserTools } = await import('./browser-tools')
  addBrowserTools(server)
  
  // Add browser helper tools
  const { addBrowserHelpers } = await import('./browser-helpers')
  addBrowserHelpers(server)
}
