/**
 * CDP Test Utilities
 * Reusable components for testing Chrome DevTools Protocol integration
 */

import CDP from 'chrome-remote-interface'
import { logger } from '../utils'
import { BrowserLauncher } from './browser-launcher'

export interface TestClient {
  client: any
  launcher: BrowserLauncher
  Runtime: any
  Console: any
  Page: any
  Network: any
  DOM: any
}

export interface ConsoleMessage {
  type: string
  text: string
  timestamp?: number
}

export class CDPTestUtils {
  private consoleMessages: ConsoleMessage[] = []
  private testClient: TestClient | null = null

  /**
   * Initialize a test client with Chrome
   */
  async initTestClient(port = 9223): Promise<TestClient> {
    logger.info(`Initializing CDP test client on port ${port}`)

    // Launch browser
    const launcher = new BrowserLauncher({ port })
    await launcher.launch()

    // Connect via CDP
    const client = await CDP({ port })

    // Get domain references
    const { Runtime, Console, Page, Network, DOM } = client

    // Enable necessary domains
    await Runtime.enable()
    await Console.enable()
    await Page.enable()
    await Network.enable()
    await DOM.enable()

    // Set up console message capture
    Console.messageAdded((params: any) => {
      this.consoleMessages.push({
        type: params.message.level,
        text: params.message.text,
        timestamp: Date.now(),
      })
    })

    this.testClient = {
      client,
      launcher,
      Runtime,
      Console,
      Page,
      Network,
      DOM,
    }

    logger.info('CDP test client initialized successfully')
    return this.testClient
  }

  /**
   * Navigate to a URL and wait for load
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.testClient) {
      throw new Error('Test client not initialized')
    }

    const { Page } = this.testClient
    await Page.navigate({ url })
    await Page.loadEventFired()
    logger.info(`Navigated to: ${url}`)
  }

  /**
   * Execute JavaScript in the browser
   */
  async execute(expression: string): Promise<any> {
    if (!this.testClient) {
      throw new Error('Test client not initialized')
    }

    const { Runtime } = this.testClient
    const result = await Runtime.evaluate({
      expression,
      returnByValue: true,
      awaitPromise: true,
    })

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Execution failed')
    }

    return result.result.value
  }

  /**
   * Get captured console messages
   */
  getConsoleMessages(filter?: string): ConsoleMessage[] {
    if (filter) {
      return this.consoleMessages.filter(msg => msg.type === filter)
    }
    return [...this.consoleMessages]
  }

  /**
   * Clear console messages
   */
  clearConsoleMessages(): void {
    this.consoleMessages = []
  }

  /**
   * Get DOM information
   */
  async getDOMInfo(): Promise<any> {
    const expression = `
      JSON.stringify({
        url: window.location.href,
        title: document.title,
        linkCount: document.links.length,
        formCount: document.forms.length,
        imageCount: document.images.length,
        inputCount: document.querySelectorAll('input').length,
        buttonCount: document.querySelectorAll('button').length
      })
    `

    const result = await this.execute(expression)
    return JSON.parse(result)
  }

  /**
   * Wait for an element to appear
   */
  async waitForSelector(selector: string, timeout = 5000): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const exists = await this.execute(`!!document.querySelector('${selector}')`)
      if (exists) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return false
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<void> {
    const expression = `
      (() => {
        const element = document.querySelector('${selector}')
        if (element) {
          element.click()
          return true
        }
        throw new Error('Element not found: ${selector}')
      })()
    `

    await this.execute(expression)
    logger.info(`Clicked element: ${selector}`)
  }

  /**
   * Type text into an input
   */
  async type(selector: string, text: string): Promise<void> {
    const expression = `
      (() => {
        const element = document.querySelector('${selector}')
        if (element) {
          element.value = '${text.replace(/'/g, '\\\'')}'
          element.dispatchEvent(new Event('input', { bubbles: true }))
          element.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }
        throw new Error('Input not found: ${selector}')
      })()
    `

    await this.execute(expression)
    logger.info(`Typed into ${selector}: ${text}`)
  }

  /**
   * Take a screenshot
   */
  async screenshot(): Promise<string> {
    if (!this.testClient) {
      throw new Error('Test client not initialized')
    }

    const { Page } = this.testClient
    const result = await Page.captureScreenshot({ format: 'png' })
    return result.data // Base64 encoded
  }

  /**
   * Get network requests
   */
  async getNetworkLog(): Promise<any[]> {
    if (!this.testClient) {
      throw new Error('Test client not initialized')
    }

    // This would need to be enhanced with proper network tracking
    // For now, return a placeholder
    return []
  }

  /**
   * Clean up test client
   */
  async cleanup(): Promise<void> {
    if (this.testClient) {
      logger.info('Cleaning up CDP test client')

      // Close CDP connection
      if (this.testClient.client) {
        await this.testClient.client.close()
      }

      // Kill browser
      if (this.testClient.launcher) {
        await this.testClient.launcher.kill()
      }

      this.testClient = null
      this.consoleMessages = []

      logger.info('CDP test client cleaned up')
    }
  }

  /**
   * Run a test with automatic cleanup
   */
  async runTest(
    testName: string,
    testFn: (utils: CDPTestUtils) => Promise<void>,
    port = 9223,
  ): Promise<void> {
    console.log(`\n🧪 Running test: ${testName}\n`)

    try {
      await this.initTestClient(port)
      await testFn(this)
      console.log(`\n✅ Test passed: ${testName}\n`)
    }
    catch (error: any) {
      console.error(`\n❌ Test failed: ${testName}`)
      console.error(`   Error: ${error.message}\n`)
      throw error
    }
    finally {
      await this.cleanup()
    }
  }
}

// Export singleton instance for convenience
export const cdpTestUtils = new CDPTestUtils()
