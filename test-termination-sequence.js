#!/usr/bin/env node

async function testTerminationSequence() {
  const API_PORT = 9801;
  const agentId = 'claude-1756109134729'; // The Claude agent
  
  try {
    console.log('💬 Testing with \\r\\n.\\r\\n termination sequence...');
    
    const message = 'Hello Claude! What is 7+7?';
    const messageWithTermination = message + '\r\n.\r\n';
    
    const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: messageWithTermination,
        raw: true
      })
    });
    
    if (response.ok) {
      console.log('✅ Message sent with \\r\\n.\\r\\n termination');
      console.log('\n📺 Check if this triggers Claude to respond');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testTerminationSequence();