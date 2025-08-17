// Simple test script for CDP connection
const { CDPClient } = require('./dist/cdp-bridge/cdp-client.js')

async function testCDP() {
  console.log('🚀 Testing Chrome DevTools Protocol connection...\n')

  const client = new CDPClient({
    port: 9222,
    launchBrowser: true,
  })

  try {
    // Connect to Chrome
    console.log('1. Connecting to Chrome...')
    await client.connect()
    console.log('✅ Connected to Chrome via CDP!\n')

    // Navigate to a test page
    console.log('2. Navigating to example.com...')
    await client.navigate('https://example.com')
    console.log('✅ Navigation successful!\n')

    // Execute JavaScript in the browser
    console.log('3. Executing JavaScript in browser...')
    const title = await client.execute('document.title')
    console.log(`✅ Page title: "${title}"\n`)

    // Get page info
    console.log('4. Getting page info...')
    const pageInfo = await client.getPageInfo()
    console.log('✅ Page info:', pageInfo, '\n')

    // Execute console.log and capture it
    console.log('5. Testing console capture...')
    await client.execute('console.log("Hello from browser!")')
    await client.execute('console.error("Test error message")')
    await new Promise(resolve => setTimeout(resolve, 100)) // Wait for messages

    const messages = client.getConsoleMessages()
    console.log(`✅ Captured ${messages.length} console messages:`)
    messages.forEach((msg) => {
      console.log(`   [${msg.type}] ${msg.text}`)
    })
    console.log('')

    // Get DOM snapshot
    console.log('6. Getting DOM snapshot...')
    const snapshot = await client.getDOMSnapshot()
    console.log('✅ DOM snapshot:')
    console.log(`   - URL: ${snapshot.url}`)
    console.log(`   - Title: ${snapshot.title}`)
    console.log(`   - Links: ${snapshot.links.length} links found`)
    console.log(`   - Images: ${snapshot.images.length} images found\n`)

    console.log('🎉 All tests passed! CDP connection is working perfectly.')
  }
  catch (error) {
    console.error('❌ Test failed:', error.message)
  }
  finally {
    // Disconnect
    console.log('\nDisconnecting...')
    await client.disconnect()
    console.log('✅ Disconnected from Chrome')
  }
}

// Run the test
testCDP().catch(console.error)
