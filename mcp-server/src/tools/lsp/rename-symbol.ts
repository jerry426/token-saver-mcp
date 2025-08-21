import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { renameSymbol } from '../lsp-implementations'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'rename_symbol',
  title: 'Rename Symbol',
  category: 'lsp' as const,
  description: 'Rename a symbol across the workspace.',

  // Documentation sections
  docs: {
    brief: 'Safely rename variables, functions, classes across entire codebase',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
      line: 'The line number (0-based)',
      character: 'The character position (0-based)',
      newName: 'The new name for the symbol',
    },

    examples: [
      {
        title: 'Rename function across codebase',
        code: `rename_symbol({
  uri: "file:///src/utils/helpers.ts",
  line: 15,
  character: 10,
  newName: "validateUserEmail"
})
// Renames validateEmail() everywhere it's used`,
      },
      {
        title: 'Rename component prop',
        code: `rename_symbol({
  uri: "file:///src/components/Button.tsx",
  line: 8,
  character: 12,
  newName: "isDisabled"
})
// Renames prop across component definition and all usages`,
      },
      {
        title: 'Rename class with type safety',
        code: `rename_symbol({
  uri: "file:///src/services/UserService.ts",
  line: 5,
  character: 15,
  newName: "UserManager"
})
// Renames class and updates all imports, type annotations`,
      },
    ],

    workflow: {
      usedWith: ['get_references', 'get_definition'],
      followedBy: ['get_diagnostics', 'search_text'],
      description: 'Final step in refactoring workflow - safely apply symbol rename',
    },

    tips: [
      'Use get_references first to preview all affected locations',
      'Handles imports, exports, and type annotations automatically',
      'Preserves semantic meaning - won\'t rename unrelated symbols',
      'Check get_diagnostics after rename to ensure no errors',
    ],

    performance: {
      speed: '< 1s for typical symbols, longer for heavily-used ones',
      tokenSavings: '99% vs manual find-and-replace',
      accuracy: '100% (semantic awareness prevents false matches)',
      buffering: 'No buffering needed - returns edit locations',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler(args: any): Promise<any> {
  const handlerImpl = async ({ uri, line, character, newName }) => {
      const result = await renameSymbol(uri, line, character, newName)

      if (!result) {
        return {
          content: [{
            type: 'text',
            text: 'Rename operation failed. The symbol may not support renaming or the new name is invalid.',
          }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result),
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
        newName: z.string().describe(metadata.docs.parameters?.newName || 'The new name for the symbol.'),
      },
    },
    handler,
  )
}
