import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getCodeActions } from '../lsp-implementations'
import { bufferResponse } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_code_actions',
  title: 'Get Code Actions',
  category: 'lsp' as const,
  description: 'Get available code actions (quick fixes, refactorings) at a given position.',

  // Documentation sections
  docs: {
    brief: 'Get quick fixes, refactorings, and code improvements available at cursor position',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
      line: 'The line number (0-based)',
      character: 'The character position (0-based)',
    },

    examples: [
      {
        title: 'Get quick fixes for TypeScript errors',
        code: `get_code_actions({
  uri: "file:///src/api/users.ts",
  line: 15,
  character: 10
})
// Returns: "Add missing import", "Fix typo", "Declare property", etc.`,
      },
      {
        title: 'Get refactoring options',
        code: `get_code_actions({
  uri: "file:///src/components/Button.tsx",
  line: 25,
  character: 8
})
// Returns: "Extract to function", "Convert to arrow function", etc.`,
      },
      {
        title: 'Get ESLint auto-fixes',
        code: `get_code_actions({
  uri: "file:///src/utils/helpers.js",
  line: 8,
  character: 20
})
// Returns: "Fix ESLint rule", "Add missing semicolon", etc.`,
      },
    ],

    workflow: {
      usedWith: ['get_diagnostics', 'get_hover'],
      followedBy: ['apply_action', 'get_definition'],
      description: 'Essential for automated code improvements and error fixing',
    },

    tips: [
      'Works best when positioned on errors/warnings highlighted in diagnostics',
      'Returns both quick fixes and refactoring suggestions',
      'Actions include imports, type fixes, code style improvements',
      'Use after get_diagnostics to see available fixes for specific issues',
    ],

    performance: {
      speed: '< 100ms',
      tokenSavings: '90-99% vs manually researching fixes',
      accuracy: '100% (VSCode\'s own quick fix system)',
      buffering: 'No buffering needed - typically small responses',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler(args: any): Promise<any> {
  const handlerImpl = async ({ uri, line, character }) => {
      const result = await getCodeActions(uri, line, character)

      if (!result || result.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No code actions available at the specified position.',
          }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      }
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
