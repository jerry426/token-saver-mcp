#!/usr/bin/env node

/**
 * Test sending bulk message text with only the CR sent separately
 * This mimics how Wispr Flow works - bulk text input then manual Enter
 */

async function testBulkWithCR() {
  const API_PORT = 9801;
  
  console.log('🎤 Bulk Text + CR Test (Wispr Flow simulation)');
  console.log('=' .repeat(50));
  
  try {
    // Get list of agents
    const agentsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
    const agents = await agentsResponse.json();
    
    console.log(`\n📋 Found ${agents.length} active agents`);
    
    // Find or spawn Claude agent
    let claudeAgent = agents.find(a => 
      a.type === 'claude' || 
      a.name.toLowerCase().includes('claude') ||
      a.command === 'claude'
    );
    
    if (!claudeAgent) {
      console.log('📦 Spawning Claude agent...');
      const spawnResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Claude-Bulk-Test',
          type: 'claude',
          command: 'claude'
        })
      });
      
      const { agent } = await spawnResponse.json();
      claudeAgent = agent;
      console.log(`✅ Spawned: ${agent.id}`);
      
      // Wait for initialization
      console.log('⏳ Waiting 5s for Claude to initialize...');
      await new Promise(r => setTimeout(r, 5000));
    } else {
      console.log(`✅ Using existing Claude: ${claudeAgent.id}`);
    }
    
    // Test scenarios
    const testScenarios = [
      {
        name: 'Method 1: Bulk text + raw CR',
        message: 'What is the weather like today?',
        steps: [
          { text: 'What is the weather like today?', raw: true },  // Send bulk text
          { text: '\r', raw: true }  // Send just CR
        ]
      },
      {
        name: 'Method 2: Bulk text + char-by-char CR', 
        message: 'Tell me about Paris.',
        steps: [
          { text: 'Tell me about Paris.', raw: true },  // Send bulk text
          { text: String.fromCharCode(13), raw: true, charByChar: true }  // Send CR as single char
        ]
      },
      {
        name: 'Method 3: Bulk text with confirmWithEnter',
        message: 'What is 10 times 10?',
        steps: [
          { text: 'What is 10 times 10?', raw: false }  // Let system add Enter
        ]
      }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🧪 ${scenario.name}`);
      console.log(`💬 Message: "${scenario.message}"`);
      console.log(`📝 Steps: ${scenario.steps.length}`);
      
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        console.log(`\n  Step ${i + 1}: Sending "${step.text.replace(/\r/g, '<CR>').replace(/\n/g, '<LF>')}"${step.charByChar ? ' (char-by-char)' : ''}`);
        
        const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${claudeAgent.id}/inject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: step.text,
            raw: step.raw,
            charByChar: step.charByChar,
            charDelay: step.charByChar ? 0 : undefined
          })
        });
        
        const result = await response.json();
        if (result.success) {
          console.log(`  ✅ Step ${i + 1} sent successfully`);
        } else {
          console.log(`  ❌ Step ${i + 1} failed:`, result.error);
        }
        
        // Small delay between steps
        if (i < scenario.steps.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      // Wait to see if Claude responds
      console.log('\n⏳ Waiting 3s for response...');
      await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Complete!');
    console.log('\n💡 Check the terminal to see which method worked:');
    console.log('   - Method 1: Bulk + raw CR');
    console.log('   - Method 2: Bulk + char-by-char CR');
    console.log('   - Method 3: Bulk with auto-Enter');
    console.log('\n🎤 For Wispr Flow: Use the method that worked best');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testBulkWithCR();