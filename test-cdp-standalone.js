const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
// Standalone test script for CDP connection
const CDP = require('chrome-remote-interface')

class BrowserLauncher {
  constructor(port = 9222) {
    this.debugPort = port
    this.userDataDir = path.join(os.tmpdir(), 'token-saver-mcp-test')
    this.browserProcess = null
  }

  findBrowserPath() {
    const platform = process.platform
    const paths = {
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ],
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ],
      linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
      ],
    }

    const platformPaths = paths[platform] || []
    for (const browserPath of platformPaths) {
      if (fs.existsSync(browserPath)) {
        console.log(`Found browser at: ${browserPath}`)
        return browserPath
      }
    }
    return platform === 'win32' ? 'chrome.exe' : 'google-chrome'
  }

  async launch() {
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

    console.log(`Launching browser with debug port ${this.debugPort}...`)
    this.browserProcess = spawn(browserPath, args, {
      detached: false,
      stdio: 'pipe',
    })

    // Wait for debugger to be ready
    await this.waitForDebugger()
  }

  async waitForDebugger(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.debugPort}/json/version`)
        if (response.ok) {
          const info = await response.json()
          console.log(`Browser debugger ready: ${info.Browser}`)
          return
        }
      }
      catch (e) {
        // Not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Browser debugger failed to start')
  }

  kill() {
    if (this.browserProcess) {
      this.browserProcess.kill('SIGTERM')
      this.browserProcess = null
    }
  }
}

async function testCDP() {
  console.log('🚀 Testing Chrome DevTools Protocol connection...\n')

  const launcher = new BrowserLauncher(9223) // Different port to avoid conflicts
  let client = null

  try {
    // Launch Chrome
    console.log('1. Launching Chrome with debugging enabled...')
    await launcher.launch()
    console.log('✅ Chrome launched!\n')

    // Connect via CDP
    console.log('2. Connecting via Chrome DevTools Protocol...')
    client = await CDP({ port: 9223 })
    console.log('✅ Connected to Chrome!\n')

    // Enable necessary domains
    const { Runtime, Console, Page } = client
    await Runtime.enable()
    await Console.enable()
    await Page.enable()

    // Set up console listener
    const consoleMessages = []
    Console.messageAdded((params) => {
      consoleMessages.push({
        type: params.message.level,
        text: params.message.text,
      })
    })

    // Navigate to example.com
    console.log('3. Navigating to example.com...')
    await Page.navigate({ url: 'https://example.com' })
    await Page.loadEventFired()
    console.log('✅ Navigation successful!\n')

    // Execute JavaScript
    console.log('4. Executing JavaScript in browser...')
    let result = await Runtime.evaluate({
      expression: 'document.title',
      returnByValue: true,
    })
    console.log(`✅ Page title: "${result.result.value}"\n`)

    // Test console capture
    console.log('5. Testing console capture...')
    await Runtime.evaluate({
      expression: 'console.log("Hello from browser!"); console.error("Test error");',
    })

    // Wait a bit for messages
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log(`✅ Captured ${consoleMessages.length} console messages:`)
    consoleMessages.forEach((msg) => {
      console.log(`   [${msg.type}] ${msg.text}`)
    })
    console.log('')

    // Get DOM info
    console.log('6. Getting DOM information...')
    result = await Runtime.evaluate({
      expression: `
        JSON.stringify({
          url: window.location.href,
          title: document.title,
          linkCount: document.links.length,
          formCount: document.forms.length
        })
      `,
      returnByValue: true,
    })
    const domInfo = JSON.parse(result.result.value)
    console.log('✅ DOM info:')
    console.log(`   - URL: ${domInfo.url}`)
    console.log(`   - Title: ${domInfo.title}`)
    console.log(`   - Links: ${domInfo.linkCount}`)
    console.log(`   - Forms: ${domInfo.formCount}\n`)

    console.log('🎉 All tests passed! CDP connection is working perfectly.')
    console.log('   Chrome can be controlled programmatically!')
  }
  catch (error) {
    console.error('❌ Test failed:', error.message)
  }
  finally {
    // Cleanup
    console.log('\nCleaning up...')
    if (client) {
      await client.close()
      console.log('✅ CDP connection closed')
    }
    launcher.kill()
    console.log('✅ Chrome process terminated')
  }
}

// Run the test
testCDP().catch(console.error)
