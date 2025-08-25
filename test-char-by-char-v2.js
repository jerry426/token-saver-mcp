#!/usr/bin/env node

async function testCharByCharV2() {
  const API_PORT = 9801;
  
  try {
    // Spawn Claude agent
    console.log('🚀 Spawning Claude agent...');
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
    console.log(`✅ Spawned agent: ${agent.id}\n`);
    
    // Wait for Claude to initialize
    console.log('⏳ Waiting for Claude to start...');
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('💬 Sending message character by character...\n');
    
    const message = 'What is 2+2?';
    
    // Send each character individually
    for (const char of message) {
      process.stdout.write(char); // Show progress
      
      await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agent.id}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: char,
          raw: true
        })
      });
      
      // Small delay between characters to simulate typing
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log('\n\n💬 Now sending Enter key (CR)...');
    
    // Send the Enter key
    await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: String.fromCharCode(13), // Carriage return
        raw: true
      })
    });
    
    console.log('✅ Message sent character by character with CR');
    console.log('\n📺 Check if Claude responds in the terminal');
    console.log('\n📊 You should see in the orchestrator console:');
    console.log('   PTY write: W');
    console.log('   PTY write: h');
    console.log('   PTY write: a');
    console.log('   PTY write: t');
    console.log('   ... (one character at a time)');
    console.log('   PTY write: <CR>');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCharByCharV2();