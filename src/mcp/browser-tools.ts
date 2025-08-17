import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getCDPClient } from '../cdp-bridge/cdp-client'
import { logger } from '../utils'

/**
 * Register browser-related MCP tools for Chrome DevTools Protocol
 */
export function addBrowserTools(server: McpServer) {
  server.registerTool(
    'execute_in_browser',
    {
      title: 'Execute JavaScript in Browser',
      description: 'Execute JavaScript code in the browser context via Chrome DevTools Protocol. Requires Chrome to be running or will launch it automatically.',
      inputSchema: {
        expression: z.string().describe('JavaScript expression to execute in the browser'),
        url: z.string().optional().describe('Optional URL to navigate to before executing (e.g., "https://example.com")'),
      },
    },
    async ({ expression, url }) => {
      try {
        const client = getCDPClient()

        // Connect if not already connected
        if (!client.isActive()) {
          logger.info('Connecting to Chrome via CDP...')
          await client.connect()
        }

        // Navigate if URL provided
        if (url) {
          logger.info(`Navigating to: ${url}`)
          await client.navigate(url)
          // Wait a bit for page to load
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Execute the expression
        logger.info(`Executing: ${expression.substring(0, 100)}...`)
        const result = await client.execute(expression)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              result,
              pageInfo: await client.getPageInfo(),
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to execute in browser:', error)
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

  server.registerTool(
    'get_browser_console',
    {
      title: 'Get Browser Console Messages',
      description: 'Get console messages from the browser (log, error, warning, info, debug). Captures all console output since connection.',
      inputSchema: {
        filter: z.enum(['log', 'error', 'warning', 'info', 'debug']).optional().describe('Optional filter for message type'),
        clear: z.boolean().optional().describe('Clear console messages after retrieving (default: false)'),
      },
    },
    async ({ filter, clear }) => {
      try {
        const client = getCDPClient()

        // Connect if not already connected
        if (!client.isActive()) {
          logger.info('Connecting to Chrome via CDP...')
          await client.connect()
        }

        // Get console messages
        const messages = client.getConsoleMessages(filter)

        // Clear if requested
        if (clear) {
          client.clearConsoleMessages()
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              messageCount: messages.length,
              messages: messages.map(msg => ({
                type: msg.type,
                text: msg.text,
                timestamp: new Date(msg.timestamp).toISOString(),
                url: msg.url,
                line: msg.line,
                column: msg.column,
              })),
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to get browser console:', error)
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

  server.registerTool(
    'navigate_browser',
    {
      title: 'Navigate Browser to URL',
      description: 'Navigate the browser to a specific URL and wait for page load.',
      inputSchema: {
        url: z.string().describe('URL to navigate to (e.g., "https://example.com")'),
      },
    },
    async ({ url }) => {
      try {
        const client = getCDPClient()

        // Connect if not already connected
        if (!client.isActive()) {
          logger.info('Connecting to Chrome via CDP...')
          await client.connect()
        }

        // Navigate to URL
        logger.info(`Navigating to: ${url}`)
        await client.navigate(url)

        // Get page info after navigation
        const pageInfo = await client.getPageInfo()

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              navigatedTo: url,
              pageInfo,
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to navigate browser:', error)
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

  server.registerTool(
    'get_dom_snapshot',
    {
      title: 'Get DOM Snapshot',
      description: 'Get a snapshot of the current DOM including forms, links, and images.',
      inputSchema: {},
    },
    async () => {
      try {
        const client = getCDPClient()

        // Connect if not already connected
        if (!client.isActive()) {
          logger.info('Connecting to Chrome via CDP...')
          await client.connect()
        }

        // Get DOM snapshot
        const snapshot = await client.getDOMSnapshot()

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              snapshot,
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to get DOM snapshot:', error)
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

  server.registerTool(
    'click_element',
    {
      title: 'Click Element in Browser',
      description: 'Click an element in the browser using a CSS selector.',
      inputSchema: {
        selector: z.string().describe('CSS selector for the element to click (e.g., "#submit-button", ".menu-item")'),
      },
    },
    async ({ selector }) => {
      try {
        const client = getCDPClient()

        // Connect if not already connected
        if (!client.isActive()) {
          logger.info('Connecting to Chrome via CDP...')
          await client.connect()
        }

        // Click the element
        logger.info(`Clicking element: ${selector}`)
        await client.click(selector)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              clicked: selector,
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to click element:', error)
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

  server.registerTool(
    'type_in_browser',
    {
      title: 'Type Text in Browser Input',
      description: 'Type text into an input field in the browser using a CSS selector.',
      inputSchema: {
        selector: z.string().describe('CSS selector for the input field (e.g., "#username", "input[name=\'email\']")'),
        text: z.string().describe('Text to type into the input field'),
      },
    },
    async ({ selector, text }) => {
      try {
        const client = getCDPClient()

        // Connect if not already connected
        if (!client.isActive()) {
          logger.info('Connecting to Chrome via CDP...')
          await client.connect()
        }

        // Type into the input
        logger.info(`Typing into: ${selector}`)
        await client.type(selector, text)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              typed: text,
              selector,
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to type in browser:', error)
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

  server.registerTool(
    'take_screenshot',
    {
      title: 'Take Browser Screenshot',
      description: 'Take a screenshot of the current browser page.',
      inputSchema: {},
    },
    async () => {
      try {
        const client = getCDPClient()

        // Connect if not already connected
        if (!client.isActive()) {
          logger.info('Connecting to Chrome via CDP...')
          await client.connect()
        }

        // Take screenshot
        logger.info('Taking screenshot...')
        const screenshotBase64 = await client.screenshot()

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              screenshot: `data:image/png;base64,${screenshotBase64}`,
              note: 'Screenshot is base64 encoded PNG image',
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to take screenshot:', error)
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

  server.registerTool(
    'wait_for_element',
    {
      title: 'Wait for Element',
      description: 'Wait for an element to appear in the DOM.',
      inputSchema: {
        selector: z.string().describe('CSS selector for the element to wait for'),
        timeout: z.number().optional().describe('Timeout in milliseconds (default: 5000)'),
      },
    },
    async ({ selector, timeout }) => {
      try {
        const client = getCDPClient()

        // Connect if not already connected
        if (!client.isActive()) {
          logger.info('Connecting to Chrome via CDP...')
          await client.connect()
        }

        // Wait for element
        logger.info(`Waiting for element: ${selector}`)
        await client.waitForSelector(selector, timeout)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              found: selector,
            }, null, 2),
          }],
        }
      }
      catch (error: any) {
        logger.error('Failed to wait for element:', error)
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

  logger.info('Browser tools registered for Chrome DevTools Protocol')
}
