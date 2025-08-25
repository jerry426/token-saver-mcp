#!/usr/bin/env node

async function sendToClaude() {
  const API_PORT = 9801;
  const agentId = 'custom-1756108301057';  // Gemini-1 agent with Claude running
  
  try {
    console.log('💬 Sending message to Claude with carriage return...');
    
    const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: 'Hello Claude! Can you tell me what 2+2 equals?\r',  // Message with carriage return
        raw: true  // Send as raw to preserve the \r
      })
    });
    
    if (response.ok) {
      console.log('✅ Message sent with carriage return!');
      console.log('\n📺 Check the terminal to see Claude\'s response');
    } else {
      console.log('❌ Failed to send message');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendToClaude();