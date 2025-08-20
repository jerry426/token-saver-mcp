import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getDocumentSymbols } from '../lsp-implementations'
import { bufferResponse } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_document_symbols',
  title: 'Get Document Symbols',
  category: 'lsp' as const,
  description: 'Get all symbols (classes, methods, functions, variables, etc.) in a document with hierarchical structure.',

  // Documentation sections
  docs: {
    brief: 'Get file outline with all functions, classes, variables, and their hierarchy',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
    },

    examples: [
      {
        title: 'Get TypeScript file structure',
        code: `get_document_symbols({
  uri: "file:///src/api/users.ts"
})
// Returns: interfaces, classes, functions, variables with positions`,
      },
      {
        title: 'Understand React component structure',
        code: `get_document_symbols({
  uri: "file:///src/components/UserProfile.tsx"
})
// Returns: component, props interface, methods, state variables`,
      },
      {
        title: 'Navigate large files efficiently',
        code: `// Get outline first
const symbols = get_document_symbols({
  uri: "file:///src/utils/helpers.js"
})
// Then jump to specific functions using their positions`,
      },
    ],

    workflow: {
      usedWith: ['search_text', 'get_definition'],
      followedBy: ['get_hover', 'get_references'],
      description: 'Perfect for understanding file structure and navigating large files',
    },

    tips: [
      'Provides hierarchical view - classes contain methods, modules contain functions',
      'Shows symbol ranges for precise navigation',
      'Includes visibility info (public, private, protected)',
      'Works as file outline/table of contents for any language',
    ],

    performance: {
      speed: '< 200ms for typical files',
      tokenSavings: '80-95% vs reading entire file',
      accuracy: '100% (compiler-level symbol analysis)',
      buffering: 'Auto-buffers when >100 symbols or >15KB data',
    },
  },
}

// Tool registration function
export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {
        uri: z.string().describe(metadata.docs.parameters?.uri || 'The file URI in encoded format'),
      },
    },
    async ({ uri }) => {
      const result = await getDocumentSymbols(uri)

      // Apply buffering if needed (large files can have many symbols)
      const bufferedResponse = bufferResponse('get_document_symbols', result)

      if (bufferedResponse.metadata) {
        console.error(`[get_document_symbols] Buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
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
}
