#!/usr/bin/env node

async function testDirectCR() {
  const API_PORT = 9801;
  
  try {
    // First spawn a new agent since the old one was terminated
    console.log('🚀 Spawning new Claude agent...');
    
    const spawnResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'claude-test',
        type: 'claude',
        command: 'claude'
      })
    });
    
    const { agent } = await spawnResponse.json();
    console.log(`✅ Spawned agent: ${agent.id}`);
    
    // Wait a moment for Claude to start
    await new Promise(r => setTimeout(r, 2000));
    
    // Now test with raw carriage return
    console.log('\n💬 Sending message with raw carriage return...');
    
    const message = 'Hello Claude! What is 3+3?';
    const messageWithCR = message + String.fromCharCode(13); // Add CR
    
    const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: messageWithCR,
        raw: true  // Send as raw to preserve the CR
      })
    });
    
    if (response.ok) {
      console.log('✅ Message sent with carriage return (ASCII 13)');
      console.log('\n📺 Check the terminal for Claude\'s response');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDirectCR();