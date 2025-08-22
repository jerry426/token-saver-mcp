import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { clickElement } from '../../browser-functions'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'click_element',
  title: 'Click Element in Browser',
  category: 'cdp' as const,
  description: 'Click an element in the browser using a CSS selector.',

  docs: {
    brief: 'Click any element using CSS selector',

    parameters: {
      selector: 'CSS selector for the element to click (e.g., "#submit-button", ".menu-item")',
    },

    examples: [
      {
        title: 'Click button by ID',
        code: `click_element({ selector: "#submit-button" })`,
      },
      {
        title: 'Click link by class',
        code: `click_element({ selector: ".nav-link" })`,
      },
      {
        title: 'Click specific form element',
        code: `click_element({ selector: "form[name='login'] button[type='submit']" })`,
      },
      {
        title: 'UI testing workflow',
        code: `// Navigate to page
navigate_browser({ url: "http://localhost:3000/dashboard" })

// Wait for element to be ready
wait_for_element({ selector: "#menu-toggle" })

// Click to open menu
click_element({ selector: "#menu-toggle" })

// Verify menu opened
get_dom_snapshot({})`,
      },
    ],

    workflow: {
      usedWith: ['wait_for_element', 'navigate_browser', 'type_in_browser'],
      followedBy: ['get_browser_console', 'get_dom_snapshot', 'take_screenshot'],
      description: 'Core interaction tool for triggering UI events and state changes',
    },

    tips: [
      'Use specific selectors to avoid ambiguity',
      'Wait for elements before clicking if page is still loading',
      'Check console for click event errors',
      'Combine with wait_for_element for reliable automation',
      'Use get_dom_snapshot first to identify correct selectors',
    ],

    performance: {
      speed: '100-500ms (depends on element and page state)',
      reliability: 'High - includes automatic element finding and clicking',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler({ selector }: any): Promise<any> {
  const result = await clickElement(selector)
  return {
    content: [{
      type: 'text',
      text: result,
    }],
  }
}

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {
        selector: z.string().describe(metadata.docs.parameters?.selector || 'CSS selector for the element to click (e.g., \"#submit-button\", \".menu-item\")'),
      },
    },
    handler, // Use the exported handler
  )
}
