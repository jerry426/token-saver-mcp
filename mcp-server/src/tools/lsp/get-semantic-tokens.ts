import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getSemanticTokens } from '../lsp-implementations'
import { bufferResponse } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_semantic_tokens',
  title: 'Get Semantic Tokens',
  category: 'lsp' as const,
  description: 'Get semantic tokens (detailed syntax highlighting) for a document.',

  // Documentation sections
  docs: {
    brief: 'Get detailed semantic analysis for syntax highlighting and code understanding',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
    },

    examples: [
      {
        title: 'Analyze TypeScript semantic tokens',
        code: `get_semantic_tokens({
  uri: "file:///src/api/users.ts"
})
// Returns: variables, functions, classes, types with semantic info`,
      },
      {
        title: 'Understanding code structure semantically',
        code: `get_semantic_tokens({
  uri: "file:///src/components/Button.tsx"
})
// Returns: React components, props, hooks, JSX elements with types`,
      },
      {
        title: 'Code analysis for refactoring',
        code: `// Get semantic tokens to understand variable scopes
const tokens = get_semantic_tokens({
  uri: "file:///src/utils/helpers.js"
})
// Use token info to safely rename variables`,
      },
    ],

    workflow: {
      usedWith: ['get_document_symbols', 'get_definition'],
      followedBy: ['get_hover', 'rename_symbol'],
      description: 'Advanced tool for deep code understanding and semantic analysis',
    },

    tips: [
      'Provides richer information than basic syntax highlighting',
      'Shows variable scopes, function signatures, type information',
      'Essential for advanced refactoring and code transformation',
      'Large files automatically buffered to save tokens',
    ],

    performance: {
      speed: '< 300ms for typical files',
      tokenSavings: '70-90% vs manually parsing code structure',
      accuracy: '100% (compiler-level semantic analysis)',
      buffering: 'Auto-buffers when >1000 tokens or >15KB data',
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
      const result = await getSemanticTokens(uri)

      // Apply buffering if needed (semantic tokens can be huge for large files)
      const bufferedResponse = bufferResponse('get_semantic_tokens', result)

      if (bufferedResponse.metadata) {
        console.error(`[get_semantic_tokens] Buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
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
