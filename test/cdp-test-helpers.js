/**
 * CDP Test Helpers for JavaScript tests
 * Provides easy-to-use functions for testing CDP integration
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const CDP = require('chrome-remote-interface')

/**
 * Simple browser launcher for testing
 */
class TestBrowserLauncher {
  constructor(port = 9223) {
    this.debugPort = port
    this.userDataDir = path.join(os.tmpdir(), `cdp-test-${Date.now()}`)
    this.browserProcess = null
  }

  findBrowserPath() {
    const platform = process.platform
    const paths = {
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ],
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ],
      linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
      ],
    }

    const platformPaths = paths[platform] || []
    for (const browserPath of platformPaths) {
      if (fs.existsSync(browserPath)) {
        return browserPath
      }
    }
    return platform === 'win32' ? 'chrome.exe' : 'google-chrome'
  }

  async launch(headless = false) {
    const browserPath = this.findBrowserPath()

    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true })
    }

    const args = [
      `--remote-debugging-port=${this.debugPort}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ]

    if (headless) {
      args.push('--headless=new')
    }

    this.browserProcess = spawn(browserPath, args, {
      detached: false,
      stdio: 'pipe',
    })

    await this.waitForDebugger()
    return this.debugPort
  }

  async waitForDebugger(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.debugPort}/json/version`)
        if (response.ok) {
          return true
        }
      }
      catch (e) {
        // Not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Browser debugger failed to start')
  }

  cleanup() {
    if (this.browserProcess) {
      this.browserProcess.kill('SIGTERM')
      this.browserProcess = null
    }

    // Clean up temp directory
    if (fs.existsSync(this.userDataDir)) {
      try {
        fs.rmSync(this.userDataDir, { recursive: true, force: true })
      }
      catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * CDP Test Helper class
 */
class CDPTestHelper {
  constructor() {
    this.launcher = null
    this.client = null
    this.consoleMessages = []
    this.networkRequests = []
  }

  /**
   * Initialize CDP connection
   */
  async init(options = {}) {
    const { port = 9223, headless = false, url = null } = options

    // Launch browser
    this.launcher = new TestBrowserLauncher(port)
    await this.launcher.launch(headless)

    // Connect via CDP
    this.client = await CDP({ port })

    // Enable domains
    const { Runtime, Console, Page, Network } = this.client
    await Runtime.enable()
    await Console.enable()
    await Page.enable()
    await Network.enable()

    // Set up listeners
    this.setupListeners()

    // Navigate to initial URL if provided
    if (url) {
      await this.navigate(url)
    }

    return this
  }

  /**
   * Set up event listeners
   */
  setupListeners() {
    const { Console, Network } = this.client

    // Console messages
    Console.messageAdded((params) => {
      this.consoleMessages.push({
        type: params.message.level,
        text: params.message.text,
        url: params.message.url,
        line: params.message.line,
        timestamp: Date.now(),
      })
    })

    // Network requests
    Network.requestWillBeSent((params) => {
      this.networkRequests.push({
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        timestamp: Date.now(),
      })
    })
  }

  /**
   * Navigate to URL
   */
  async navigate(url) {
    const { Page } = this.client
    await Page.navigate({ url })
    await Page.loadEventFired()
    return this
  }

  /**
   * Execute JavaScript
   */
  async execute(expression) {
    const { Runtime } = this.client
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
   * Wait for element
   */
  async waitFor(selector, timeout = 5000) {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const exists = await this.execute(`!!document.querySelector('${selector}')`)
      if (exists) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error(`Timeout waiting for: ${selector}`)
  }

  /**
   * Click element
   */
  async click(selector) {
    await this.execute(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error('Element not found: ${selector}');
        el.click();
      })()
    `)
    return this
  }

  /**
   * Type into input
   */
  async type(selector, text) {
    await this.execute(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error('Input not found: ${selector}');
        el.value = '${text.replace(/'/g, '\\\'')}';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    return this
  }

  /**
   * Get page info
   */
  async getPageInfo() {
    return await this.execute(`
      JSON.stringify({
        url: window.location.href,
        title: document.title,
        readyState: document.readyState
      })
    `).then(JSON.parse)
  }

  /**
   * Get DOM stats
   */
  async getDOMStats() {
    return await this.execute(`
      JSON.stringify({
        links: document.links.length,
        forms: document.forms.length,
        images: document.images.length,
        scripts: document.scripts.length,
        inputs: document.querySelectorAll('input').length,
        buttons: document.querySelectorAll('button').length
      })
    `).then(JSON.parse)
  }

  /**
   * Take screenshot
   */
  async screenshot() {
    const { Page } = this.client
    const result = await Page.captureScreenshot({ format: 'png' })
    return result.data
  }

  /**
   * Get console messages
   */
  getConsole(filter = null) {
    if (filter) {
      return this.consoleMessages.filter(msg => msg.type === filter)
    }
    return this.consoleMessages
  }

  /**
   * Get network requests
   */
  getNetwork(urlPattern = null) {
    if (urlPattern) {
      const regex = new RegExp(urlPattern)
      return this.networkRequests.filter(req => regex.test(req.url))
    }
    return this.networkRequests
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.consoleMessages = []
    this.networkRequests = []
    return this
  }

  /**
   * Clean up
   */
  async cleanup() {
    if (this.client) {
      await this.client.close()
      this.client = null
    }

    if (this.launcher) {
      this.launcher.cleanup()
      this.launcher = null
    }
  }
}

/**
 * Create a test runner
 */
async function runCDPTest(testName, testFn) {
  console.log(`\n🧪 Running: ${testName}\n`)

  const helper = new CDPTestHelper()

  try {
    await testFn(helper)
    console.log(`✅ Passed: ${testName}\n`)
  }
  catch (error) {
    console.error(`❌ Failed: ${testName}`)
    console.error(`   Error: ${error.message}\n`)
    throw error
  }
  finally {
    await helper.cleanup()
  }
}

// Export for use in tests
module.exports = {
  TestBrowserLauncher,
  CDPTestHelper,
  runCDPTest,
}
