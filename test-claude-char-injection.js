#!/usr/bin/env node

/**
 * Test script for character-by-character injection to Claude CLI
 * This tests the new charByChar mode that we discovered Claude needs
 */

async function testClaudeCharInjection() {
  const API_PORT = 9801;
  
  console.log('🚀 Claude Character Injection Test');
  console.log('=' .repeat(50));
  
  try {
    // First, get list of agents to find Claude
    console.log('\n📋 Getting list of active agents...');
    const agentsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
    const agents = await agentsResponse.json();
    
    console.log(`Found ${agents.length} active agents:`);
    agents.forEach(agent => {
      console.log(`  - ${agent.name} (${agent.id}) - Type: ${agent.type}`);
    });
    
    // Find a Claude agent
    let claudeAgent = agents.find(a => 
      a.type === 'claude' || 
      a.name.toLowerCase().includes('claude') ||
      a.command === 'claude'
    );
    
    if (!claudeAgent) {
      console.log('\n❌ No Claude agent found. Spawning one...');
      
      // Spawn Claude agent
      const spawnResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Claude-Test',
          type: 'claude',
          command: 'claude'
        })
      });
      
      const { agent } = await spawnResponse.json();
      console.log(`✅ Spawned Claude agent: ${agent.id}`);
      
      // Wait for Claude to initialize
      console.log('⏳ Waiting for Claude to initialize...');
      await new Promise(r => setTimeout(r, 5000));
      
      claudeAgent = agent;
    }
    
    console.log(`\n🤖 Using Claude agent: ${claudeAgent.name} (${claudeAgent.id})`);
    
    // Test messages to send
    const testMessages = [
      { 
        text: 'What is 2+2?', 
        description: 'Simple math question'
      },
      {
        text: 'Tell me a short joke about programming.',
        description: 'Request for a joke'
      }
    ];
    
    for (const message of testMessages) {
      console.log(`\n💬 Sending: "${message.text}"`);
      console.log(`   Mode: Character-by-character with 50ms delay`);
      
      const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${claudeAgent.id}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message.text,
          charByChar: true,  // Use character-by-character mode
          charDelay: 50,     // 50ms delay between characters
          raw: false         // Let it add the Enter key
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Message sent successfully');
      } else {
        console.log('❌ Failed to send message:', result.error);
      }
      
      // Wait a bit to see if Claude responds
      console.log('⏳ Waiting for response...');
      await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log('  - Character-by-character mode: ENABLED');
    console.log('  - Character delay: 50ms');
    console.log('  - Auto-confirm with Enter: YES');
    console.log('  - Messages sent: ' + testMessages.length);
    console.log('\n👀 Check the terminal to see if Claude responded to the messages');
    console.log('💡 If Claude didn\'t respond, try adjusting charDelay or check readiness');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nMake sure:');
    console.error('1. The orchestrator is running (npm run orchestrator)');
    console.error('2. Claude CLI is installed and accessible');
    console.error('3. The API is accessible on port', API_PORT);
  }
}

// Run the test
testClaudeCharInjection();