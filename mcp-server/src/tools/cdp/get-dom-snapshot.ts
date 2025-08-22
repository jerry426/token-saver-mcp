import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { getDOMSnapshot } from '../../browser-functions'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'get_dom_snapshot',
  title: 'Get DOM Snapshot',
  category: 'cdp' as const,
  description: 'Get a snapshot of the current DOM including forms, links, and images.',

  docs: {
    brief: 'Capture complete DOM structure with interactive elements',

    parameters: {},

    examples: [
      {
        title: 'Basic DOM snapshot',
        code: `// Navigate to page first
navigate_browser({ url: "http://localhost:3000" })

// Then get DOM structure
get_dom_snapshot({})`,
      },
      {
        title: 'Form analysis workflow',
        code: `// Get DOM to analyze forms
const snapshot = get_dom_snapshot({})

// Use snapshot data to identify forms and inputs
// Then interact with specific elements
click_element({ selector: "#login-form input[name='username']" })`,
      },
    ],

    workflow: {
      usedWith: ['navigate_browser', 'click_element', 'type_in_browser'],
      followedBy: ['wait_for_element', 'test_form_validation'],
      description: 'Provides complete page structure for planning interactions',
    },

    tips: [
      'Captures all interactive elements (forms, buttons, links)',
      'Includes element attributes and text content',
      'Use to discover available selectors',
      'Helpful for understanding page structure',
      'Large pages may produce large snapshots',
    ],

    performance: {
      speed: '200ms-1s (depends on page complexity)',
      reliability: 'High - works on any loaded page',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler(): Promise<any> {
  const result = await getDOMSnapshot()
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
      inputSchema: {},
    },
    handler, // Use the exported handler
  )
}
