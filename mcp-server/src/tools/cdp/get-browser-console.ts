import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getBrowserConsole } from '../../browser-functions'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'get_browser_console',
  title: 'Get Browser Console Messages',
  category: 'cdp' as const,
  description: 'Get console messages from the browser (log, error, warning, info, debug). Captures all console output since connection.',

  docs: {
    brief: 'Retrieve browser console messages with filtering',

    parameters: {
      filter: 'Optional filter for message type: log, error, warning, info, debug',
      clear: 'Clear console messages after retrieving (default: false)',
    },

    examples: [
      {
        title: 'Get all console messages',
        code: `get_browser_console({})`,
      },
      {
        title: 'Get only errors',
        code: `get_browser_console({ filter: "error" })`,
      },
      {
        title: 'Get errors and clear console',
        code: `get_browser_console({ filter: "error", clear: true })`,
      },
      {
        title: 'Debug workflow',
        code: `// Execute some code that might error
execute_in_browser({ expression: "nonExistentFunction()" })

// Check for errors
get_browser_console({ filter: "error" })`,
      },
    ],

    workflow: {
      usedWith: ['execute_in_browser', 'click_element', 'debug_javascript_error'],
      followedBy: ['take_screenshot', 'get_dom_snapshot'],
      description: 'Essential for debugging - captures runtime errors and console output',
    },

    tips: [
      'Messages persist across navigation',
      'Use clear: true to reset for fresh debugging',
      'Timestamps are in ISO format',
      'Stack traces included for errors',
      'Filter by type to focus on specific issues',
    ],

    performance: {
      speed: '50-200ms (depending on message count)',
      reliability: 'Very High - always available once connected',
    },
  },
}

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {
        filter: z.enum(['log', 'error', 'warning', 'info', 'debug']).optional().describe(metadata.docs.parameters?.filter || 'Optional filter for message type'),
        clear: z.boolean().optional().describe(metadata.docs.parameters?.clear || 'Clear console messages after retrieving (default: false)'),
      },
    },
    async ({ filter, clear }) => {
      const result = await getBrowserConsole(filter, clear)
      return {
        content: [{
          type: 'text',
          text: result,
        }],
      }
    },
  )
}
