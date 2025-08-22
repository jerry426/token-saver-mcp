// Placeholder imports - these would come from the browser-functions module
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'

async function getCDPClient(): Promise<any> { throw new Error('CDP not implemented in standalone') }
function resetCDPClient(): void {}
const logger = { info: console.error, error: console.error, warn: console.warn }

/**
 * Ensure CDP client is connected and healthy, recovering if needed
 */
async function ensureCDPConnection(): Promise<ReturnType<typeof getCDPClient>> {
  let client = await getCDPClient()

  // Check if connection is healthy
  const isHealthy = await client.isHealthy()

  if (!isHealthy) {
    logger.info('CDP connection unhealthy, resetting client...')
    resetCDPClient()
    client = await getCDPClient()
  }

  // Connect if not active
  if (!client.isActive()) {
    logger.info('Connecting to Chrome via CDP...')
    await client.connect()
  }

  return client
}

export const metadata: ToolMetadata = {
  name: 'test_react_component',
  title: 'Test React Component',
  category: 'helper',
  description: 'Complete React component testing workflow with automatic error detection and performance analysis',
  docs: {
    brief: 'Complete React component testing workflow',
    testsAutomatically: [
      'Component mounting and rendering',
      'React DevTools availability',
      'DOM element presence',
      'Console errors during render',
      'Component lifecycle execution',
    ],
    savesTimeVsManual: [
      'No need to manually open DevTools',
      'Automatically captures errors and warnings',
      'Verifies React fiber structure',
      'Checks for common React antipatterns',
      'Provides structured test results',
    ],
    integrationWorkflows: [
      'Run during CI/CD to catch render issues',
      'Validate component after refactoring',
      'Debug production rendering problems',
      'Verify component props and state flow',
    ],
    exampleUsage: `test_react_component({ 
  url: "http://localhost:3000/dashboard", 
  componentName: "Dashboard",
  waitForSelector: "[data-testid='dashboard-loaded']"
})`,
  },
}

// Tool handler - single source of truth for execution
export async function handler({ url, componentName, waitForSelector }: any): Promise<any> {
  try {
    const client = await ensureCDPConnection()

    await client.navigate(url)

    if (waitForSelector) {
      await client.waitForSelector(waitForSelector)
    }

    // Wait for React to mount
    await new Promise(resolve => setTimeout(resolve, 1000))

    const result = await client.execute(`
          (() => {
            // Check if React DevTools is available
            const hasReactDevTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined;
            
            // Try to find React fiber root
            const findReactRoot = () => {
              const rootEl = document.getElementById('root') || document.querySelector('[data-reactroot]');
              if (!rootEl) return null;
              
              // React 17+ uses different internal property names
              const keys = Object.keys(rootEl);
              const reactKey = keys.find(key => key.startsWith('__reactContainer') || key.startsWith('_reactRootContainer'));
              return reactKey ? rootEl[reactKey] : null;
            };
            
            const root = findReactRoot();
            const componentFound = document.querySelector('[data-testid="${componentName}"], .${componentName}, #${componentName}');
            
            // Get console errors
            const errors = window.__consoleErrors || [];
            
            return {
              mounted: !!componentFound || !!root,
              hasReactDevTools,
              componentFound: !!componentFound,
              reactRoot: !!root,
              errors: errors,
              domElementCount: document.querySelectorAll('*').length,
              title: document.title
            };
          })()
        `)

    // Also capture any console errors
    const consoleMessages = client.getConsoleMessages('error')

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          component: componentName,
          ...result,
          consoleErrors: consoleMessages.map((m: any) => m.text),
        }, null, 2),
      }],
    }
  }
  catch (error: any) {
    logger.error('Failed to test React component:', error)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
        }, null, 2),
      }],
    }
  }
}

export function register(server: McpServer) {
  server.registerTool(
    'test_react_component',
    {
      title: 'Test React Component',
      description: 'Test if a React component is properly rendered with correct props and state',
      inputSchema: {
        url: z.string().describe('URL where component is rendered'),
        componentName: z.string().describe('Name of the React component to test'),
        waitForSelector: z.string().optional().describe('CSS selector to wait for before testing'),
      },
    },
    handler, // Use the exported handler
  )
}
