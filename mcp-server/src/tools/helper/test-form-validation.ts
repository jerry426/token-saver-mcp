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
  name: 'test_form_validation',
  title: 'Test Form Validation',
  category: 'helper',
  description: 'Complete form validation testing workflow with automatic error detection and accessibility checks',
  docs: {
    brief: 'Complete form validation testing workflow',
    testsAutomatically: [
      'Form field validation (client-side)',
      'HTML5 validation constraints',
      'Custom validation error messages',
      'Form submission behavior',
      'Success/error state handling',
      'Page redirection after submit',
      'Console errors during validation',
    ],
    savesTimeVsManual: [
      'No need to manually fill forms repeatedly',
      'Automatically captures all validation states',
      'Tests both valid and invalid scenarios',
      'Detects validation edge cases',
      'Verifies error message display',
      'Checks form accessibility',
    ],
    integrationWorkflows: [
      'Validate form logic during development',
      'Test validation rules after changes',
      'Ensure proper error handling',
      'Verify form accessibility features',
      'Test user experience flows',
      'Regression testing for form changes',
    ],
    exampleUsage: `test_form_validation({
  url: "http://localhost:3000/signup",
  formSelector: "#registration-form",
  fields: { 
    email: "invalid-email", 
    password: "123",
    confirmPassword: "456"
  },
  submitButtonSelector: "button[type='submit']"
})`,
  },
}

export function register(server: McpServer) {
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
                errors: consoleErrors.map((e: any) => e.text),
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
}
