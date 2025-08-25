#!/usr/bin/env node

async function testByteSequence() {
  const API_PORT = 9801;
  const agentId = 'claude-1756109134729';
  
  try {
    console.log('💬 Testing with exact byte sequences...');
    
    // Try different approaches
    const tests = [
      {
        name: 'Just CR using fromCharCode',
        prompt: String.fromCharCode(13)
      },
      {
        name: 'CR+LF using fromCharCode',
        prompt: String.fromCharCode(13) + String.fromCharCode(10)
      },
      {
        name: 'Message + CR using fromCharCode',
        prompt: 'What is 9+9?' + String.fromCharCode(13)
      }
    ];
    
    for (const test of tests) {
      console.log(`\n🔬 Testing: ${test.name}`);
      console.log(`   Bytes: ${[...test.prompt].map(c => c.charCodeAt(0)).join(', ')}`);
      
      const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: test.prompt,
          raw: true
        })
      });
      
      if (response.ok) {
        console.log('   ✅ Sent');
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testByteSequence();