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
  name: 'test_api_endpoint',
  title: 'Test API Endpoint from Browser',
  category: 'helper',
  description: 'Complete API endpoint testing workflow from browser context with CORS validation and timing analysis',
  docs: {
    brief: 'Complete API endpoint testing workflow from browser context',
    testsAutomatically: [
      'HTTP response status and headers',
      'Response body parsing (JSON/text)',
      'CORS configuration and headers',
      'Network timing and performance',
      'Authentication context preservation',
      'Error handling and status codes',
    ],
    savesTimeVsManual: [
      'No need to manually open DevTools Network tab',
      'Automatically checks CORS configuration',
      'Preserves browser session/cookies',
      'Tests from actual client context',
      'Captures timing metrics automatically',
      'Validates response format',
    ],
    integrationWorkflows: [
      'Test API endpoints during development',
      'Validate CORS setup for frontend integration',
      'Debug authentication flows',
      'Performance testing for API responses',
      'Integration testing with frontend state',
    ],
    exampleUsage: `test_api_endpoint({ 
  url: "http://localhost:3000",
  endpoint: "/api/users/profile",
  method: "POST",
  body: JSON.stringify({ name: "John" }),
  headers: { "Authorization": "Bearer token123" }
})`,
  },
}

export function register(server: McpServer) {
  server.registerTool(
    'test_api_endpoint',
    {
      title: 'Test API Endpoint from Browser',
      description: 'Test an API endpoint from the browser context, checking response and CORS',
      inputSchema: {
        url: z.string().describe('Base URL of the application'),
        endpoint: z.string().describe('API endpoint path (e.g., /api/users)'),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('HTTP method'),
        body: z.string().optional().describe('Request body as JSON string'),
        headers: z.record(z.string()).optional().describe('Additional headers'),
      },
    },
    async ({ url, endpoint, method = 'GET', body, headers }) => {
      try {
        const client = await ensureCDPConnection()

        await client.navigate(url)
        await new Promise(resolve => setTimeout(resolve, 500))

        const result = await client.execute(`
          (async () => {
            const startTime = performance.now();
            const apiUrl = new URL('${endpoint}', window.location.origin).toString();
            
            const options = {
              method: '${method}',
              headers: {
                'Content-Type': 'application/json',
                ...${JSON.stringify(headers || {})}
              },
              ${body ? `body: '${body}',` : ''}
              credentials: 'include'
            };
            
            try {
              const response = await fetch(apiUrl, options);
              const endTime = performance.now();
              
              const responseHeaders = {};
              response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
              });
              
              let data = null;
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                data = await response.json();
              } else {
                data = await response.text();
              }
              
              return {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                data: data,
                timing: endTime - startTime,
                cors: {
                  hasAccessControl: !!responseHeaders['access-control-allow-origin'],
                  allowOrigin: responseHeaders['access-control-allow-origin'],
                  allowCredentials: responseHeaders['access-control-allow-credentials']
                },
                url: response.url
              };
            } catch (error) {
              return {
                error: error.message,
                timing: performance.now() - startTime,
                corsError: error.message.includes('CORS'),
                networkError: error.message.includes('Failed to fetch')
              };
            }
          })()
        `)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: !result.error,
              endpoint,
              method,
              ...result,
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to test API endpoint:', error)
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
    },
  )
}
