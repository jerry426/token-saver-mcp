#!/usr/bin/env node

/**
 * MCP Connectivity Test Script
 * Tests all critical aspects that made Token Saver MCP work with Claude Code
 */

const http = require('http')

const MCP_PORT = 9700
const MCP_HOST = '127.0.0.1' // Critical: Must be IPv4, not localhost

async function makeRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now()
    })

    const options = {
      hostname: MCP_HOST,
      port: MCP_PORT,
      path: '/mcp', // Critical: Must be /mcp, not /mcp/http
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'mcp-protocol-version': '2024-11-05' // Critical: Include MCP version
      }
    }

    const req = http.request(options, (res) => {
      let responseData = ''
      res.on('data', (chunk) => { responseData += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData))
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${responseData}`))
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function runTests() {
  console.log('🧪 Testing Token Saver MCP Connectivity...\n')
  
  const tests = []
  
  // Test 1: Server reachability on IPv4
  console.log('1️⃣  Testing IPv4 binding (127.0.0.1:9700)...')
  try {
    const response = await makeRequest('initialize')
    if (response.result?.protocolVersion === '2024-11-05') {
      console.log('✅ Server responds on IPv4 address')
      tests.push({ test: 'IPv4 binding', status: 'PASS' })
    } else {
      console.log('❌ Server response invalid')
      tests.push({ test: 'IPv4 binding', status: 'FAIL' })
    }
  } catch (error) {
    console.log(`❌ Cannot reach server on 127.0.0.1:${MCP_PORT}`)
    console.log(`   Error: ${error.message}`)
    tests.push({ test: 'IPv4 binding', status: 'FAIL' })
  }
  
  // Test 2: Correct endpoint path
  console.log('\n2️⃣  Testing endpoint path (/mcp)...')
  try {
    const response = await makeRequest('tools/list')
    if (response.result?.tools) {
      console.log(`✅ Endpoint /mcp responds correctly`)
      tests.push({ test: 'Endpoint path', status: 'PASS' })
    } else {
      console.log('❌ Endpoint response invalid')
      tests.push({ test: 'Endpoint path', status: 'FAIL' })
    }
  } catch (error) {
    console.log('❌ Endpoint /mcp not responding')
    tests.push({ test: 'Endpoint path', status: 'FAIL' })
  }
  
  // Test 3: inputSchema presence (CRITICAL FIX)
  console.log('\n3️⃣  Testing inputSchema in tool definitions...')
  try {
    const response = await makeRequest('tools/list')
    const tools = response.result?.tools || []
    
    if (tools.length === 0) {
      console.log('❌ No tools returned')
      tests.push({ test: 'inputSchema', status: 'FAIL' })
    } else {
      const hasInputSchema = tools.every(tool => 
        tool.inputSchema && 
        tool.inputSchema.type === 'object' &&
        tool.inputSchema.properties !== undefined
      )
      
      if (hasInputSchema) {
        console.log(`✅ All ${tools.length} tools have valid inputSchema`)
        tests.push({ test: 'inputSchema', status: 'PASS' })
      } else {
        console.log('❌ Some tools missing inputSchema')
        tests.push({ test: 'inputSchema', status: 'FAIL' })
      }
    }
  } catch (error) {
    console.log('❌ Cannot verify inputSchema')
    tests.push({ test: 'inputSchema', status: 'FAIL' })
  }
  
  // Test 4: JSON-RPC format (not SSE)
  console.log('\n4️⃣  Testing response format (JSON-RPC, not SSE)...')
  try {
    const response = await makeRequest('tools/call', {
      name: 'get_buffer_stats'
    })
    
    if (response.jsonrpc === '2.0' && response.id) {
      console.log('✅ Returns proper JSON-RPC format')
      tests.push({ test: 'Response format', status: 'PASS' })
    } else {
      console.log('❌ Invalid JSON-RPC format')
      tests.push({ test: 'Response format', status: 'FAIL' })
    }
  } catch (error) {
    console.log('❌ Response format check failed')
    tests.push({ test: 'Response format', status: 'FAIL' })
  }
  
  // Test 5: Tool count
  console.log('\n5️⃣  Testing tool count (should be 30)...')
  try {
    const response = await makeRequest('tools/list')
    const toolCount = response.result?.tools?.length || 0
    
    if (toolCount === 30) {
      console.log('✅ All 30 tools are available')
      tests.push({ test: 'Tool count', status: 'PASS' })
    } else {
      console.log(`⚠️  Found ${toolCount} tools (expected 30)`)
      tests.push({ test: 'Tool count', status: 'WARN' })
    }
  } catch (error) {
    console.log('❌ Cannot count tools')
    tests.push({ test: 'Tool count', status: 'FAIL' })
  }
  
  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 TEST SUMMARY:\n')
  
  const passed = tests.filter(t => t.status === 'PASS').length
  const failed = tests.filter(t => t.status === 'FAIL').length
  const warned = tests.filter(t => t.status === 'WARN').length
  
  tests.forEach(t => {
    const icon = t.status === 'PASS' ? '✅' : t.status === 'FAIL' ? '❌' : '⚠️'
    console.log(`${icon} ${t.test}: ${t.status}`)
  })
  
  console.log('\n' + '='.repeat(50))
  
  if (failed === 0) {
    console.log('🎉 ALL CRITICAL TESTS PASSED!')
    console.log('\n✨ Token Saver MCP is ready for Claude Code!')
    console.log('\n🔑 KEY SUCCESS FACTORS:')
    console.log('   1. Server bound to IPv4 (127.0.0.1), not IPv6')
    console.log('   2. Endpoint path is /mcp (not /mcp/http)')
    console.log('   3. All tools include inputSchema property')
    console.log('   4. Response format is JSON-RPC (not SSE)')
  } else {
    console.log(`⚠️  ${failed} tests failed. MCP may not work with Claude Code.`)
    console.log('\n🔧 FIX REQUIRED:')
    tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`   - Fix: ${t.test}`)
    })
  }
  
  process.exit(failed > 0 ? 1 : 0)
}

// Run tests
runTests().catch(error => {
  console.error('Test script error:', error)
  process.exit(1)
})