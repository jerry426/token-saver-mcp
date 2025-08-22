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

// Tool handler - single source of truth for execution
export async function handler(): Promise<any> {
  // For standalone server, read the instructions from the local file system
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    // Navigate to the README_USAGE_GUIDE.md file in the root directory
    // Since we're in src/tools/system/, we need to go up 3 levels
    const instructionsPath = path.join(__dirname, '..', '..', '..', '..', 'README_USAGE_GUIDE.md')

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
}

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {},
    },
    handler, // Use the exported handler
  )
}
