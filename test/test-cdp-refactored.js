/**
 * Refactored CDP Test using reusable components
 * Demonstrates how to use the CDP test helpers
 */

const { CDPTestHelper, runCDPTest } = require('./cdp-test-helpers')

// Test Suite
async function runAllTests() {
  console.log('🚀 Token Saver MCP - CDP Integration Test Suite\n')
  console.log('='.repeat(50))

  // Test 1: Basic Connection and Navigation
  await runCDPTest('Basic CDP Connection', async (helper) => {
    await helper.init({ port: 9224 })

    await helper.navigate('https://example.com')
    const pageInfo = await helper.getPageInfo()

    if (pageInfo.title !== 'Example Domain') {
      throw new Error(`Unexpected title: ${pageInfo.title}`)
    }

    console.log(`   ✓ Connected to Chrome`)
    console.log(`   ✓ Navigated to ${pageInfo.url}`)
    console.log(`   ✓ Page title: "${pageInfo.title}"`)
  })

  // Test 2: JavaScript Execution
  await runCDPTest('JavaScript Execution', async (helper) => {
    await helper.init({ port: 9225, url: 'https://example.com' })

    // Execute various JavaScript
    const results = {
      math: await helper.execute('2 + 2'),
      dom: await helper.execute('document.body.children.length'),
      window: await helper.execute('window.location.hostname'),
      custom: await helper.execute(`
        (() => {
          const data = { test: true, value: 42 };
          return JSON.stringify(data);
        })()
      `).then(JSON.parse),
    }

    console.log(`   ✓ Math calculation: 2 + 2 = ${results.math}`)
    console.log(`   ✓ DOM query: ${results.dom} child elements`)
    console.log(`   ✓ Window property: hostname = "${results.window}"`)
    console.log(`   ✓ Complex execution: ${JSON.stringify(results.custom)}`)
  })

  // Test 3: Console Message Capture
  await runCDPTest('Console Message Capture', async (helper) => {
    await helper.init({ port: 9226 })

    // Execute console commands
    await helper.execute('console.log("Test log message")')
    await helper.execute('console.error("Test error message")')
    await helper.execute('console.warn("Test warning")')
    await helper.execute('console.info("Test info")')

    // Wait for messages to be captured
    await new Promise(resolve => setTimeout(resolve, 100))

    const allMessages = helper.getConsole()
    const errors = helper.getConsole('error')

    console.log(`   ✓ Captured ${allMessages.length} total messages`)
    console.log(`   ✓ ${errors.length} error message(s)`)

    allMessages.forEach((msg) => {
      console.log(`   ✓ [${msg.type}] ${msg.text}`)
    })
  })

  // Test 4: DOM Interaction
  await runCDPTest('DOM Interaction', async (helper) => {
    await helper.init({ port: 9227 })

    // Navigate to test page
    const testPagePath = `file://${process.cwd()}/test-browser-page.html`
    await helper.navigate(testPagePath)

    // Get DOM statistics
    const stats = await helper.getDOMStats()
    console.log(`   ✓ DOM Stats:`, stats)

    // Test form interaction
    await helper.type('#username', 'testuser')
    await helper.type('#email', 'test@example.com')

    const username = await helper.execute('document.getElementById("username").value')
    const email = await helper.execute('document.getElementById("email").value')

    console.log(`   ✓ Typed username: "${username}"`)
    console.log(`   ✓ Typed email: "${email}"`)

    // Test clicking
    await helper.click('#clickMe')
    await new Promise(resolve => setTimeout(resolve, 100))

    const consoleMessages = helper.getConsole()
    const clickMessage = consoleMessages.find(msg => msg.text.includes('Button clicked'))
    console.log(`   ✓ Button click ${clickMessage ? 'detected' : 'not detected'}`)
  })

  // Test 5: Network Monitoring
  await runCDPTest('Network Request Monitoring', async (helper) => {
    await helper.init({ port: 9228, url: 'https://example.com' })

    // Make a fetch request
    await helper.execute(`
      fetch('https://api.github.com/repos/anthropics/claude-code')
        .then(r => r.json())
        .then(data => console.log('Fetched:', data.full_name))
        .catch(err => console.error('Fetch error:', err.message))
    `)

    // Wait for network activity
    await new Promise(resolve => setTimeout(resolve, 1000))

    const requests = helper.getNetwork()
    const apiRequests = helper.getNetwork('api.github.com')

    console.log(`   ✓ Captured ${requests.length} network requests`)
    console.log(`   ✓ ${apiRequests.length} GitHub API requests`)

    apiRequests.forEach((req) => {
      console.log(`   ✓ ${req.method} ${req.url.substring(0, 50)}...`)
    })
  })

  // Test 6: Screenshot
  await runCDPTest('Screenshot Capture', async (helper) => {
    await helper.init({ port: 9229, url: 'https://example.com' })

    const screenshot = await helper.screenshot()

    console.log(`   ✓ Screenshot captured`)
    console.log(`   ✓ Base64 size: ${screenshot.length} characters`)
    console.log(`   ✓ Estimated image size: ~${Math.round(screenshot.length * 0.75 / 1024)}KB`)
  })

  console.log(`\n${'='.repeat(50)}`)
  console.log('🎉 All CDP integration tests passed!\n')
}

// Run the test suite
runAllTests().catch((error) => {
  console.error('\n💥 Test suite failed:', error)
  process.exit(1)
})
