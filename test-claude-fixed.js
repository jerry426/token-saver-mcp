#!/usr/bin/env node

async function testClaudeFixed() {
  const API_PORT = 9801;
  const agentId = 'custom-1756108301057';
  
  try {
    console.log('💬 Testing fixed injection to Claude...');
    console.log('   Using normal injection (not raw) which should now use \\r');
    
    const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: 'What is the capital of France?',
        waitForResponse: false
        // NOT using raw: true, so it will use our fixed confirmWithEnter logic
      })
    });
    
    if (response.ok) {
      console.log('✅ Message sent with proper carriage return!');
      console.log('\n📺 Claude should now respond in the terminal');
    } else {
      console.log('❌ Failed to send message');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testClaudeFixed();