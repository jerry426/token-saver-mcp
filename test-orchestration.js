#!/usr/bin/env node

/**
 * Advanced test demonstrating AI Terminal Orchestrator capabilities
 * - Spawn multiple agents
 * - Inject commands programmatically
 * - Coordinate between agents
 */

const API_PORT = 9801;

async function spawnAgent(name, type = 'custom', command = '/bin/sh') {
  console.log(`\n🚀 Spawning agent: ${name} (${type})`);
  
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, command })
  });
  
  if (response.ok) {
    const result = await response.json();
    console.log(`✅ Agent spawned: ${result.agent.id}`);
    return result.agent;
  } else {
    console.error('❌ Failed to spawn agent');
    return null;
  }
}

async function injectCommand(agentId, command) {
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: command })
  });
  
  return response.ok;
}

async function terminateAgent(agentId) {
  console.log(`\n🔴 Terminating agent: ${agentId}`);
  
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${agentId}`, {
    method: 'DELETE'
  });
  
  if (response.ok) {
    console.log('✅ Agent terminated');
  } else {
    console.error('❌ Failed to terminate agent');
  }
}

async function executeWorkflow(workflow) {
  console.log(`\n🔄 Executing workflow: ${workflow.name}`);
  
  const response = await fetch(`http://127.0.0.1:${API_PORT}/api/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow)
  });
  
  if (response.ok) {
    console.log('✅ Workflow executed successfully');
    return response.json();
  } else {
    console.error('❌ Workflow execution failed');
    return null;
  }
}

async function demonstrateOrchestration() {
  try {
    console.log('🤖 AI Terminal Orchestrator - Advanced Demonstration\n');
    console.log('='.repeat(60));
    
    // Spawn multiple agents
    console.log('\n📦 Phase 1: Spawning Multiple Agents');
    const agent1 = await spawnAgent('worker-1', 'custom', '/bin/sh');
    await new Promise(r => setTimeout(r, 1000));
    
    const agent2 = await spawnAgent('worker-2', 'custom', '/bin/sh');
    await new Promise(r => setTimeout(r, 1000));
    
    if (!agent1 || !agent2) {
      console.error('Failed to spawn agents');
      return;
    }
    
    // Demonstrate parallel execution
    console.log('\n⚡ Phase 2: Parallel Command Execution');
    console.log('Injecting commands to both agents simultaneously...');
    
    await Promise.all([
      injectCommand(agent1.id, 'echo "Agent 1: Starting work..." && sleep 2 && echo "Agent 1: Done!"'),
      injectCommand(agent2.id, 'echo "Agent 2: Starting work..." && sleep 2 && echo "Agent 2: Done!"')
    ]);
    
    console.log('✅ Commands injected to both agents');
    
    // Wait for commands to complete
    await new Promise(r => setTimeout(r, 3000));
    
    // File coordination between agents
    console.log('\n🔗 Phase 3: Agent Coordination');
    console.log('Agent 1 creates a file, Agent 2 reads it...');
    
    await injectCommand(agent1.id, 'echo "Shared data from Agent 1" > /tmp/shared-data.txt');
    await new Promise(r => setTimeout(r, 1000));
    
    await injectCommand(agent2.id, 'cat /tmp/shared-data.txt');
    await new Promise(r => setTimeout(r, 1000));
    
    // System information gathering
    console.log('\n📊 Phase 4: System Information Gathering');
    
    await injectCommand(agent1.id, 'uname -a');
    await new Promise(r => setTimeout(r, 500));
    
    await injectCommand(agent2.id, 'date');
    await new Promise(r => setTimeout(r, 500));
    
    // Workflow execution
    console.log('\n🎯 Phase 5: Workflow Execution');
    
    const workflow = {
      id: 'demo-workflow',
      name: 'System Check Workflow',
      steps: [
        {
          id: 'step1',
          name: 'Check disk usage',
          agent: agent1.id,
          prompt: 'df -h'
        },
        {
          id: 'step2',
          name: 'Check processes',
          agent: agent2.id,
          prompt: 'ps aux | head -10'
        }
      ]
    };
    
    await executeWorkflow(workflow);
    await new Promise(r => setTimeout(r, 2000));
    
    // Clean up
    console.log('\n🧹 Phase 6: Cleanup');
    await injectCommand(agent1.id, 'rm -f /tmp/shared-data.txt');
    await new Promise(r => setTimeout(r, 500));
    
    console.log('\n✨ Demonstration Complete!');
    console.log('\n💡 Key Features Demonstrated:');
    console.log('  ✅ Multiple agent management');
    console.log('  ✅ Parallel command execution');
    console.log('  ✅ Inter-agent coordination');
    console.log('  ✅ Workflow orchestration');
    console.log('  ✅ Full programmatic control');
    
    console.log('\n📌 Note: Keep agents running to interact manually in the UI');
    console.log('   or press Ctrl+C to terminate them.');
    
  } catch (error) {
    console.error('❌ Error during demonstration:', error);
  }
}

// Run the demonstration
demonstrateOrchestration();