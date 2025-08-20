import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { executeInBrowser } from '../../browser-functions'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'execute_in_browser',
  title: 'Execute JavaScript in Browser',
  category: 'cdp' as const,
  description: 'Execute JavaScript code in the browser context via Chrome DevTools Protocol. Requires Chrome to be running or will launch it automatically.',

  docs: {
    brief: 'Execute JavaScript in browser context',

    parameters: {
      expression: 'JavaScript expression to execute in the browser',
      url: 'Optional URL to navigate to before executing (e.g., "https://example.com")',
    },

    examples: [
      {
        title: 'Simple expression',
        code: `execute_in_browser({ expression: "document.title" })`,
      },
      {
        title: 'Navigate and execute',
        code: `execute_in_browser({ 
  url: "http://localhost:3000", 
  expression: "document.querySelector('#app').innerHTML" 
})`,
      },
      {
        title: 'Complex DOM manipulation',
        code: `execute_in_browser({ 
  expression: \`
    const button = document.createElement('button');
    button.textContent = 'Test Button';
    document.body.appendChild(button);
    return button.outerHTML;
  \`
})`,
      },
    ],

    workflow: {
      usedWith: ['navigate_browser', 'wait_for_element', 'get_dom_snapshot'],
      followedBy: ['get_browser_console', 'take_screenshot'],
      description: 'Central tool for browser automation - can navigate and execute in one call',
    },

    tips: [
      'Use template literals for multi-line JavaScript',
      'Return values will be JSON serialized',
      'Chrome launches automatically if not running',
      'Use url parameter to navigate before executing',
      'Timeout after page load is 1 second by default',
    ],

    performance: {
      speed: '500ms-2s (depends on navigation and script complexity)',
      reliability: 'High - includes connection recovery',
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
        expression: z.string().describe(metadata.docs.parameters?.expression || 'JavaScript expression to execute in the browser'),
        url: z.string().optional().describe(metadata.docs.parameters?.url || 'Optional URL to navigate to before executing (e.g., "https://example.com")'),
      },
    },
    async ({ expression, url }) => {
      const result = await executeInBrowser(expression, url)
      return {
        content: [{
          type: 'text',
          text: result,
        }],
      }
    },
  )
}
