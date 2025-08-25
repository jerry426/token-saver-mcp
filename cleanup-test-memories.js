#!/usr/bin/env node

/**
 * Cleanup script to remove all test memories from the database
 */

const API_URL = 'http://127.0.0.1:9700/mcp'

async function callTool(toolName, args = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: Date.now(),
    }),
  })

  const result = await response.json()
  if (result.error) {
    throw new Error(result.error.message || 'Tool call failed')
  }
  return result.result
}

async function cleanupTestMemories() {
  console.log('🧹 Cleaning up test memories...\n')

  try {
    // Get all memories with test pattern
    const listResult = await callTool('list_memories', {
      pattern: 'test*',
      limit: 1000,
    })

    if (!listResult?.content?.[0]?.text) {
      console.log('No test memories found.')
      return
    }

    const text = listResult.content[0].text
    const jsonStart = text.indexOf('[')
    if (jsonStart < 0) {
      console.log('No test memories found.')
      return
    }

    const memories = JSON.parse(text.substring(jsonStart))
    console.log(`Found ${memories.length} test memories to delete.\n`)

    // Also check for other test patterns
    const testPatterns = [
      'test.*', // test.something
      'test-*', // test-something
      'test_*', // test_something
      'test:*', // test:something
      'test/*', // test/something
      'test\\*', // test\something
      'test|*', // test|something
      'test@*', // test@something
      'test#*', // test#something
      'test$*', // test$something
      'test%*', // test%something
      'test^*', // test^something
      'test&*', // test&something
      'test**', // test*something
      'test(*', // test(something
      'test[*', // test[something
      'test{*', // test{something
      'test<*', // test<something
      'test?*', // test?something
      'test!*', // test!something
      'test~*', // test~something
      'test`*', // test`something
      'test\'*', // test'something
      'test"*', // test"something
      'test;*', // test;something
      'test,*', // test,something
      'test *', // test something
    ]

    // Collect all unique test memories
    const allTestMemories = new Map()

    // Add the ones we already found
    for (const memory of memories) {
      allTestMemories.set(`${memory.key}:${memory.scope}`, memory)
    }

    // Check additional patterns
    for (const pattern of testPatterns) {
      try {
        const result = await callTool('list_memories', {
          pattern,
          limit: 1000,
        })

        if (result?.content?.[0]?.text) {
          const text = result.content[0].text
          const jsonStart = text.indexOf('[')
          if (jsonStart >= 0) {
            const moreMemories = JSON.parse(text.substring(jsonStart))
            for (const memory of moreMemories) {
              allTestMemories.set(`${memory.key}:${memory.scope}`, memory)
            }
          }
        }
      }
      catch (e) {
        // Pattern might not work, that's okay
      }
    }

    console.log(`Total unique test memories found: ${allTestMemories.size}\n`)

    // Delete each test memory
    let deleted = 0
    let failed = 0

    for (const memory of allTestMemories.values()) {
      try {
        // Skip non-test memories that might have been caught
        if (!memory.key.toLowerCase().includes('test')) {
          continue
        }

        process.stdout.write(`Deleting: ${memory.key} (${memory.scope})... `)

        await callTool('delete_memory', {
          key: memory.key,
          scope: memory.scope?.toLowerCase(),
        })

        console.log('✓')
        deleted++
      }
      catch (e) {
        console.log('✗')
        failed++
      }
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`\n✅ Cleanup complete!`)
    console.log(`   Deleted: ${deleted} memories`)
    if (failed > 0) {
      console.log(`   Failed: ${failed} memories`)
    }

    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...')
    const verifyResult = await callTool('list_memories', {
      pattern: 'test*',
      limit: 10,
    })

    if (verifyResult?.content?.[0]?.text) {
      const text = verifyResult.content[0].text
      if (text.includes('No memories found') || text.includes('Found 0 memories')) {
        console.log('✅ All test memories successfully removed!')
      }
      else {
        const jsonStart = text.indexOf('[')
        if (jsonStart >= 0) {
          const remaining = JSON.parse(text.substring(jsonStart))
          if (remaining.length > 0) {
            console.log(`⚠️  ${remaining.length} test memories still remain:`)
            for (const mem of remaining.slice(0, 5)) {
              console.log(`   - ${mem.key}`)
            }
            if (remaining.length > 5) {
              console.log(`   ... and ${remaining.length - 5} more`)
            }
          }
          else {
            console.log('✅ All test memories successfully removed!')
          }
        }
      }
    }
  }
  catch (error) {
    console.error('❌ Error during cleanup:', error.message)
    process.exit(1)
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://127.0.0.1:9700/health')
    if (!response.ok) {
      throw new Error('Server not responding')
    }
  }
  catch (error) {
    console.error('❌ MCP server is not running on port 9700')
    console.error('   Run: cd mcp-server && pnpm run dev')
    process.exit(1)
  }
}

// Main
async function main() {
  await checkServer()
  await cleanupTestMemories()
}

main().catch(console.error)
