#!/usr/bin/env node

async function testCharByChar() {
  const API_PORT = 9801;
  
  try {
    // Get the Claude agent
    const agentsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
    const agents = await agentsResponse.json();
    const claudeAgent = agents.find(a => a.name === 'Claude-1');
    
    if (!claudeAgent) {
      console.log('❌ Claude agent not found');
      return;
    }
    
    console.log(`🤖 Found Claude agent: ${claudeAgent.id}`);
    console.log('💬 Sending message character by character...\n');
    
    const message = 'What is 2+2?';
    
    // Send each character individually
    for (const char of message) {
      process.stdout.write(char); // Show progress
      
      await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${claudeAgent.id}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: char,
          raw: true
        })
      });
      
      // Small delay between characters to simulate typing
      await new Promise(r => setTimeout(r, 50));
    }
    
    console.log('\n\n💬 Now sending Enter key (CR)...');
    
    // Send the Enter key
    await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${claudeAgent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: String.fromCharCode(13), // Carriage return
        raw: true
      })
    });
    
    console.log('✅ Message sent character by character with CR');
    console.log('\n📺 Check if Claude responds in the terminal');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCharByChar();