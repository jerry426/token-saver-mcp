import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { typeInBrowser } from '../../browser-functions'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'type_in_browser',
  title: 'Type Text in Browser Input',
  category: 'cdp' as const,
  description: 'Type text into an input field in the browser using a CSS selector.',

  docs: {
    brief: 'Type text into any input field using CSS selector',

    parameters: {
      selector: 'CSS selector for the input field (e.g., "#username", "input[name=\'email\']")',
      text: 'Text to type into the input field',
    },

    examples: [
      {
        title: 'Type into input by ID',
        code: `type_in_browser({ selector: "#username", text: "john.doe" })`,
      },
      {
        title: 'Type into input by name',
        code: `type_in_browser({ selector: "input[name='email']", text: "user@example.com" })`,
      },
      {
        title: 'Type into textarea',
        code: `type_in_browser({ selector: "textarea#message", text: "Hello, world!" })`,
      },
      {
        title: 'Form filling workflow',
        code: `// Navigate to login page
navigate_browser({ url: "http://localhost:3000/login" })

// Fill username
type_in_browser({ selector: "#username", text: "testuser" })

// Fill password
type_in_browser({ selector: "#password", text: "testpass123" })

// Submit form
click_element({ selector: "button[type='submit']" })

// Check for errors
get_browser_console({ filter: "error" })`,
      },
    ],

    workflow: {
      usedWith: ['click_element', 'wait_for_element', 'test_form_validation'],
      followedBy: ['get_browser_console', 'take_screenshot'],
      description: 'Essential for form interaction and data input',
    },

    tips: [
      'Clears existing input content before typing',
      'Works with input, textarea, and contenteditable elements',
      'Use specific selectors for forms with multiple inputs',
      'Text is typed as if user is typing (triggers events)',
      'Check console for validation errors after typing',
    ],

    performance: {
      speed: '100-300ms (plus typing simulation time)',
      reliability: 'High - handles focus and input events automatically',
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
        selector: z.string().describe(metadata.docs.parameters?.selector || 'CSS selector for the input field (e.g., "#username", "input[name=\'email\']")'),
        text: z.string().describe(metadata.docs.parameters?.text || 'Text to type into the input field'),
      },
    },
    async ({ selector, text }) => {
      const result = await typeInBrowser(selector, text)
      return {
        content: [{
          type: 'text',
          text: result,
        }],
      }
    },
  )
}
