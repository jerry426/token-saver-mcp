import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { navigateBrowser } from '../../browser-functions'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'navigate_browser',
  title: 'Navigate Browser',
  category: 'cdp' as const,
  description: 'Navigate the browser to a specific URL and wait for page load.',

  docs: {
    brief: 'Navigate to URL and wait',

    parameters: {
      url: 'URL to navigate to (e.g., "http://localhost:3000")',
    },

    examples: [
      {
        title: 'Basic navigation',
        code: `navigate_browser({ url: "http://localhost:3000" })`,
      },
      {
        title: 'Navigate before testing',
        code: `// Navigate first
navigate_browser({ url: "http://localhost:3000/dashboard" })

// Then interact with page
click_element({ selector: "#menu-button" })
type_in_browser({ selector: "#search", text: "query" })`,
      },
    ],

    workflow: {
      usedWith: ['click_element', 'type_in_browser', 'get_dom_snapshot'],
      followedBy: ['test_react_component', 'get_browser_console'],
      description: 'Usually the first step in browser automation workflows',
    },

    tips: [
      'Chrome will auto-launch if not running',
      'Waits for page load automatically',
      'Use execute_in_browser if you need to navigate and run JS in one call',
    ],

    performance: {
      speed: '1-3 seconds (network dependent)',
      reliability: 'High - includes automatic retry logic',
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
        url: z.string().describe(metadata.docs.parameters?.url || 'URL to navigate to (e.g., "https://example.com")'),
      },
    },
    async ({ url }) => {
      const result = await navigateBrowser(url)
      return {
        content: [{
          type: 'text',
          text: result,
        }],
      }
    },
  )
}
