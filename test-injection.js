#!/usr/bin/env node

/**
 * Test script to demonstrate programmatic injection into AI Terminal Orchestrator
 */

const API_PORT = 9801;

async function getAgents() {
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
  return response.json();
}

async function injectCommand(agentId, command) {
  console.log(`\n📤 Injecting command to agent ${agentId}: "${command}"`);
  
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      prompt: command,
      waitForResponse: false 
    })
  });
  
  if (response.ok) {
    console.log('✅ Command injected successfully');
    return response.json();
  } else {
    console.error('❌ Failed to inject command');
    return null;
  }
}

async function injectRawKeystrokes(agentId, keystrokes) {
  console.log(`\n⌨️  Injecting raw keystrokes to agent ${agentId}: "${keystrokes.replace(/\t/g, '<TAB>')}"`);
  
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      prompt: keystrokes,
      raw: true,
      waitForResponse: false 
    })
  });
  
  if (response.ok) {
    console.log('✅ Keystrokes injected successfully');
    return response.json();
  } else {
    console.error('❌ Failed to inject keystrokes');
    return null;
  }
}

async function testInjection() {
  try {
    console.log('🤖 AI Terminal Orchestrator Injection Test\n');
    console.log('='.repeat(50));
    
    // Get list of agents
    const agents = await getAgents();
    
    if (agents.length === 0) {
      console.log('❌ No agents found. Please spawn an agent first in the UI.');
      return;
    }
    
    console.log(`\n📋 Found ${agents.length} agent(s):`);
    agents.forEach(agent => {
      console.log(`  - ${agent.name} (${agent.id}) - State: ${agent.state}`);
    });
    
    // Use the first agent for testing
    const testAgent = agents[0];
    console.log(`\n🎯 Testing with agent: ${testAgent.name}`);
    
    // Test 1: Inject a simple command
    await injectCommand(testAgent.id, 'echo "Hello from programmatic injection!"');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Inject a command to show current directory
    await injectCommand(testAgent.id, 'pwd');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: List files
    await injectCommand(testAgent.id, 'ls -la');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 4: Create a test file
    await injectCommand(testAgent.id, 'echo "Test content" > test-injection.txt');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 5: Verify the file was created
    await injectCommand(testAgent.id, 'cat test-injection.txt');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 6: Clean up
    await injectCommand(testAgent.id, 'rm test-injection.txt');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 7: Raw keystroke injection - partial command with tab completion
    console.log('\n🔤 Testing raw keystroke injection with tab completion:');
    await injectRawKeystrokes(testAgent.id, 'cd ');
    await new Promise(resolve => setTimeout(resolve, 500));
    await injectRawKeystrokes(testAgent.id, '\t\t');  // Double tab to show options
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n✅ All injection tests completed!');
    console.log('\n💡 Check the terminal UI to see the injected commands and their output.');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Run the test
testInjection();