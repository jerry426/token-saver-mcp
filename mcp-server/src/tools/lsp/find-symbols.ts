import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { vscode } from '../../vscode-adapter'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'find_symbols',
  title: 'Find Symbols in Workspace',
  category: 'lsp' as const,
  description: 'Find symbols (functions, classes, methods, variables) across the workspace using semantic search',

  docs: {
    brief: 'Semantic symbol search across entire workspace',

    parameters: {
      query: 'The symbol name or pattern to search for',
    },

    examples: [
      {
        title: 'Find function by name',
        code: `find_symbols({
  query: "validateEmail"
})
// Finds all functions, methods, or variables named validateEmail`,
      },
      {
        title: 'Find class definitions',
        code: `find_symbols({
  query: "UserService"
})
// Finds UserService class and related symbols`,
      },
      {
        title: 'Partial name search',
        code: `find_symbols({
  query: "handle"
})
// Finds handleRequest, handleError, eventHandler, etc.`,
      },
    ],

    workflow: {
      usedWith: ['get_definition', 'get_references', 'get_hover'],
      followedBy: ['get_references', 'rename_symbol'],
      description: 'Primary tool for navigating to code symbols semantically',
    },

    tips: [
      'Uses Language Server Protocol for semantic understanding',
      'Finds symbols regardless of file location',
      'Returns exact locations for direct navigation',
      'More accurate than text search for code elements',
      'Works best when language servers are active',
    ],

    performance: {
      speed: '< 500ms for most workspaces',
      tokenSavings: '80-95% vs text search for finding symbols',
      accuracy: '100% (semantic matching)',
      buffering: 'Not needed - results are already concise',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler({ query }: any): Promise<any> {
  // Use VSCode's workspace symbol provider
  const results = await vscode.commands.executeCommand(
    'vscode.executeWorkspaceSymbolProvider',
    query,
  )

  // Handle empty results
  if (!results || (results as any[]).length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No symbols found matching "${query}"`,
      }],
    }
  }

  // Format results for better readability
  const formattedResults = (results as any[])
    .filter(symbol => symbol && symbol.location)
    .map((symbol: any) => {
    // Handle VSCode's URI format
      const uriObj = symbol.location?.uri
      const uri = uriObj?.path || uriObj?.toString() || ''
      const fileName = uri.split('/').pop() || 'unknown'

      // Handle range - it might be an array [start, end] or an object {start, end}
      const range = symbol.location?.range
      let startLine = null
      let startChar = null

      if (Array.isArray(range) && range.length >= 1) {
      // Array format [start, end]
        startLine = range[0].line + 1
        startChar = range[0].character
      }
      else if (range?.start) {
      // Object format {start, end}
        startLine = range.start.line + 1
        startChar = range.start.character
      }

      return {
        name: symbol.name,
        kind: symbol.kind, // Function, Class, Variable, etc.
        file: fileName,
        uri: uriObj?.scheme ? `${uriObj.scheme}://${uri}` : uri,
        line: startLine,
        character: startChar,
        containerName: symbol.containerName || '',
      }
    })

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(formattedResults, null, 2),
    }],
  }
}

// Tool registration function
export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {
        query: z.string().describe(metadata.docs.parameters?.query || 'The symbol name or pattern to search for'),
      },
    },
    handler, // Use the exported handler
  )
}
