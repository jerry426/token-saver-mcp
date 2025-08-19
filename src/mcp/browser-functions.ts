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
 * Execute JavaScript code in the browser context
 */
export async function executeInBrowser(expression: string, url?: string): Promise<string> {
  try {
    const client = await ensureCDPConnection()

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

    // Try to get page info with timeout
    let pageInfo = null
    try {
      pageInfo = await Promise.race([
        client.getPageInfo(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Page info timeout')), 1000),
        ),
      ])
    }
    catch (err) {
      logger.warn('Could not get page info:', err)
    }

    const response: any = { success: true }
    if (result !== undefined)
      response.result = result
    if (pageInfo)
      response.pageInfo = pageInfo

    return JSON.stringify(response, null, 2)
  }
  catch (error: any) {
    logger.error('Failed to execute in browser:', error)
    return JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2)
  }
}

/**
 * Get console messages from the browser
 */
export async function getBrowserConsole(filter?: 'log' | 'error' | 'warning' | 'info' | 'debug', clear?: boolean): Promise<string> {
  try {
    const client = await ensureCDPConnection()

    // Get console messages
    const messages = client.getConsoleMessages(filter)

    // Clear if requested
    if (clear) {
      client.clearConsoleMessages()
    }

    return JSON.stringify({
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
    }, null, 2)
  }
  catch (error: any) {
    logger.error('Failed to get browser console:', error)
    return JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2)
  }
}

/**
 * Navigate browser to a specific URL
 */
export async function navigateBrowser(url: string): Promise<string> {
  try {
    const client = await ensureCDPConnection()

    // Navigate to URL
    logger.info(`Navigating to: ${url}`)
    await client.navigate(url)

    // Try to get page info, but don't let it block the response
    let pageInfo = null
    try {
      pageInfo = await Promise.race([
        client.getPageInfo(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Page info timeout')), 2000),
        ),
      ])
    }
    catch (err) {
      logger.warn('Could not get page info after navigation:', err)
      pageInfo = { url, title: 'Unknown', readyState: 'unknown' }
    }

    return JSON.stringify({
      success: true,
      navigatedTo: url,
      pageInfo,
    }, null, 2)
  }
  catch (error: any) {
    logger.error('Failed to navigate browser:', error)
    return JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2)
  }
}

/**
 * Get a snapshot of the current DOM
 */
export async function getDOMSnapshot(): Promise<string> {
  try {
    const client = await ensureCDPConnection()

    // Get DOM snapshot
    const snapshot = await client.getDOMSnapshot()

    return JSON.stringify({
      success: true,
      snapshot,
    }, null, 2)
  }
  catch (error: any) {
    logger.error('Failed to get DOM snapshot:', error)
    return JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2)
  }
}

/**
 * Click an element in the browser using a CSS selector
 */
export async function clickElement(selector: string): Promise<string> {
  try {
    const client = await ensureCDPConnection()

    // Click the element
    logger.info(`Clicking element: ${selector}`)
    await client.click(selector)

    return JSON.stringify({
      success: true,
      clicked: selector,
    }, null, 2)
  }
  catch (error: any) {
    logger.error('Failed to click element:', error)
    return JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2)
  }
}

/**
 * Type text into an input field in the browser
 */
export async function typeInBrowser(selector: string, text: string): Promise<string> {
  try {
    const client = await ensureCDPConnection()

    // Type into the input
    logger.info(`Typing into: ${selector}`)
    await client.type(selector, text)

    return JSON.stringify({
      success: true,
      typed: text,
      selector,
    }, null, 2)
  }
  catch (error: any) {
    logger.error('Failed to type in browser:', error)
    return JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2)
  }
}

/**
 * Take a screenshot of the current browser page
 */
export async function takeScreenshot(): Promise<string> {
  try {
    const client = await ensureCDPConnection()

    // Take screenshot
    logger.info('Taking screenshot...')
    const screenshotBase64 = await client.screenshot()

    return JSON.stringify({
      success: true,
      screenshot: `data:image/png;base64,${screenshotBase64}`,
      note: 'Screenshot is base64 encoded PNG image',
    }, null, 2)
  }
  catch (error: any) {
    logger.error('Failed to take screenshot:', error)
    return JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2)
  }
}

/**
 * Wait for an element to appear in the DOM
 */
export async function waitForElement(selector: string, timeout?: number): Promise<string> {
  try {
    const client = await ensureCDPConnection()

    // Wait for element
    logger.info(`Waiting for element: ${selector}`)
    await client.waitForSelector(selector, timeout)

    return JSON.stringify({
      success: true,
      found: selector,
    }, null, 2)
  }
  catch (error: any) {
    logger.error('Failed to wait for element:', error)
    return JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2)
  }
}
