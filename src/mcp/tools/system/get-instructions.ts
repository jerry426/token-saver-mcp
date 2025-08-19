import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'get_instructions',
  title: 'Get Instructions',
  category: 'system' as const,
  description: 'Get comprehensive instructions for ALL Token Saver MCP tools (both LSP and CDP). Returns a complete guide with tool descriptions, decision trees, examples, and workflows for both code navigation and browser control.',

  docs: {
    brief: 'Get this documentation',

    parameters: {},

    examples: [
      {
        title: 'Get all documentation',
        code: `get_instructions()`,
      },
    ],

    workflow: {
      usedWith: [],
      followedBy: ['Any tool based on instructions'],
      description: 'Usually called first to understand available tools',
    },

    tips: [
      'This returns the complete INSTRUCTIONS.md file',
      'Contains all tool documentation, examples, and workflows',
      'No need to read any other documentation files',
    ],

    meta: {
      isMetaTool: true,
      alwaysInclude: true,
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
      const { workspace, Uri, extensions } = await import('vscode')

      // Get the Token Saver MCP extension
      const extension = extensions.getExtension('jerry426.token-saver-mcp')
      if (!extension) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Token Saver MCP extension not found',
          }],
        }
      }

      // Read README_USAGE_GUIDE.md from root directory
      const extensionPath = Uri.file(extension.extensionPath)
      const instructionsPath = Uri.joinPath(extensionPath, 'README_USAGE_GUIDE.md')

      try {
        const fileContent = await workspace.fs.readFile(instructionsPath)
        const instructions = new TextDecoder().decode(fileContent)

        return {
          content: [{
            type: 'text',
            text: instructions,
          }],
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error reading instructions file: ${error}`,
          }],
        }
      }
    },
  )
}
