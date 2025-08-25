#!/usr/bin/env node

/**
 * Test Wispr Flow mode - bulk text injection without auto-Enter
 * Simulates how Wispr Flow sends speech-to-text in bulk
 */

async function testWisprFlow() {
  const API_PORT = 9801;
  
  console.log('🎤 Wispr Flow Mode Test');
  console.log('=' .repeat(60));
  console.log('This simulates Wispr Flow speech-to-text injection:');
  console.log('1. Bulk text sent when you stop speaking');
  console.log('2. Manual Enter key press to submit');
  console.log('=' .repeat(60));
  
  try {
    // Get agents
    const agentsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
    const agents = await agentsResponse.json();
    
    let claudeAgent = agents.find(a => 
      a.type === 'claude' || 
      a.name.toLowerCase().includes('claude')
    );
    
    if (!claudeAgent) {
      console.log('\n📦 Spawning Claude agent for test...');
      const spawnResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Claude-Wispr',
          type: 'claude',
          command: 'claude'
        })
      });
      
      const { agent } = await spawnResponse.json();
      claudeAgent = agent;
      console.log(`✅ Spawned: ${agent.id}`);
      await new Promise(r => setTimeout(r, 5000));
    } else {
      console.log(`\n✅ Using existing Claude: ${claudeAgent.id}`);
    }
    
    // Simulate Wispr Flow workflow
    console.log('\n🎙️ Simulating speech input...');
    console.log('   [User speaks into microphone]');
    console.log('   [Wispr converts speech to text]');
    console.log('   [Text appears in input field]');
    
    const speechText = "I'm using Wispr Flow to dictate this message. Can you explain how quantum computing works in simple terms?";
    
    console.log(`\n💬 Bulk text to inject: "${speechText}"`);
    console.log('   Mode: wisprMode (bulk text, no auto-Enter)');
    
    // Step 1: Send bulk text (what happens when Wispr sends the text)
    console.log('\n📤 Step 1: Sending bulk text (Wispr Flow sends this)...');
    const textResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${claudeAgent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: speechText,
        wisprMode: true  // Special mode for Wispr Flow
      })
    });
    
    const textResult = await textResponse.json();
    if (textResult.success) {
      console.log('✅ Text injected (visible in input field)');
    } else {
      console.log('❌ Failed to inject text:', textResult.error);
    }
    
    // Simulate user reviewing the text
    console.log('\n⏸️ Simulating user review (2s)...');
    console.log('   [User can edit text if needed]');
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 2: User manually presses Enter
    console.log('\n⌨️ Step 2: User presses Enter to submit...');
    const enterResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${claudeAgent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '\r',  // Just send carriage return
        raw: true
      })
    });
    
    const enterResult = await enterResponse.json();
    if (enterResult.success) {
      console.log('✅ Enter key sent (message submitted)');
    } else {
      console.log('❌ Failed to send Enter:', enterResult.error);
    }
    
    console.log('\n⏳ Waiting for Claude to respond...');
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Wispr Flow Integration Summary:');
    console.log('');
    console.log('✅ Workflow tested:');
    console.log('   1. Speech → Text (bulk injection with wisprMode: true)');
    console.log('   2. User review period');
    console.log('   3. Manual Enter key (raw CR injection)');
    console.log('');
    console.log('💡 To integrate with Wispr Flow:');
    console.log('   - When text arrives from Wispr: inject with wisprMode: true');
    console.log('   - When user presses Enter: inject "\\r" with raw: true');
    console.log('');
    console.log('🎤 Check the terminal to verify Claude received and responded');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Also provide a manual submit function for testing
async function submitEnter(agentId) {
  const API_PORT = 9801;
  
  console.log('⌨️ Sending Enter key to agent:', agentId);
  
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: '\r',
      raw: true
    })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('✅ Enter key sent');
  } else {
    console.log('❌ Failed:', result.error);
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { submitEnter };
}

// Run test if called directly
if (require.main === module) {
  testWisprFlow();
}