#!/usr/bin/env node

/**
 * Test Manual Submit Mode - The Universal Pattern for AI CLI Interaction
 * 
 * This pattern works with ALL terminal-based AI tools:
 * - Claude CLI
 * - ChatGPT CLI  
 * - Gemini CLI
 * - And any other terminal AI
 * 
 * It mirrors natural human interaction:
 * 1. Type/paste/dictate your message (bulk text)
 * 2. Review and edit if needed
 * 3. Press Enter to submit
 */

async function testManualSubmit() {
  const API_PORT = 9801;
  
  console.log('🎯 Manual Submit Mode - Universal AI CLI Pattern');
  console.log('=' .repeat(60));
  console.log('This pattern works with ALL terminal AI tools:');
  console.log('✅ Claude, ChatGPT, Gemini, and more');
  console.log('✅ Speech-to-text (Wispr Flow, etc.)');
  console.log('✅ Copy-paste workflows');
  console.log('✅ Programmatic text injection');
  console.log('=' .repeat(60));
  
  try {
    // Get agents
    const agentsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
    const agents = await agentsResponse.json();
    
    console.log(`\n📋 Found ${agents.length} active agents`);
    if (agents.length > 0) {
      console.log('Available agents:');
      agents.forEach(a => console.log(`  - ${a.name} (${a.type})`));
    }
    
    // Pick first agent or spawn one
    let testAgent = agents[0];
    
    if (!testAgent) {
      console.log('\n📦 No agents found. Spawning test agent...');
      const spawnResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test-Agent',
          type: 'claude',
          command: 'claude'
        })
      });
      
      const { agent } = await spawnResponse.json();
      testAgent = agent;
      console.log(`✅ Spawned: ${agent.id}`);
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log(`\n🎯 Using agent: ${testAgent.name}`);
    }
    
    // Test the universal pattern
    const testMessage = "This is a test of the manual submit pattern. It works universally across all AI CLIs.";
    
    console.log('\n' + '='.repeat(60));
    console.log('📝 UNIVERSAL PATTERN DEMONSTRATION');
    console.log('='.repeat(60));
    
    // Step 1: Send bulk text
    console.log('\n📤 Step 1: Inject bulk text (like typing or pasting)');
    console.log(`   Text: "${testMessage}"`);
    
    const textResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${testAgent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: testMessage,
        manualSubmit: true  // The universal mode - no auto-Enter
      })
    });
    
    const textResult = await textResponse.json();
    if (textResult.success) {
      console.log('   ✅ Text injected (visible in terminal, not submitted)');
    } else {
      console.log('   ❌ Failed:', textResult.error);
      return;
    }
    
    // Simulate review time
    console.log('\n⏸️ Step 2: Review period (user can read/edit)');
    console.log('   Waiting 2 seconds...');
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 3: Submit with Enter
    console.log('\n⌨️ Step 3: Submit with Enter key');
    const enterResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${testAgent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '\r',
        raw: true
      })
    });
    
    const enterResult = await enterResponse.json();
    if (enterResult.success) {
      console.log('   ✅ Message submitted to AI');
    } else {
      console.log('   ❌ Failed:', enterResult.error);
    }
    
    console.log('\n⏳ Waiting for AI response...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ UNIVERSAL PATTERN SUMMARY');
    console.log('='.repeat(60));
    console.log('\n🎯 This pattern works because:');
    console.log('   1. It mirrors natural human typing');
    console.log('   2. Allows review before submission');
    console.log('   3. Works with ALL terminal AI tools');
    console.log('   4. Compatible with speech-to-text');
    console.log('   5. Supports copy-paste workflows');
    
    console.log('\n📖 API Usage:');
    console.log('   // Send text without auto-submit:');
    console.log('   inject(text, { manualSubmit: true })');
    console.log('');
    console.log('   // Submit with Enter when ready:');
    console.log('   inject("\\r", { raw: true })');
    
    console.log('\n💡 Integration examples:');
    console.log('   - Speech-to-text: Bulk inject transcribed text');
    console.log('   - Copy-paste: Inject clipboard content');
    console.log('   - Automation: Send prepared prompts');
    console.log('   - All cases: User controls when to submit');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Helper function to submit Enter
async function submitMessage(agentId) {
  const API_PORT = 9801;
  
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: '\r',
      raw: true
    })
  });
  
  return response.json();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { submitMessage };
}

// Run test if called directly
if (require.main === module) {
  testManualSubmit();
}