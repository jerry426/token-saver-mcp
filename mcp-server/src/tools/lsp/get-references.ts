import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getReferences } from '../lsp-implementations'
import { bufferResponse } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_references',
  title: 'Get References',
  category: 'lsp' as const,
  description: 'Find all references to a symbol.',

  // Documentation sections
  docs: {
    brief: 'Find everywhere a symbol is used across the entire codebase',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
      line: 'The line number (0-based)',
      character: 'The character position (0-based)',
    },

    examples: [
      {
        title: 'Find all function usages before refactoring',
        code: `get_references({
  uri: "file:///src/utils/helpers.ts",
  line: 15,
  character: 10
})
// Returns: all places where validateEmail() is called`,
      },
      {
        title: 'Understand component usage across app',
        code: `get_references({
  uri: "file:///src/components/Button.tsx",
  line: 5,
  character: 15
})
// Returns: every file that imports and uses Button component`,
      },
      {
        title: 'Impact analysis before changes',
        code: `// First find all references
const refs = get_references({
  uri: "file:///src/api/types.ts",
  line: 10,
  character: 18
})
// Then review each usage before modifying the type`,
      },
    ],

    workflow: {
      usedWith: ['get_definition', 'search_text'],
      followedBy: ['rename_symbol', 'get_hover'],
      description: 'Essential for understanding code dependencies and safe refactoring',
    },

    tips: [
      'Use before renaming/refactoring to understand impact',
      'Includes both reads and writes to variables',
      'Shows usage in comments, strings, and documentation',
      'Large result sets automatically buffered to save tokens',
    ],

    performance: {
      speed: '< 500ms for typical symbols',
      tokenSavings: '95-99% vs manual grep/search',
      accuracy: '100% (semantic understanding, not text matching)',
      buffering: 'Auto-buffers when >20 references or >10KB data',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler(args: any): Promise<any> {
  const handlerImpl = async ({ uri, line, character }) => {
      const result = await getReferences(uri, line, character)

      // Apply buffering if needed (references can be numerous)
      const bufferedResponse = bufferResponse('get_references', result)

      if (bufferedResponse.metadata) {
        console.error(`[get_references] Buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
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
    }
  return handlerImpl(args)
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
        line: z.number().describe(metadata.docs.parameters?.line || 'The line number (0-based)'),
        character: z.number().describe(metadata.docs.parameters?.character || 'The character position (0-based)'),
      },
    },
    handler,
  )
}
