import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { getSupportedLanguages } from '../../../lsp/supported-languages'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'get_supported_languages',
  title: 'Get Supported Languages',
  category: 'system' as const,
  description: 'Get a list of all languages registered in VSCode, organized by category (programming, web, data, etc.). Also shows which languages are currently active in the workspace.',

  docs: {
    brief: 'List all VSCode language registrations and workspace activity',

    parameters: {},

    examples: [
      {
        title: 'Check language support',
        code: `get_supported_languages()`,
      },
    ],

    workflow: {
      usedWith: ['All LSP tools'],
      followedBy: ['Use LSP tools with confidence on supported languages'],
      description: 'Verify language support before using LSP features',
    },

    tips: [
      'Shows all registered languages (~150+ including extensions)',
      'Categorizes languages: programming, web, data, config, etc.',
      'Lists which languages are active in current workspace',
      'Useful for understanding LSP feature availability',
      'Programming languages get full LSP support (completions, navigation, etc.)',
      'Other file types may have limited features',
    ],

    meta: {
      isUtility: true,
      supportsTool: 'All LSP tools - helps understand feature availability',
    },
  },
}

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {},
    },
    async () => {
      const result = await getSupportedLanguages()
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )
}
