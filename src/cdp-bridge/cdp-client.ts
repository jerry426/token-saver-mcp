import CDP from 'chrome-remote-interface'
import { logger } from '../utils'
import { BrowserLauncher } from './browser-launcher'

/**
 * CDP Client - Manages Chrome DevTools Protocol connections
 * Provides high-level API for browser interaction
 */

export interface ConsoleMessage {
  type: 'log' | 'error' | 'warning' | 'info' | 'debug'
  text: string
  timestamp: number
  args?: any[]
  stackTrace?: any
  url?: string
  line?: number
  column?: number
}

export interface NetworkRequest {
  requestId: string
  url: string
  method: string
  headers: any
  timestamp: number
  response?: {
    status: number
    headers: any
    body?: string
  }
}

export class CDPClient {
  private client: any = null
  private launcher: BrowserLauncher
  private consoleMessages: ConsoleMessage[] = []
  private networkRequests: Map<string, NetworkRequest> = new Map()
  private maxConsoleMessages = 1000
  private isConnected = false

  constructor(private options: { port?: number, launchBrowser?: boolean } = {}) {
    this.launcher = new BrowserLauncher({
      port: options.port || 9222,
    })
  }

  /**
   * Connect to Chrome DevTools Protocol
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Already connected to CDP')
      return
    }

    // Launch browser if requested
    if (this.options.launchBrowser) {
      await this.launcher.launch()
    }

    try {
      // Connect to Chrome DevTools Protocol
      this.client = await CDP({
        port: this.launcher.getPort(),
      })

      // Enable necessary domains
      await this.enableDomains()

      // Set up event listeners
      this.setupEventListeners()

      this.isConnected = true
      logger.info('Connected to Chrome DevTools Protocol')
    }
    catch (error) {
      logger.error('Failed to connect to CDP:', error)
      throw error
    }
  }

  /**
   * Enable CDP domains we need
   */
  private async enableDomains(): Promise<void> {
    const { Runtime, Console, Page, Network, DOM } = this.client

    await Runtime.enable()
    await Console.enable()
    await Page.enable()
    await Network.enable()
    await DOM.enable()

    logger.info('CDP domains enabled')
  }

  /**
   * Set up event listeners for CDP events
   */
  private setupEventListeners(): void {
    const { Console, Network, Runtime } = this.client

    // Console events
    Console.messageAdded((params: any) => {
      const message: ConsoleMessage = {
        type: this.mapConsoleLevel(params.message.level),
        text: params.message.text,
        timestamp: Date.now(),
        url: params.message.url,
        line: params.message.line,
        column: params.message.column,
        stackTrace: params.message.stackTrace,
      }

      this.consoleMessages.push(message)

      // Trim if too many messages
      if (this.consoleMessages.length > this.maxConsoleMessages) {
        this.consoleMessages = this.consoleMessages.slice(-this.maxConsoleMessages)
      }

      logger.info(`[Browser Console] ${message.type}: ${message.text}`)
    })

    // Network events
    Network.requestWillBeSent((params: any) => {
      const request: NetworkRequest = {
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        headers: params.request.headers,
        timestamp: Date.now(),
      }
      this.networkRequests.set(params.requestId, request)
    })

    Network.responseReceived((params: any) => {
      const request = this.networkRequests.get(params.requestId)
      if (request) {
        request.response = {
          status: params.response.status,
          headers: params.response.headers,
        }
      }
    })

    // Runtime exceptions
    Runtime.exceptionThrown((params: any) => {
      const exception = params.exceptionDetails
      const message: ConsoleMessage = {
        type: 'error',
        text: exception.text || 'Uncaught exception',
        timestamp: Date.now(),
        stackTrace: exception.stackTrace,
      }
      this.consoleMessages.push(message)
      logger.error('[Browser Exception]', exception.text)
    })
  }

  /**
   * Map CDP console levels to our types
   */
  private mapConsoleLevel(level: string): ConsoleMessage['type'] {
    switch (level) {
      case 'error': return 'error'
      case 'warning': return 'warning'
      case 'info': return 'info'
      case 'debug': return 'debug'
      default: return 'log'
    }
  }

  /**
   * Execute JavaScript in the browser
   */
  async execute(expression: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to CDP')
    }

