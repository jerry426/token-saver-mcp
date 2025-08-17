import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { logger } from '../utils'

/**
 * Browser Launcher for Chrome DevTools Protocol
 * Manages launching Chrome/Edge with remote debugging enabled
 */

export interface BrowserLaunchOptions {
  port?: number
  headless?: boolean
  userDataDir?: string
  url?: string
  additionalArgs?: string[]
}

export class BrowserLauncher {
  private browserProcess: ChildProcess | null = null
  private debugPort: number
  private userDataDir: string

  constructor(private options: BrowserLaunchOptions = {}) {
    this.debugPort = options.port || 9222
    this.userDataDir = options.userDataDir || path.join(os.tmpdir(), 'token-saver-mcp-chrome')
  }

  /**
   * Find the Chrome/Edge executable path based on platform
   */
  private findBrowserPath(): string {
    const platform = process.platform

    // Common browser paths by platform
    const paths: { [key: string]: string[] } = {
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ],
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ],
      linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/microsoft-edge',
      ],
    }

    const platformPaths = paths[platform] || []

    // Find first existing browser
    for (const browserPath of platformPaths) {
      if (fs.existsSync(browserPath)) {
        logger.info(`Found browser at: ${browserPath}`)
        return browserPath
      }
    }

    // Fallback to hoping it's in PATH
    if (platform === 'win32') {
      return 'chrome.exe'
    }
    return 'google-chrome'
  }

  /**
   * Launch browser with debugging enabled
   */
  async launch(): Promise<void> {
    if (this.browserProcess) {
      logger.warn('Browser already launched')
      return
    }

    const browserPath = this.findBrowserPath()

    // Ensure user data directory exists
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true })
    }

    // Build launch arguments
    const args = [
      `--remote-debugging-port=${this.debugPort}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ]

    // Add headless mode if requested
    if (this.options.headless) {
      args.push('--headless=new')
    }

    // Add any additional arguments
    if (this.options.additionalArgs) {
      args.push(...this.options.additionalArgs)
    }

    // Add URL to open
    if (this.options.url) {
      args.push(this.options.url)
    }

    logger.info(`Launching browser: ${browserPath}`)
    logger.info(`Debug port: ${this.debugPort}`)
    logger.info(`User data dir: ${this.userDataDir}`)

    // Launch the browser
    this.browserProcess = spawn(browserPath, args, {
      detached: false,
      stdio: 'pipe',
    })

    this.browserProcess.on('error', (error) => {
      logger.error('Failed to launch browser:', error)
      this.browserProcess = null
    })

    this.browserProcess.on('exit', (code, signal) => {
      logger.info(`Browser exited with code ${code} and signal ${signal}`)
      this.browserProcess = null
    })

    // Give browser time to start
    await this.waitForDebugger()
  }

  /**
   * Wait for debugger to be ready
   */
  private async waitForDebugger(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Try to fetch the version info from debugger
        const response = await fetch(`http://localhost:${this.debugPort}/json/version`)
        if (response.ok) {
          const info = await response.json() as any
          logger.info(`Browser debugger ready: ${info.Browser}`)
          return
        }
      }
      catch (e) {
        // Not ready yet
      }

      // Wait 100ms before next attempt
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error('Browser debugger failed to start after 3 seconds')
  }

  /**
   * Get the debug port
   */
  getPort(): number {
    return this.debugPort
  }

  /**
   * Check if browser is running
   */
  isRunning(): boolean {
    return this.browserProcess !== null && !this.browserProcess.killed
  }

  /**
   * Kill the browser process
   */
  async kill(): Promise<void> {
    if (this.browserProcess) {
      logger.info('Killing browser process')
      this.browserProcess.kill('SIGTERM')

      // Give it time to close gracefully
      await new Promise(resolve => setTimeout(resolve, 500))

      // Force kill if still running
      if (this.browserProcess && !this.browserProcess.killed) {
        this.browserProcess.kill('SIGKILL')
      }

      this.browserProcess = null
    }
  }

  /**
   * Get list of available tabs/pages
   */
  async getTargets(): Promise<any[]> {
    try {
      const response = await fetch(`http://localhost:${this.debugPort}/json/list`)
      if (response.ok) {
        return await response.json() as any[]
      }
    }
    catch (error) {
      logger.error('Failed to get browser targets:', error)
    }
    return []
  }
}
