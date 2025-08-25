#!/usr/bin/env node

/**
 * Test script for memory verbosity and importance features
 */

async function testVerbosityFeatures() {
  const baseUrl = 'http://127.0.0.1:9700/mcp'

  // Test 1: Write a high-importance, low-verbosity memory
  console.log('\n1. Testing high-importance (5), minimal-verbosity (1) memory:')
  const test1 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'write_memory',
        arguments: {
          key: 'project:critical_info',
          value: 'Database credentials location',
          scope: 'project',
          importance: 5,
          verbosity: 1,
        },
      },
      id: 1,
    }),
  })

  const result1 = await test1.json()
  console.log('Result:', JSON.stringify(result1.result || result1.error, null, 2))

  // Test 2: Write a low-importance, high-verbosity memory
  console.log('\n2. Testing low-importance (1), comprehensive-verbosity (4) memory:')
  const test2 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'write_memory',
        arguments: {
          key: 'discussion:oracle_experience',
          value: {
            topic: 'Oracle database pain points',
            details: 'User shared experience with multi-billion row tables',
            context: 'Discussing flexible vs rigid schemas',
          },
          scope: 'project',
          importance: 1,
          verbosity: 4,
        },
      },
      id: 2,
    }),
  })

  const result2 = await test2.json()
  console.log('Result:', JSON.stringify(result2.result || result2.error, null, 2))

  // Test 3: Smart resume with minimal verbosity
  console.log('\n3. Testing smart_resume with minimal verbosity (1):')
  const test3 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'smart_resume',
        arguments: {
          verbosity: 1,
          minImportance: 4,
        },
      },
      id: 3,
    }),
  })

  const result3 = await test3.json()
  console.log('Should only show critical memories with minimal verbosity')
  console.log('Result preview:', result3.result?.content?.[0]?.text?.substring(0, 500) || result3.error)

  // Test 4: Smart resume with comprehensive verbosity
  console.log('\n4. Testing smart_resume with comprehensive verbosity (4):')
  const test4 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'smart_resume',
        arguments: {
          verbosity: 4,
          minImportance: 1,
        },
      },
      id: 4,
    }),
  })

  const result4 = await test4.json()
  console.log('Should show all memories including discussions')
  console.log('Result preview:', result4.result?.content?.[0]?.text?.substring(0, 500) || result4.error)

  // Test 5: List memories to see importance and verbosity values
  console.log('\n5. Listing all memories to verify metadata:')
  const test5 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'list_memories',
        arguments: {},
      },
      id: 5,
    }),
  })

  const result5 = await test5.json()
  const memories = result5.result?.content?.[0]?.text
  if (memories && memories.includes('project:critical_info')) {
    console.log('✅ Critical memory found with metadata')
  }
  if (memories && memories.includes('discussion:oracle_experience')) {
    console.log('✅ Discussion memory found with metadata')
  }
  console.log('\nMemory list preview:', memories?.substring(0, 1000))
}

// Run tests
testVerbosityFeatures().catch(console.error)
