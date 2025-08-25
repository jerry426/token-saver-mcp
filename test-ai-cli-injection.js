#!/usr/bin/env node

/**
 * Comprehensive test for AI CLI injection with character-by-character mode
 * Tests different AI CLIs and their specific input requirements
 */

async function testAICliInjection() {
  const API_PORT = 9801;
  
  console.log('🤖 AI CLI Injection Test Suite');
  console.log('=' .repeat(60));
  
  // Configuration for different AI CLIs
  const AI_CONFIGS = {
    claude: {
      command: 'claude',
      charByChar: true,
      charDelay: 50,
      initWait: 5000,
      testMessage: 'What is the capital of France?'
    },
    chatgpt: {
      command: 'chatgpt',
      charByChar: false,  // Test if ChatGPT needs char-by-char
      charDelay: 0,
      initWait: 3000,
      testMessage: 'What is 5 times 7?'
    },
    gemini: {
      command: 'gemini',
      charByChar: false,  // Test if Gemini needs char-by-char
      charDelay: 0,
      initWait: 3000,
      testMessage: 'Tell me about the moon.'
    }
  };
  
  async function testAI(type, config) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${type.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      // Check for existing agent
      const agentsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
      const agents = await agentsResponse.json();
      
      let agent = agents.find(a => a.type === type || a.command === config.command);
      
      if (!agent) {
        console.log(`📦 Spawning ${type} agent...`);
        
        const spawnResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/spawn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${type}-test`,
            type: type,
            command: config.command
          })
        });
        
        const spawnResult = await spawnResponse.json();
        if (!spawnResult.success) {
          console.log(`❌ Failed to spawn ${type}:`, spawnResult.error);
          return false;
        }
        
        agent = spawnResult.agent;
        console.log(`✅ Spawned ${type} agent: ${agent.id}`);
        
        console.log(`⏳ Waiting ${config.initWait}ms for initialization...`);
        await new Promise(r => setTimeout(r, config.initWait));
      } else {
        console.log(`✅ Found existing ${type} agent: ${agent.id}`);
      }
      
      // Check if agent is ready
      console.log('🔍 Checking agent readiness...');
      const statusResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agent.id}`);
      const status = await statusResponse.json();
      console.log(`   Status: ${status.status}`);
      console.log(`   State: ${status.state}`);
      
      // Send test message
      console.log(`\n💬 Sending test message: "${config.testMessage}"`);
      console.log(`   Mode: ${config.charByChar ? 'Character-by-character' : 'Normal'}`);
      if (config.charByChar) {
        console.log(`   Char delay: ${config.charDelay}ms`);
      }
      
      const injectResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agent.id}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: config.testMessage,
          charByChar: config.charByChar,
          charDelay: config.charDelay
        })
      });
      
      const injectResult = await injectResponse.json();
      
      if (injectResult.success) {
        console.log('✅ Message injected successfully');
        
        // Wait to see response
        console.log('⏳ Waiting 5 seconds for response...');
        await new Promise(r => setTimeout(r, 5000));
        
        // Get agent info again to check for response
        const finalStatus = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agent.id}`);
        const finalInfo = await finalStatus.json();
        
        console.log('📊 Final agent status:');
        console.log(`   Status: ${finalInfo.status}`);
        console.log(`   Tasks completed: ${finalInfo.metrics.tasksCompleted}`);
        
        return true;
      } else {
        console.log('❌ Failed to inject message:', injectResult.error);
        return false;
      }
      
    } catch (error) {
      console.log(`❌ Error testing ${type}:`, error.message);
      return false;
    }
  }
  
  // Test each AI CLI
  const results = {};
  
  for (const [type, config] of Object.entries(AI_CONFIGS)) {
    // Ask user if they want to test this AI
    console.log(`\n❓ Test ${type}? (This requires ${config.command} to be installed)`);
    console.log('   Proceeding automatically in 2 seconds...');
    await new Promise(r => setTimeout(r, 2000));
    
    results[type] = await testAI(type, config);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  for (const [type, success] of Object.entries(results)) {
    const icon = success ? '✅' : '❌';
    const status = success ? 'PASSED' : 'FAILED';
    console.log(`${icon} ${type.toUpperCase()}: ${status}`);
  }
  
  console.log('\n💡 Notes:');
  console.log('- Claude requires character-by-character input mode');
  console.log('- Check terminal output to verify AI responses');
  console.log('- Some AIs may need longer initialization times');
  console.log('- Ensure AI CLIs are installed and accessible in PATH');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});

// Check if orchestrator is running
async function checkOrchestrator() {
  try {
    const response = await fetch('http://127.0.0.1:9801/health');
    const health = await response.json();
    console.log('✅ Orchestrator is running');
    console.log(`   Uptime: ${Math.floor(health.uptime)}s`);
    console.log(`   Active agents: ${health.agents}`);
    return true;
  } catch (error) {
    console.error('❌ Orchestrator is not running!');
    console.error('   Run: npm run orchestrator');
    return false;
  }
}

// Main
async function main() {
  if (await checkOrchestrator()) {
    await testAICliInjection();
  }
}

main();