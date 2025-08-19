import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getCDPClient, resetCDPClient } from '../cdp-bridge/cdp-client'
import { logger } from '../utils'

/**
 * Ensure CDP client is connected and healthy, recovering if needed
 */
async function ensureCDPConnection(): Promise<ReturnType<typeof getCDPClient>> {
  let client = getCDPClient()

  // Check if connection is healthy
  const isHealthy = await client.isHealthy()

  if (!isHealthy) {
    logger.info('CDP connection unhealthy, resetting client...')
    resetCDPClient()
    client = getCDPClient()
  }

  // Connect if not active
  if (!client.isActive()) {
    logger.info('Connecting to Chrome via CDP...')
    await client.connect()
  }

  return client
}

/**
 * High-level browser helper tools that wrap common CDP operations
 * These provide simplified, task-focused interfaces for AI assistants
 */

export function addBrowserHelpers(server: McpServer) {
  /**
   * TEST_REACT_COMPONENT
   *
   * Purpose: Test a React component's rendering and state
   *
   * What it does:
   * 1. Navigates to the component's URL
   * 2. Verifies component mounted
   * 3. Checks React DevTools if available
   * 4. Returns component props and state
   *
   * Example:
   * test_react_component({ url: "http://localhost:3000/dashboard", componentName: "Dashboard" })
   *
   * Returns:
   * - mounted: boolean
   * - props: object
   * - state: object
   * - errors: any console errors
   */
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
    async ({ url, componentName, waitForSelector }) => {
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
              consoleErrors: consoleMessages.map(m => m.text),
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
    },
  )

  /**
   * TEST_API_ENDPOINT
   *
   * Purpose: Test an API endpoint directly from the browser
   *
   * What it does:
   * 1. Navigates to the application
   * 2. Makes a fetch request to the endpoint
   * 3. Captures response status, headers, and body
   * 4. Checks for CORS issues
   *
   * Example:
   * test_api_endpoint({
   *   url: "http://localhost:3000",
   *   endpoint: "/api/users",
   *   method: "GET"
   * })
   *
   * Returns:
   * - status: HTTP status code
   * - data: Response body
   * - headers: Response headers
   * - cors: CORS status
   * - timing: Request duration
   */
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

  /**
   * TEST_FORM_VALIDATION
   *
   * Purpose: Test form validation and submission
   *
   * What it does:
   * 1. Fills form fields with provided data
   * 2. Submits the form
   * 3. Captures validation errors
   * 4. Checks success/failure states
   *
   * Example:
   * test_form_validation({
   *   url: "http://localhost:3000/signup",
   *   formSelector: "#signup-form",
   *   fields: { email: "invalid", password: "123" }
   * })
   *
   * Returns:
   * - submitted: Whether form was submitted
   * - validationErrors: Field-level errors
   * - successMessage: Success indication
   * - redirected: If page changed after submit
   */
  server.registerTool(
    'test_form_validation',
    {
      title: 'Test Form Validation',
      description: 'Test form validation by filling fields and attempting submission',
      inputSchema: {
        url: z.string().describe('URL of the form page'),
        formSelector: z.string().describe('CSS selector for the form'),
        fields: z.record(z.string()).describe('Field name/id to value mapping'),
        submitButtonSelector: z.string().optional().describe('Submit button selector (default: finds submit button)'),
      },
    },
    async ({ url, formSelector, fields, submitButtonSelector }) => {
      try {
        const client = await ensureCDPConnection()

        await client.navigate(url)
        await client.waitForSelector(formSelector)

        // Fill form fields
        for (const [field, value] of Object.entries(fields)) {
          const selector = `${formSelector} [name="${field}"], ${formSelector} #${field}`
          await client.type(selector, value)
        }

        // Clear previous console messages
        client.clearConsoleMessages()

        // Submit form
        const submitSelector = submitButtonSelector || `${formSelector} button[type="submit"], ${formSelector} input[type="submit"]`

        const result = await client.execute(`
          (() => {
            const form = document.querySelector('${formSelector}');
            const submitBtn = document.querySelector('${submitSelector}');
            const initialUrl = window.location.href;
            
            // Collect initial validation state
            const getValidationErrors = () => {
              const errors = {};
              const errorElements = document.querySelectorAll('.error, .error-message, [class*="error"]');
              errorElements.forEach(el => {
                const field = el.closest('[data-field]')?.dataset.field || 
                             el.getAttribute('for') || 
                             'general';
                errors[field] = el.textContent.trim();
              });
              
              // Check HTML5 validation
              const inputs = form.querySelectorAll('input, textarea, select');
              inputs.forEach(input => {
                if (!input.validity.valid) {
                  errors[input.name || input.id] = input.validationMessage;
                }
              });
              
              return errors;
            };
            
            // Check if form is valid before submit
            const isValid = form ? form.checkValidity() : false;
            
            // Trigger submit
            if (submitBtn) {
              submitBtn.click();
            } else if (form) {
              form.requestSubmit();
            }
            
            return {
              formFound: !!form,
              submitButtonFound: !!submitBtn,
              htmlValidation: isValid,
              initialErrors: getValidationErrors(),
              initialUrl: initialUrl
            };
          })()
        `)

        // Wait for form processing
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Check post-submit state
        const postSubmitResult = await client.execute(`
          (() => {
            const currentUrl = window.location.href;
            const form = document.querySelector('${formSelector}');
            
            // Look for success indicators
            const successElements = document.querySelectorAll('.success, .alert-success, [class*="success"]');
            const successMessage = successElements.length > 0 ? 
              Array.from(successElements).map(el => el.textContent.trim()).join(' ') : null;
            
            // Collect validation errors after submit
            const errors = {};
            const errorElements = document.querySelectorAll('.error, .error-message, [class*="error"], .invalid-feedback');
            errorElements.forEach(el => {
              if (el.offsetParent !== null) { // Only visible errors
                const field = el.closest('[data-field]')?.dataset.field || 
                             el.getAttribute('for') || 
                             el.previousElementSibling?.name ||
                             'general';
                errors[field] = el.textContent.trim();
              }
            });
            
            // Check for form field specific errors
            const inputs = form ? form.querySelectorAll('input, textarea, select') : [];
            inputs.forEach(input => {
              if (input.classList.contains('error') || input.classList.contains('invalid')) {
                errors[input.name || input.id] = 'Field has error';
              }
            });
            
            return {
              currentUrl,
              redirected: currentUrl !== '${result.initialUrl}',
              successMessage,
              validationErrors: errors,
              errorCount: Object.keys(errors).length,
              formStillVisible: !!form && form.offsetParent !== null
            };
          })()
        `)

        // Get console errors
        const consoleErrors = client.getConsoleMessages('error')

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              form: {
                found: result.formFound,
                submitted: result.submitButtonFound,
                htmlValid: result.htmlValidation,
              },
              validation: {
                hasErrors: postSubmitResult.errorCount > 0,
                errors: postSubmitResult.validationErrors,
                errorCount: postSubmitResult.errorCount,
              },
              result: {
                redirected: postSubmitResult.redirected,
                successMessage: postSubmitResult.successMessage,
                formStillVisible: postSubmitResult.formStillVisible,
                newUrl: postSubmitResult.redirected ? postSubmitResult.currentUrl : null,
              },
              console: {
                errors: consoleErrors.map(e => e.text),
              },
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to test form validation:', error)
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

  /**
   * CHECK_PAGE_PERFORMANCE
   *
   * Purpose: Analyze page load performance
   *
   * What it does:
   * 1. Navigates to URL
   * 2. Measures key performance metrics
   * 3. Analyzes resource loading
   * 4. Checks for performance issues
   *
   * Example:
   * check_page_performance({ url: "http://localhost:3000" })
   *
   * Returns:
   * - loadTime: Total page load time
   * - domContentLoaded: DOM ready time
   * - resources: Breakdown by resource type
   * - largestContentfulPaint: LCP metric
   * - recommendations: Performance suggestions
   */
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
            } catch(e) {}
            
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

  /**
   * DEBUG_JAVASCRIPT_ERROR
   *
   * Purpose: Debug a JavaScript error on a page
   *
   * What it does:
   * 1. Navigates to the error page
   * 2. Captures all errors
   * 3. Gets stack traces
   * 4. Identifies error source
   * 5. Suggests fixes
   *
   * Example:
   * debug_javascript_error({
   *   url: "http://localhost:3000/broken",
   *   triggerAction: "document.getElementById('button').click()"
   * })
   *
   * Returns:
   * - errors: Array of errors with stack traces
   * - sourceCode: Relevant code around error
   * - suggestions: Potential fixes
   */
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
                console: consoleErrors.map(e => ({
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

  logger.info('Browser helper tools registered')
}
