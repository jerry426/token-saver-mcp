import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { waitForElement } from '../../browser-functions'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'wait_for_element',
  title: 'Wait for Element',
  category: 'cdp' as const,
  description: 'Wait for an element to appear in the DOM.',

  docs: {
    brief: 'Wait for element to become available before interaction',

    parameters: {
      selector: 'CSS selector for the element to wait for',
      timeout: 'Timeout in milliseconds (default: 5000)',
    },

    examples: [
      {
        title: 'Wait for loading to complete',
        code: `// Navigate to dynamic page
navigate_browser({ url: "http://localhost:3000/dashboard" })

// Wait for main content to load
wait_for_element({ selector: "#dashboard-content" })

// Now safe to interact
click_element({ selector: "#menu-button" })`,
      },
      {
        title: 'Wait with custom timeout',
        code: `wait_for_element({ 
  selector: ".slow-loading-component", 
  timeout: 10000 
})`,
      },
      {
        title: 'Async workflow pattern',
        code: `// Navigate
navigate_browser({ url: "http://localhost:3000/spa" })

// Wait for SPA to initialize
wait_for_element({ selector: "[data-loaded='true']" })

// Wait for specific feature
wait_for_element({ selector: "#user-profile" })

// Now interact safely
type_in_browser({ selector: "#search", text: "query" })`,
      },
    ],

    workflow: {
      usedWith: ['navigate_browser', 'click_element', 'type_in_browser'],
      followedBy: ['test_react_component', 'get_dom_snapshot'],
      description: 'Critical for reliable automation - ensures elements exist before interaction',
    },

    tips: [
      'Always wait after navigation for dynamic content',
      'Use data attributes for reliable waiting',
      'Essential for SPAs and AJAX-heavy sites',
      'Prevents "element not found" errors',
      'Timeout throws error if element never appears',
    ],

    performance: {
      speed: '0ms-timeout (depends on page loading)',
      reliability: 'Essential for reliability - prevents race conditions',
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
        selector: z.string().describe(metadata.docs.parameters?.selector || 'CSS selector for the element to wait for'),
        timeout: z.number().optional().describe(metadata.docs.parameters?.timeout || 'Timeout in milliseconds (default: 5000)'),
      },
    },
    async ({ selector, timeout }) => {
      const result = await waitForElement(selector, timeout)
      return {
        content: [{
          type: 'text',
          text: result,
        }],
      }
    },
  )
}
