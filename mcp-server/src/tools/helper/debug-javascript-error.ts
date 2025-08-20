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
  name: 'debug_javascript_error',
  title: 'Debug JavaScript Error',
  category: 'helper',
  description: 'Complete JavaScript error debugging and analysis workflow with stack trace analysis and fix recommendations',
  docs: {
    brief: 'Complete JavaScript error debugging and analysis workflow',
    testsAutomatically: [
      'Runtime error capture and stack traces',
      'Console error collection and categorization',
      'Unhandled promise rejection detection',
      'Error source file identification',
      'Framework-specific error patterns',
      'Memory usage during errors',
      'Source map availability',
      'Environment debugging features',
    ],
    savesTimeVsManual: [
      'No need to manually monitor console constantly',
      'Automatically captures all error types',
      'Categorizes errors by common patterns',
      'Identifies error source files',
      'Provides debugging recommendations',
      'Checks for debugging tool availability',
    ],
    integrationWorkflows: [
      'Debug production errors efficiently',
      'Identify error patterns during development',
      'Validate error handling improvements',
      'Test error boundary implementations',
      'Monitor application stability',
      'Automated error reporting',
    ],
    exampleUsage: `debug_javascript_error({ 
  url: "http://localhost:3000/broken-page",
  triggerAction: "document.getElementById('buggy-button').click()",
  waitBeforeTrigger: 2000
})`,
  },
}

export function register(server: McpServer) {
  server.registerTool(
    'debug_javascript_error',
    {
      title: 'Debug JavaScript Error',
      description: 'Capture and analyze JavaScript errors on a page with detailed debugging info',
      inputSchema: {
        url: z.string().describe('URL where error occurs'),
        triggerAction: z.string().optional().describe('JavaScript to trigger the error'),
        waitBeforeTrigger: z.number().optional().describe('Wait time before trigger (ms)'),
      },
    },
    async ({ url, triggerAction, waitBeforeTrigger = 1000 }) => {
      try {
        const client = await ensureCDPConnection()

        // Set up error capture before navigation
        await client.execute(`
          window.__capturedErrors = [];
          window.__originalError = window.onerror;
          window.onerror = function(msg, source, lineno, colno, error) {
            window.__capturedErrors.push({
              message: msg,
              source: source,
              line: lineno,
              column: colno,
              stack: error ? error.stack : 'No stack trace',
              timestamp: Date.now()
            });
            if (window.__originalError) {
              return window.__originalError.apply(this, arguments);
            }
            return false;
          };
          
          window.addEventListener('unhandledrejection', function(event) {
            window.__capturedErrors.push({
              message: 'Unhandled Promise Rejection: ' + event.reason,
              stack: event.reason && event.reason.stack ? event.reason.stack : 'No stack trace',
              timestamp: Date.now(),
              type: 'promise'
            });
          });
        `)

        await client.navigate(url)
        await new Promise(resolve => setTimeout(resolve, waitBeforeTrigger))

        // Clear console to capture fresh errors
        client.clearConsoleMessages()

        // Trigger the error if action provided
        if (triggerAction) {
          try {
            await client.execute(triggerAction)
          }
          catch (triggerError: any) {
            // This is expected - we're triggering an error
            logger.info('Trigger resulted in error (expected):', triggerError.message)
          }
        }

        // Wait for errors to be captured
        await new Promise(resolve => setTimeout(resolve, 500))

        // Collect all errors
        const capturedErrors = await client.execute('window.__capturedErrors || []')
        const consoleErrors = client.getConsoleMessages('error')

        // Analyze errors
        const analysis = await client.execute(`
          (() => {
            const errors = window.__capturedErrors || [];
            const analysis = {
              errorTypes: {},
              commonPatterns: [],
              affectedFiles: new Set(),
              suggestions: []
            };
            
            errors.forEach(err => {
              // Categorize error types
              if (err.message.includes('undefined')) {
                analysis.errorTypes.undefined = (analysis.errorTypes.undefined || 0) + 1;
                analysis.suggestions.push('Check for undefined variables or properties');
              }
              if (err.message.includes('null')) {
                analysis.errorTypes.null = (analysis.errorTypes.null || 0) + 1;
                analysis.suggestions.push('Add null checks before accessing properties');
              }
              if (err.message.includes('TypeError')) {
                analysis.errorTypes.typeError = (analysis.errorTypes.typeError || 0) + 1;
                analysis.suggestions.push('Verify data types and method availability');
              }
              if (err.message.includes('ReferenceError')) {
                analysis.errorTypes.referenceError = (analysis.errorTypes.referenceError || 0) + 1;
                analysis.suggestions.push('Check variable declarations and scope');
              }
              
              // Extract file from stack
              const stackLines = (err.stack || '').split('\\n');
              stackLines.forEach(line => {
                const match = line.match(/\\(([^:)]+):/);
                if (match && !match[1].includes('node_modules')) {
                  analysis.affectedFiles.add(match[1]);
                }
              });
            });
            
            analysis.affectedFiles = Array.from(analysis.affectedFiles);
            analysis.suggestions = [...new Set(analysis.suggestions)];
            
            // Check for common issues
            const hasReact = !!window.React;
            const hasVue = !!window.Vue;
            const hasAngular = !!window.angular;
            
            return {
              errorCount: errors.length,
              analysis,
              framework: {
                react: hasReact,
                vue: hasVue,
                angular: hasAngular
              },
              debugging: {
                hasSourceMaps: document.querySelector('script[src*=".map"]') !== null,
                strictMode: (function() { return !this; })(),
              }
            };
          })()
        `)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              errors: {
                captured: capturedErrors,
                console: consoleErrors.map((e: any) => ({
                  text: e.text,
                  url: e.url,
                  line: e.line,
                })),
                total: capturedErrors.length + consoleErrors.length,
              },
              analysis: analysis.analysis,
              environment: {
                framework: analysis.framework,
                debugging: analysis.debugging,
              },
              recommendations: [
                ...analysis.analysis.suggestions,
                capturedErrors.length > 5 ? 'Multiple errors detected - check initialization order' : null,
                analysis.debugging.hasSourceMaps ? null : 'Enable source maps for better debugging',
              ].filter(Boolean),
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to debug JavaScript error:', error)
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
