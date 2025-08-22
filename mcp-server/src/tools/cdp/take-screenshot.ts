import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
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

    parameters: {
      downsample: 'Whether to downsample the image to reduce token usage (default: true)',
      fullPage: 'Whether to capture the full page (default: false)',
      metadataOnly: 'Return only size metadata without the actual image data (default: false)',
      quality: 'Quality preset: low (~12K tokens), medium (~43K tokens), high (~55K tokens), ultra (~70K tokens), custom (default: low)',
      customWidth: 'Custom width in pixels when using quality: "custom" (default: 1200)',
      customQuality: 'Custom JPEG quality 0-100 when using quality: "custom" (default: 85)',
    },

    examples: [
      {
        title: 'Check size estimates for all quality levels',
        code: `// Check size before taking screenshot
const metadata = take_screenshot({ metadataOnly: true })
// Returns estimates for all quality levels

// Try different quality levels
take_screenshot({ quality: 'low' })    // ~10K tokens, fast
take_screenshot({ quality: 'medium' }) // ~25K tokens, balanced
take_screenshot({ quality: 'high' })   // ~40K tokens, detailed`,
      },
      {
        title: 'Basic screenshot',
        code: `// Navigate to page first
navigate_browser({ url: "http://localhost:3000" })

// Take screenshot (downsampled by default)
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
      'Use metadataOnly: true to check size before capturing',
      'Screenshot is downsampled by default to prevent token limits',
      'Downsampled images are JPEG (70% quality, max 800px width)',
      'Full resolution PNG available with downsample: false (check size first!)',
      'Captures full visible viewport',
      'Metadata includes token counts and compression ratios',
    ],

    performance: {
      speed: '200-800ms (depends on page complexity)',
      reliability: 'Very High - works on any page state',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler({
  downsample = true,
  fullPage = false,
  metadataOnly = false,
  quality = 'medium',
  customWidth,
  customQuality,
}: {
  downsample?: boolean
  fullPage?: boolean
  metadataOnly?: boolean
  quality?: 'low' | 'medium' | 'high' | 'ultra' | 'custom'
  customWidth?: number | string
  customQuality?: number | string
} = {}): Promise<any> {
  // Convert string parameters to numbers if needed
  const width = typeof customWidth === 'string' ? Number.parseInt(customWidth, 10) : customWidth
  const jpegQuality = typeof customQuality === 'string' ? Number.parseInt(customQuality, 10) : customQuality

  const result = await takeScreenshot(fullPage, downsample, metadataOnly, quality, width, jpegQuality)
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
        downsample: z.boolean().optional().describe(metadata.docs.parameters?.downsample || 'Whether to downsample the image to reduce token usage (default: true)'),
        fullPage: z.boolean().optional().describe(metadata.docs.parameters?.fullPage || 'Whether to capture the full page (default: false)'),
        metadataOnly: z.boolean().optional().describe(metadata.docs.parameters?.metadataOnly || 'Return only size metadata without the actual image data (default: false)'),
        quality: z.enum(['low', 'medium', 'high', 'ultra', 'custom']).optional().describe(metadata.docs.parameters?.quality || 'Quality preset (default: medium)'),
        customWidth: z.union([z.number(), z.string().transform(v => Number.parseInt(v, 10))]).optional().describe(metadata.docs.parameters?.customWidth || 'Custom width in pixels when using quality: "custom"'),
        customQuality: z.union([z.number(), z.string().transform(v => Number.parseInt(v, 10))]).optional().describe(metadata.docs.parameters?.customQuality || 'Custom JPEG quality 0-100 when using quality: "custom"'),
      },
    },
    handler, // Use the exported handler
  )
}
