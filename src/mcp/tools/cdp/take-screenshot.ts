import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { takeScreenshot } from '../../browser-functions'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'take_screenshot',
  title: 'Take Browser Screenshot',
  category: 'cdp' as const,
  description: 'Take a screenshot of the current browser page.',

  docs: {
    brief: 'Capture visual state of current browser page',

    parameters: {},

    examples: [
      {
        title: 'Basic screenshot',
        code: `// Navigate to page first
navigate_browser({ url: "http://localhost:3000" })

// Take screenshot
take_screenshot({})`,
      },
      {
        title: 'Debug visual issues',
        code: `// Navigate and interact
navigate_browser({ url: "http://localhost:3000/form" })
type_in_browser({ selector: "#input", text: "test data" })
click_element({ selector: "#submit" })

// Capture result
take_screenshot({})`,
      },
      {
        title: 'UI testing workflow',
        code: `// Test responsive design
navigate_browser({ url: "http://localhost:3000" })

// Take before screenshot
take_screenshot({})

// Simulate mobile viewport
execute_in_browser({ 
  expression: "document.querySelector('meta[name=viewport]').setAttribute('content', 'width=375')" 
})

// Take after screenshot
take_screenshot({})`,
      },
    ],

    workflow: {
      usedWith: ['navigate_browser', 'click_element', 'execute_in_browser'],
      followedBy: ['debug_javascript_error', 'get_browser_console'],
      description: 'Visual verification tool for UI testing and debugging',
    },

    tips: [
      'Screenshot is returned as base64 PNG data',
      'Captures full visible viewport',
      'Use after navigation to verify page loaded',
      'Helpful for debugging layout issues',
      'Can be saved or displayed by AI assistants',
    ],

    performance: {
      speed: '200-800ms (depends on page complexity)',
      reliability: 'Very High - works on any page state',
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
      const result = await takeScreenshot()
      return {
        content: [{
          type: 'text',
          text: result,
        }],
      }
    },
  )
}
