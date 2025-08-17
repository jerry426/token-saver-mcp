/**
 * Simple example of using CDP test helpers
 * Shows how easy it is to control Chrome with the extracted components
 */

const { CDPTestHelper } = require('./cdp-test-helpers')

async function main() {
  console.log('🚀 Simple CDP Example\n')

  const cdp = new CDPTestHelper()

  try {
    // Initialize with Chrome
    await cdp.init({
      port: 9230,
      url: 'https://www.google.com',
    })
    console.log('✅ Connected to Chrome\n')

    // Get page info
    const info = await cdp.getPageInfo()
    console.log('📄 Page Info:')
    console.log(`   Title: ${info.title}`)
    console.log(`   URL: ${info.url}\n`)

    // Execute some JavaScript
    const result = await cdp.execute(`
      Array.from(document.querySelectorAll('input'))
        .map(input => input.name || input.id || 'unnamed')
    `)
    console.log('🔍 Found input fields:', result)

    // Type in search box
    if (result.includes('q')) {
      await cdp.type('input[name="q"]', 'Token Saver MCP')
      console.log('✅ Typed search query\n')
    }

    // Get DOM statistics
    const stats = await cdp.getDOMStats()
    console.log('📊 DOM Statistics:')
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`)
    })

    // Check console messages
    const messages = cdp.getConsole()
    if (messages.length > 0) {
      console.log('\n📝 Console Messages:')
      messages.forEach((msg) => {
        console.log(`   [${msg.type}] ${msg.text}`)
      })
    }
  }
  catch (error) {
    console.error('❌ Error:', error.message)
  }
  finally {
    // Always cleanup
    await cdp.cleanup()
    console.log('\n✅ Cleaned up')
  }
}

// Run the example
main()
