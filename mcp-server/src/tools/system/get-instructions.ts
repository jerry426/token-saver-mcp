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
      // For standalone server, read the instructions from the local file system
      try {
        const fs = await import('fs/promises')
        const path = await import('path')
        const { fileURLToPath } = await import('url')
        
        // Get the directory of this file
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)
        
        // Navigate to the README_USAGE_GUIDE.md file in the standalone-server directory
        const instructionsPath = path.join(__dirname, '..', '..', 'README_USAGE_GUIDE.md')
        
        const instructions = await fs.readFile(instructionsPath, 'utf-8')

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
