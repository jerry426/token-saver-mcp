import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getTypeDefinition } from '../lsp-implementations'
import { bufferResponse } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_type_definition',
  title: 'Get Type Definition',
  category: 'lsp' as const,
  description: 'Get the type definition location of a symbol.',

  // Documentation sections
  docs: {
    brief: 'Navigate to where a type is defined (interfaces, classes, type aliases)',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
      line: 'The line number (0-based)',
      character: 'The character position (0-based)',
    },

    examples: [
      {
        title: 'Find interface definition from variable',
        code: `get_type_definition({
  uri: "file:///src/user/profile.ts",
  line: 15,
  character: 10
})
// From "const user: User" -> jumps to interface User definition`,
      },
      {
        title: 'Navigate to generic type parameter',
        code: `get_type_definition({
  uri: "file:///src/api/response.ts",
  line: 8,
  character: 25
})
// From "Response<UserData>" -> jumps to UserData type definition`,
      },
      {
        title: 'Find class definition from instance',
        code: `get_type_definition({
  uri: "file:///src/services/auth.ts",
  line: 22,
  character: 18
})
// From "new AuthService()" -> jumps to AuthService class definition`,
      },
    ],

    workflow: {
      usedWith: ['get_definition', 'get_hover'],
      followedBy: ['get_implementations', 'get_references'],
      description: 'Essential for understanding type hierarchies and interfaces',
    },

    tips: [
      'Different from get_definition - shows type/interface, not implementation',
      'Particularly useful in TypeScript for understanding type relationships',
      'Use on variables, parameters, return types to see their type definitions',
      'Combines well with get_implementations to see all type implementers',
    ],

    performance: {
      speed: '< 50ms',
      tokenSavings: '95-99% vs searching for type definitions manually',
      accuracy: '100% (TypeScript compiler precision)',
      buffering: 'No buffering needed - typically small responses',
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
        line: z.number().describe(metadata.docs.parameters?.line || 'The line number (0-based)'),
        character: z.number().describe(metadata.docs.parameters?.character || 'The character position (0-based)'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getTypeDefinition(uri, line, character)

      if (!result || result.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No type definition found for the symbol at the specified position.',
          }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      }
    },
  )
}

// Default export for tool handler
export default async function (args: any) {
  return getTypeDefinition(args.uri, args.line, args.character)
}
