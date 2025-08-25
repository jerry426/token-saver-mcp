#!/usr/bin/env node

async function sendEnterToClaude() {
  const API_PORT = 9801;
  const agentId = 'custom-1756108301057';  // Gemini-1 agent with Claude running
  
  try {
    // Try different line ending combinations
    const lineEndings = [
      { name: 'newline (\\n)', value: '\n' },
      { name: 'carriage return + newline (\\r\\n)', value: '\r\n' },
      { name: 'just Enter key', value: '\x0D' },  // ASCII code for Enter
    ];
    
    for (const ending of lineEndings) {
      console.log(`\n💬 Trying ${ending.name}...`);
      
      // First clear any partial input and send fresh message
      const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `Hello Claude! What is 2+2?${ending.value}`,
          raw: true
        })
      });
      
      if (response.ok) {
        console.log(`✅ Sent with ${ending.name}`);
        console.log('⏳ Wait 2 seconds and check the terminal...');
        
        // Wait to see if Claude responds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if agent is ready (would indicate Claude responded)
        const statusResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}`);
        const status = await statusResponse.json();
        
        if (status.ready) {
          console.log('✨ Claude appears to have responded (agent is ready)');
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendEnterToClaude();