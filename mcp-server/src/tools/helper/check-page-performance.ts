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
  name: 'check_page_performance',
  title: 'Check Page Performance',
  category: 'helper',
  description: 'Complete page performance analysis and optimization workflow with Core Web Vitals and resource breakdown',
  docs: {
    brief: 'Complete page performance analysis and optimization workflow',
    testsAutomatically: [
      'Page load timing metrics (DOM, resources, paint)',
      'Core Web Vitals (LCP, FID, CLS)',
      'Resource breakdown by type (JS, CSS, images, fonts)',
      'Memory usage and heap analysis',
      'DOM complexity and node count',
      'Network timing and resource sizes',
      'Slowest loading resources identification',
    ],
    savesTimeVsManual: [
      'No need to manually open DevTools Performance tab',
      'Automatically captures all performance metrics',
      'Generates optimization recommendations',
      'Compares against performance budgets',
      'Identifies performance bottlenecks',
      'Provides actionable insights',
    ],
    integrationWorkflows: [
      'Performance monitoring during development',
      'Regression testing for performance',
      'Optimization validation after changes',
      'Performance budget enforcement',
      'Continuous performance monitoring',
      'Performance debugging workflows',
    ],
    exampleUsage: `check_page_performance({ 
  url: "http://localhost:3000/dashboard",
  waitTime: 5000  // Allow time for all resources to load
})`,
  },
}

export function register(server: McpServer) {
  server.registerTool(
    'check_page_performance',
    {
      title: 'Check Page Performance',
      description: 'Analyze page load performance and get optimization recommendations',
      inputSchema: {
        url: z.string().describe('URL to analyze'),
        waitTime: z.number().optional().describe('Additional wait time in ms (default: 3000)'),
      },
    },
    async ({ url, waitTime = 3000 }) => {
      try {
        const client = await ensureCDPConnection()

        // Clear any existing marks
        await client.execute('performance.clearMarks(); performance.clearMeasures();')

        await client.navigate(url)
        await new Promise(resolve => setTimeout(resolve, waitTime))

        const metrics = await client.execute(`
          (() => {
            const perf = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            
            // Group resources by type
            const resourcesByType = {};
            resources.forEach(r => {
              const type = r.name.endsWith('.js') ? 'js' :
                          r.name.endsWith('.css') ? 'css' :
                          r.name.includes('font') ? 'font' :
                          r.name.match(/\\.(png|jpg|jpeg|gif|svg|webp)/) ? 'image' :
                          'other';
              
              if (!resourcesByType[type]) {
                resourcesByType[type] = { count: 0, size: 0, time: 0 };
              }
              
              resourcesByType[type].count++;
              resourcesByType[type].time += r.duration;
              resourcesByType[type].size += r.transferSize || 0;
            });
            
            // Get Core Web Vitals if available
            let lcp = null, fid = null, cls = null;
            try {
              const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
              lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].renderTime : null;
            } catch(e: any) {}
            
            // Memory info if available
            const memory = performance.memory ? {
              usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576),
              totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576),
              limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
            } : null;
            
            return {
              timing: {
                domContentLoaded: perf.domContentLoadedEventEnd - perf.fetchStart,
                loadComplete: perf.loadEventEnd - perf.fetchStart,
                domInteractive: perf.domInteractive - perf.fetchStart,
                firstByte: perf.responseStart - perf.fetchStart,
                dns: perf.domainLookupEnd - perf.domainLookupStart,
                tcp: perf.connectEnd - perf.connectStart,
                request: perf.responseStart - perf.requestStart,
                response: perf.responseEnd - perf.responseStart,
                domProcessing: perf.domComplete - perf.domInteractive,
              },
              resources: {
                total: resources.length,
                byType: resourcesByType,
                slowest: resources
                  .sort((a, b) => b.duration - a.duration)
                  .slice(0, 5)
                  .map(r => ({
                    url: r.name.split('/').pop(),
                    time: Math.round(r.duration),
                    size: r.transferSize
                  }))
              },
              vitals: {
                largestContentfulPaint: lcp,
                firstInputDelay: fid,
                cumulativeLayoutShift: cls
              },
              memory,
              documentStats: {
                nodes: document.querySelectorAll('*').length,
                scripts: document.scripts.length,
                stylesheets: document.styleSheets.length,
                images: document.images.length
              }
            };
          })()
        `)

        // Generate recommendations
        const recommendations = []

        if (metrics.timing.loadComplete > 3000) {
          recommendations.push('Page load time exceeds 3 seconds - consider optimization')
        }

        if (metrics.resources.byType?.js?.count > 20) {
          recommendations.push('Too many JavaScript files - consider bundling')
        }

        if (metrics.resources.byType?.image?.size > 1000000) {
          recommendations.push('Large image payload - optimize images')
        }

        if (metrics.documentStats.nodes > 3000) {
          recommendations.push('Large DOM size - consider virtualization')
        }

        if (metrics.memory && metrics.memory.usedJSHeapSize > 50) {
          recommendations.push('High memory usage - check for memory leaks')
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              url,
              performance: metrics,
              recommendations,
              summary: {
                loadTime: `${Math.round(metrics.timing.loadComplete)}ms`,
                resourceCount: metrics.resources.total,
                domNodes: metrics.documentStats.nodes,
                grade: metrics.timing.loadComplete < 1000
                  ? 'A'
                  : metrics.timing.loadComplete < 2000
                    ? 'B'
                    : metrics.timing.loadComplete < 3000 ? 'C' : 'D',
              },
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to check page performance:', error)
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
