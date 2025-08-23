import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getHover } from '../lsp-implementations'
import { normalizeParams } from './utils'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_hover',
  title: 'Get Hover Information',
  category: 'lsp' as const,
  description: 'Get hover information for a symbol at a given position.',

  // Documentation sections
  docs: {
    brief: 'Get documentation, type info, and quick help for any symbol',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
      line: 'The line number (0-based)',
      character: 'The character position (0-based)',
    },

    examples: [
      {
        title: 'Get function documentation',
        code: `get_hover({
  uri: "file:///src/api/users.ts",
  line: 25,
  character: 10
})
// Returns: function signature, JSDoc comments, parameter types`,
      },
      {
        title: 'Understand library API usage',
        code: `get_hover({
  uri: "file:///src/components/Button.tsx",
  line: 15,
  character: 20
})
// Returns: React component props, TypeScript interface details`,
      },
      {
        title: 'Quick type checking',
        code: `get_hover({
  uri: "file:///src/utils/validation.ts",
  line: 8,
  character: 12
})
// Returns: variable type, value constraints, usage examples`,
      },
    ],

    workflow: {
      usedWith: ['get_definition', 'get_completions'],
      followedBy: ['get_references', 'rename_symbol'],
      description: 'Perfect first step for understanding unfamiliar code or APIs',
    },

    tips: [
      'Hover on function names to see signatures and documentation',
      'Works on variables to show inferred types and values',
      'Displays JSDoc comments and TypeScript type information',
      'Essential for understanding third-party library APIs',
    ],

    performance: {
      speed: '< 50ms',
      tokenSavings: '90-99% vs searching documentation manually',
      accuracy: '100% (VSCode\'s own hover system)',
      buffering: 'No buffering needed - typically small responses',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler(args: any): Promise<any> {
  const normalized = normalizeParams(args)
  const handlerImpl = async ({ uri, line, character }: { uri: string, line: number, character: number }) => {
    const result = await getHover(uri, line, character)

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return {
        content: [{
          type: 'text',
          text: 'No hover information available at the specified position.',
        }],
      }
    }

    // Process hover contents
    if (Array.isArray(result)) {
      const allContents: string[] = []

      for (const hover of result) {
        if (hover && hover.contents) {
          for (const content of hover.contents) {
            if (typeof content === 'string') {
              allContents.push(content)
            }
            else if (content && typeof content === 'object') {
              // Handle markdown content
              if (content.value) {
                allContents.push(content.value)
              }
              else if (content.kind === 'markdown' && content.value) {
                allContents.push(content.value)
              }
            }
          }
        }
      }

      if (allContents.length > 0) {
        return {
          content: [{
            type: 'text',
            text: allContents.join('\n\n'),
          }],
        }
      }
    }

    // Fallback to JSON.stringify if the structure is not as expected
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    }
  }
  return handlerImpl(normalized)
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
    handler, // Use the exported handler
  )
}
