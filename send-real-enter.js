#!/usr/bin/env node

async function sendRealEnter() {
  const API_PORT = 9801;
  const agentId = 'custom-1756108301057';
  
  try {
    // First, let's just send a simple Enter keypress as the terminal would receive it
    console.log('💬 Sending just an Enter key (as if you pressed it)...');
    
    // In terminals, Enter typically sends \r (carriage return, 0x0D)
    // But through xterm.js it might be different
    const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: String.fromCharCode(13),  // ASCII 13 is carriage return (Enter key)
        raw: true
      })
    });
    
    if (response.ok) {
      console.log('✅ Sent Enter key');
      console.log('\nIf the message you typed is still there, this should submit it.');
      console.log('Check the terminal to see if Claude responds.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendRealEnter();