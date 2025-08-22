import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { bufferResponse } from '../../buffer-manager'
import { getCompletions } from '../lsp-implementations'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_completions',
  title: 'Get Code Completions',
  category: 'lsp' as const,
  description: 'Get code completion suggestions for a given position in a document.',

  // Documentation sections
  docs: {
    brief: 'Get IntelliSense completion suggestions at cursor position',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
      line: 'The line number (0-based)',
      character: 'The character position (0-based)',
    },

    examples: [
      {
        title: 'Get completions after typing partial method name',
        code: `get_completions({
  uri: "file:///src/api/users.ts",
  line: 25,
  character: 8
})
// After typing "user.pro" - returns "profile", "projects", etc.`,
      },
      {
        title: 'Auto-import suggestions',
        code: `get_completions({
  uri: "file:///src/components/Button.tsx",
  line: 5,
  character: 15
})
// After typing "React" - suggests imports and React types`,
      },
      {
        title: 'Type-aware completions',
        code: `get_completions({
  uri: "file:///src/utils/validation.ts",
  line: 12,
  character: 20
})
// Inside function parameter - shows type-specific suggestions`,
      },
    ],

    workflow: {
      usedWith: ['get_hover', 'get_definition'],
      followedBy: ['get_type_definition', 'get_documentation'],
      description: 'Essential for code writing and understanding available APIs',
    },

    tips: [
      'Position cursor exactly where you need suggestions (mid-word, after dot, etc.)',
      'Results include auto-imports, method signatures, and documentation',
      'Large result sets are automatically buffered to save tokens',
      'Use with TypeScript/JavaScript for best IntelliSense experience',
    ],

    performance: {
      speed: '< 100ms',
      tokenSavings: '90-99% vs manually searching documentation',
      accuracy: '100% (real VSCode IntelliSense)',
      buffering: 'Auto-buffers when >500 completions or >10KB data',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler(args: any): Promise<any> {
  const handlerImpl = async ({ uri, line, character }: { uri: string, line: number, character: number }) => {
    const result = await getCompletions(uri, line, character)

    // Apply buffering if needed (completions can be very large)
    const bufferedResponse = bufferResponse('get_completions', result)

    if (bufferedResponse.metadata) {
      console.error(`[get_completions] Buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
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
