import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getDefinition } from '../lsp-implementations'
import { bufferResponse } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_definition',
  title: 'Get Definition',
  category: 'lsp' as const,
  description: 'Get the definition location of a symbol.',

  // Documentation sections
  docs: {
    brief: 'Jump to where something is defined',

    parameters: {
      uri: 'The file URI in encoded format (e.g., "file:///path/to/file.ts")',
      line: 'The line number (0-based)',
      character: 'The character position (0-based)',
    },

    examples: [
      {
        title: 'Find function definition',
        code: `get_definition({
  uri: "file:///src/app.ts",
  line: 45,
  character: 10
})`,
      },
      {
        title: 'Navigate from usage to declaration',
        code: `// First find usages
const results = search_text({ query: "handleSubmit" })

// Then jump to definition
get_definition({
  uri: results[0].uri,
  line: results[0].range.start.line,
  character: results[0].range.start.character
})`,
      },
    ],

    workflow: {
      usedWith: ['search_text', 'get_references'],
      followedBy: ['get_hover', 'rename_symbol'],
      description: 'Typically used after search_text to locate exact definitions',
    },

    tips: [
      'Always use absolute file:// URIs, not relative paths',
      'Use search_text first to find symbols, then get_definition for exact location',
      'Combines well with get_references to understand code usage',
    ],

    performance: {
      speed: '< 50ms',
      tokenSavings: '95-99% vs reading entire file',
      accuracy: '100% (semantic understanding)',
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
      const result = await getDefinition(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )
}

// Default export for tool handler
export default async function (args: any) {
  return getDefinition(args.uri, args.line, args.character)
}
