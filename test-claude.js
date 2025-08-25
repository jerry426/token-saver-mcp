#!/usr/bin/env node

async function testClaude() {
  const API_PORT = 9801;
  
  try {
    // Get agents
    const agentsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
    const agents = await agentsResponse.json();
    
    console.log('Current agents:', agents.map(a => `${a.name} (${a.id})`));
    
    // Find the Gemini-1 agent (which has Claude running in it)
    const claudeAgent = agents.find(a => a.name === 'Gemini-1');
    
    if (!claudeAgent) {
      console.log('❌ Gemini-1 agent not found');
      return;
    }
    
    console.log(`\n🤖 Found agent: ${claudeAgent.name} (${claudeAgent.id})`);
    console.log(`   State: ${claudeAgent.state}`);
    console.log(`   Ready: ${claudeAgent.ready}`);
    
    // Test message to Claude
    console.log('\n💬 Sending test message to Claude...');
    
    const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${claudeAgent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: 'Hello Claude! Can you tell me what 2+2 equals?',
        waitForResponse: false 
      })
    });
    
    if (response.ok) {
      console.log('✅ Message sent successfully!');
      console.log('\n📺 Check the terminal to see Claude\'s response');
      
      // Wait a moment then check readiness
      setTimeout(async () => {
        const statusResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${claudeAgent.id}`);
        const status = await statusResponse.json();
        console.log(`\nAgent ready for next input: ${status.ready}`);
      }, 2000);
      
    } else {
      console.log('❌ Failed to send message');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testClaude();