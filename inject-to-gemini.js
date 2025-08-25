#!/usr/bin/env node

async function injectToGemini() {
  const API_PORT = 9801;
  
  try {
    // Get agents
    const agentsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/agents`);
    const agents = await agentsResponse.json();
    
    // Find Gemini agent
    const geminiAgent = agents.find(a => a.name.toLowerCase().includes('gemini'));
    
    if (!geminiAgent) {
      console.log('❌ No Gemini agent found');
      return;
    }
    
    console.log(`\n🤖 Found Gemini agent: ${geminiAgent.name} (${geminiAgent.id})`);
    console.log(`   Status: ${geminiAgent.state}`);
    console.log(`   Ready: ${geminiAgent.ready}`);
    
    // Inject hello message
    console.log('\n💬 Injecting "hello" message to Gemini...');
    
    const response = await fetch(`http://127.0.0.1:${API_PORT}/api/agents/${geminiAgent.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: 'hello',
        waitForResponse: false 
      })
    });
    
    if (response.ok) {
      console.log('✅ Message injected successfully!');
      console.log('\n📺 Check the terminal UI to see Gemini\'s response');
    } else {
      console.log('❌ Failed to inject message');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

injectToGemini();