    try {
      const { Runtime } = this.client
      const result = await Runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      })

      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'Execution failed')
      }

      return result.result.value
    }
    catch (error) {
      logger.error('Failed to execute JavaScript:', error)
      throw error
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to CDP')
    }

    const { Page } = this.client
    await Page.navigate({ url })
    await Page.loadEventFired()
    logger.info(`Navigated to: ${url}`)
  }

  /**
   * Get all console messages
   */
  getConsoleMessages(filter?: ConsoleMessage['type']): ConsoleMessage[] {
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
   * Get network requests
   */
  getNetworkRequests(): NetworkRequest[] {
    return Array.from(this.networkRequests.values())
  }

  /**
   * Get DOM snapshot
   */
  async getDOMSnapshot(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to CDP')
    }

    const expression = `
      (() => {
        const snapshot = {
          url: window.location.href,
          title: document.title,
          bodyHTML: document.body.innerHTML.substring(0, 2000),
          forms: Array.from(document.forms).map(f => ({
            name: f.name,
            action: f.action,
            method: f.method,
            fields: Array.from(f.elements).map(e => ({
              name: e.name,
              type: e.type,
              value: e.type === 'password' ? '[hidden]' : e.value
            }))
          })),
          links: Array.from(document.links).slice(0, 50).map(a => ({
            href: a.href,
            text: a.textContent?.trim()
          })),
          images: Array.from(document.images).slice(0, 20).map(img => ({
            src: img.src,
            alt: img.alt
          }))
        }
        return snapshot
      })()
    `

    return await this.execute(expression)
  }

  /**
   * Take a screenshot
   */
  async screenshot(): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Not connected to CDP')
    }

    const { Page } = this.client
    const result = await Page.captureScreenshot({ format: 'png' })
    return result.data // Base64 encoded image
  }

  /**
   * Get current page info
   */
  async getPageInfo(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to CDP')
    }

    const url = await this.execute('window.location.href')
    const title = await this.execute('document.title')
    const readyState = await this.execute('document.readyState')

    return { url, title, readyState }
  }

  /**
   * Click an element (with React support)
   */
  async click(selector: string): Promise<void> {
    const expression = `
      (() => {
        const element = document.querySelector('${selector}')
        if (!element) return false
        
        // Try React onClick first
        const reactPropsKey = Object.keys(element).find(key => 
          key.startsWith('__reactProps') || key.startsWith('__reactFiber')
        )
        
        if (reactPropsKey) {
          const reactProps = element[reactPropsKey]
          if (reactProps && reactProps.onClick) {
            // Create a synthetic event that React expects
            const syntheticEvent = {
              target: element,
              currentTarget: element,
              preventDefault: () => {},
              stopPropagation: () => {},
              nativeEvent: new MouseEvent('click', { bubbles: true, cancelable: true }),
              bubbles: true,
              cancelable: true,
              timeStamp: Date.now(),
              type: 'click'
            }
            reactProps.onClick(syntheticEvent)
            return true
          }
        }
        
        // Fallback to standard click
        element.click()
        return true
      })()
    `

    const clicked = await this.execute(expression)
    if (!clicked) {
      throw new Error(`Element not found: ${selector}`)
    }
  }

  /**
   * Type text into an input (with React support)
   */
  async type(selector: string, text: string): Promise<void> {
    const expression = `
      (() => {
        const element = document.querySelector('${selector}')
        if (!element) return { success: false, error: 'Element not found' }
        
        // Try React-specific approach first
        const reactPropsKey = Object.keys(element).find(key => 
          key.startsWith('__reactProps') || key.startsWith('__reactFiber')
        )
        
        if (reactPropsKey) {
          const reactProps = element[reactPropsKey]
          if (reactProps && reactProps.onChange) {
            // Use React's onChange handler directly
            element.value = '${text.replace(/'/g, '\\\'')}'
            reactProps.onChange({ 
              target: { 
                value: '${text.replace(/'/g, '\\\'')}',
                name: element.name,
                id: element.id
              },
              currentTarget: element,
              bubbles: true,
              cancelable: true
            })
            return { success: true, method: 'react' }
          }
        }
        
        // Fallback to standard DOM events
        element.value = '${text.replace(/'/g, '\\\'')}'
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 
          'value'
        ).set
        nativeInputValueSetter.call(element, '${text.replace(/'/g, '\\\'')}')
        
        // Dispatch events in the correct order for maximum compatibility
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        
        return { success: true, method: 'dom' }
      })()
    `

    const result = await this.execute(expression)
    if (!result.success) {
      throw new Error(`Input not found: ${selector}`)
    }
    
    logger.info(`Typed into ${selector} using ${result.method} method`)
  }

  /**
   * Wait for an element to appear
   */
  async waitForSelector(selector: string, timeout = 5000): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const exists = await this.execute(`!!document.querySelector('${selector}')`)
      if (exists) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error(`Timeout waiting for selector: ${selector}`)
  }

  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected
  }

  /**
   * Disconnect from CDP
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.isConnected = false
      logger.info('Disconnected from CDP')
    }

    if (this.options.launchBrowser) {
      await this.launcher.kill()
    }
  }
}

// Singleton instance
let cdpClient: CDPClient | null = null

export function getCDPClient(): CDPClient {
  if (!cdpClient) {
    cdpClient = new CDPClient({ launchBrowser: true })
  }
  return cdpClient
}
