#!/usr/bin/env tsx

/**
 * AI CLI Orchestrator
 * 
 * This system provides full visibility and programmatic control over AI CLI tools
 * like Claude, ChatGPT, Gemini, etc. for multi-agent orchestration.
 */

import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { PTYManager } from './src/terminal-wrapper/pty-manager';
import { Logger, LogLevel } from './src/utils/logger';
import { EventEmitter } from 'events';

Logger.setGlobalConfig({
  level: LogLevel.DEBUG,
  console: true
});

const logger = new Logger('AICLIOrchestrator');
const PORT = 9803;
const WS_PORT = 9804;

// AI CLI Detection Patterns
const AI_CLI_PATTERNS = {
  claude: {
    command: 'claude',
    prompts: [/^Human:\s*$/m, /^>\s*$/m, /^You:\s*$/m],
    responses: [/^Assistant:\s*/m, /^Claude:\s*/m],
    ready: [/Type.*message|Enter.*prompt|Ready/i],
    thinking: [/Thinking|Processing|Generating/i]
  },
  chatgpt: {
    command: 'chatgpt',
    prompts: [/^You:\s*$/m, /^User:\s*$/m, /^>\s*$/m],
    responses: [/^ChatGPT:\s*/m, /^Assistant:\s*/m, /^AI:\s*/m],
    ready: [/Ready.*input|Enter.*message/i],
    thinking: [/Thinking|Generating.*response/i]
  },
  gemini: {
    command: 'gemini',
    prompts: [/^>\s*$/m, /^User:\s*$/m],
    responses: [/^Gemini:\s*/m, /^Model:\s*/m],
    ready: [/Enter.*prompt|Ready/i],
    thinking: [/Processing|Thinking/i]
  },
  openai: {
    command: 'openai',
    prompts: [/^>\s*$/m, /^Prompt:\s*$/m],
    responses: [/^Response:\s*/m, /^Output:\s*/m],
    ready: [/Ready|Enter.*prompt/i],
    thinking: [/Generating/i]
  },
  shell: {
    command: 'sh',
    prompts: [/\$\s*$/m, /#\s*$/m, />\s*$/m],
    responses: [/.*/],  // Any output is a response for shell
    ready: [/\$\s*$/m, /#\s*$/m, />\s*$/m],  // Shell prompts indicate ready
    thinking: []  // Shell doesn't have a thinking state
  }
};

interface AIAgent {
  id: string;
  name: string;
  type: string;
  pty: PTYManager;
  state: 'initializing' | 'ready' | 'prompting' | 'thinking' | 'responding' | 'error';
  outputBuffer: string[];
  responseBuffer: string;
  lastPrompt: string;
  lastResponse: string;
  metrics: {
    promptCount: number;
    responseCount: number;
    totalTokensEstimate: number;
    averageResponseTime: number;
    lastActivity: number;
  };
}

interface WorkflowStep {
  agent: string;
  prompt: string;
  waitForResponse: boolean;
  extractPattern?: RegExp;
  saveAs?: string;
  timeout?: number;
}

interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  context: Map<string, string>;
}

class AICLIOrchestrator extends EventEmitter {
  private agents: Map<string, AIAgent> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor() {
    super();
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss = new WebSocketServer({ port: WS_PORT });
    
    this.wss.on('connection', (ws) => {
      logger.info('New WebSocket client connected');
      this.clients.add(ws);
      
      // Send current state
      ws.send(JSON.stringify({
        type: 'state',
        agents: Array.from(this.agents.values()).map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          state: a.state
        }))
      }));
      
      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
    
    logger.info(`WebSocket server listening on port ${WS_PORT}`);
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  async spawnAIAgent(name: string, type: string, command?: string, args?: string[]): Promise<AIAgent> {
    const id = `${type}-${Date.now()}`;
    
    // Use predefined command if not provided
    const cliConfig = AI_CLI_PATTERNS[type as keyof typeof AI_CLI_PATTERNS];
    const actualCommand = command || cliConfig?.command || type;
    
    logger.info(`Spawning AI agent: ${name} (${type}) using command: ${actualCommand}`);
    
    const pty = new PTYManager({
      command: actualCommand,
      args: args || [],
      name: id,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLUMNS: '120',
        LINES: '40'
      }
    });
    
    await pty.spawn();
    
    const agent: AIAgent = {
      id,
      name,
      type,
      pty,
      state: 'initializing',
      outputBuffer: [],
      responseBuffer: '',
      lastPrompt: '',
      lastResponse: '',
      metrics: {
        promptCount: 0,
        responseCount: 0,
        totalTokensEstimate: 0,
        averageResponseTime: 0,
        lastActivity: Date.now()
      }
    };
    
    // Set up output handling
    pty.on('output', (data) => {
      this.handleAgentOutput(agent, data);
    });
    
    pty.on('terminated', () => {
      logger.warn(`Agent ${name} terminated`);
      agent.state = 'error';
      this.broadcast({
        type: 'agent-terminated',
        agentId: id,
        name
      });
    });
    
    this.agents.set(id, agent);
    
    this.broadcast({
      type: 'agent-spawned',
      agent: {
        id,
        name,
        type,
        state: agent.state
      }
    });
    
    return agent;
  }

  private handleAgentOutput(agent: AIAgent, data: string): void {
    // Store raw output
    agent.outputBuffer.push(data);
    if (agent.outputBuffer.length > 1000) {
      agent.outputBuffer.shift();
    }
    
    // Clean for analysis (remove ANSI codes)
    const cleanData = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    
    // Broadcast raw output
    this.broadcast({
      type: 'agent-output',
      agentId: agent.id,
      data: data,
      cleanData: cleanData,
      timestamp: Date.now()
    });
    
    // Detect state changes
    const previousState = agent.state;
    const newState = this.detectAgentState(agent, cleanData);
    
    if (newState !== previousState) {
      agent.state = newState;
      logger.info(`Agent ${agent.name} state: ${previousState} -> ${newState}`);
      
      this.broadcast({
        type: 'state-change',
        agentId: agent.id,
        previousState,
        newState,
        timestamp: Date.now()
      });
      
      this.emit('agent-state-change', {
        agent,
        previousState,
        newState
      });
    }
    
    // Accumulate response if in responding state
    if (agent.state === 'responding') {
      agent.responseBuffer += cleanData;
    }
    
    // Update metrics
    agent.metrics.lastActivity = Date.now();
  }

  private detectAgentState(agent: AIAgent, output: string): AIAgent['state'] {
    const patterns = AI_CLI_PATTERNS[agent.type as keyof typeof AI_CLI_PATTERNS];
    if (!patterns) {
      // For unknown types, check for common shell prompts
      if (/[$#>]\s*$/m.test(output)) {
        return 'ready';
      }
      return agent.state;
    }
    
    // Check for ready/prompt patterns
    for (const pattern of patterns.prompts) {
      if (pattern.test(output)) {
        // Save response if we were responding
        if (agent.state === 'responding' && agent.responseBuffer) {
          agent.lastResponse = agent.responseBuffer;
          agent.responseBuffer = '';
          agent.metrics.responseCount++;
          
          this.emit('response-complete', {
            agent,
            response: agent.lastResponse
          });
        }
        return 'ready';
      }
    }
    
    // Check for thinking patterns
    for (const pattern of patterns.thinking) {
      if (pattern.test(output)) {
        return 'thinking';
      }
    }
    
    // Check for response start patterns
    for (const pattern of patterns.responses) {
      if (pattern.test(output)) {
        agent.responseBuffer = output;
        return 'responding';
      }
    }
    
    // Check for ready messages
    for (const pattern of patterns.ready) {
      if (pattern.test(output)) {
        return 'ready';
      }
    }
    
    // Continue current state if no pattern matched
    return agent.state;
  }

  async injectPrompt(agentId: string, prompt: string, options?: {
    waitForResponse?: boolean;
    timeout?: number;
  }): Promise<{ success: boolean; response?: string }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    logger.info(`Injecting prompt to ${agent.name}: ${prompt.substring(0, 50)}...`);
    
    // Wait for ready state
    if (agent.state !== 'ready') {
      logger.debug(`Waiting for agent ${agent.name} to be ready (current: ${agent.state})`);
      await this.waitForState(agent, 'ready', options?.timeout || 30000);
    }
    
    // Store prompt
    agent.lastPrompt = prompt;
    agent.metrics.promptCount++;
    agent.state = 'prompting';
    
    // Estimate tokens (rough approximation)
    agent.metrics.totalTokensEstimate += Math.ceil(prompt.length / 4);
    
    // Send prompt
    await agent.pty.write(prompt);
    
    // Send enter if prompt doesn't end with newline
    if (!prompt.endsWith('\n')) {
      await agent.pty.write('\n');
    }
    
    this.broadcast({
      type: 'prompt-injected',
      agentId: agent.id,
      prompt: prompt.substring(0, 100),
      timestamp: Date.now()
    });
    
    // Wait for response if requested
    if (options?.waitForResponse) {
      const response = await this.waitForResponse(agent, options.timeout || 60000);
      return { success: true, response };
    }
    
    return { success: true };
  }

  private async waitForState(agent: AIAgent, targetState: AIAgent['state'], timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (agent.state === targetState) {
        resolve();
        return;
      }
      
      const timer = setTimeout(() => {
        this.removeListener('agent-state-change', handler);
        reject(new Error(`Timeout waiting for state ${targetState}`));
      }, timeout);
      
      const handler = (event: any) => {
        if (event.agent.id === agent.id && event.newState === targetState) {
          clearTimeout(timer);
          this.removeListener('agent-state-change', handler);
          resolve();
        }
      };
      
      this.on('agent-state-change', handler);
    });
  }

  private async waitForResponse(agent: AIAgent, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('response-complete', handler);
        reject(new Error('Timeout waiting for response'));
      }, timeout);
      
      const handler = (event: any) => {
        if (event.agent.id === agent.id) {
          clearTimeout(timer);
          this.removeListener('response-complete', handler);
          resolve(event.response);
        }
      };
      
      this.on('response-complete', handler);
    });
  }

  async executeWorkflow(workflow: Workflow): Promise<Map<string, any>> {
    logger.info(`Executing workflow: ${workflow.name}`);
    const results = new Map<string, any>();
    
    for (const step of workflow.steps) {
      logger.debug(`Executing step for agent: ${step.agent}`);
      
      // Find agent
      const agent = Array.from(this.agents.values()).find(a => a.name === step.agent);
      if (!agent) {
        throw new Error(`Agent ${step.agent} not found`);
      }
      
      // Substitute variables in prompt
      let prompt = step.prompt;
      for (const [key, value] of workflow.context) {
        prompt = prompt.replace(`{{${key}}}`, value);
      }
      
      // Inject prompt
      const result = await this.injectPrompt(agent.id, prompt, {
        waitForResponse: step.waitForResponse,
        timeout: step.timeout
      });
      
      // Extract and save if needed
      if (result.response && step.extractPattern) {
        const match = result.response.match(step.extractPattern);
        if (match && step.saveAs) {
          workflow.context.set(step.saveAs, match[0]);
        }
      }
      
      // Save full response if requested
      if (step.saveAs && result.response) {
        workflow.context.set(step.saveAs, result.response);
      }
      
      results.set(`${step.agent}-${Date.now()}`, result);
    }
    
    return results;
  }

  getAgent(agentId: string): AIAgent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AIAgent[] {
    return Array.from(this.agents.values());
  }

  terminateAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.pty.kill();
      this.agents.delete(agentId);
      logger.info(`Terminated agent: ${agent.name}`);
    }
  }

  shutdown(): void {
    logger.info('Shutting down orchestrator');
    for (const agent of this.agents.values()) {
      agent.pty.kill();
    }
    this.agents.clear();
    this.wss.close();
  }
}

// Create Express API
async function createAPI() {
  const app = express();
  app.use(express.json());
  
  const orchestrator = new AICLIOrchestrator();
  
  // Spawn AI agent
  app.post('/api/spawn', async (req, res) => {
    try {
      const { name, type, command, args } = req.body;
      const agent = await orchestrator.spawnAIAgent(name, type, command, args);
      res.json({
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          state: agent.state
        }
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Inject prompt
  app.post('/api/inject', async (req, res) => {
    try {
      const { agentId, prompt, waitForResponse, timeout } = req.body;
      const result = await orchestrator.injectPrompt(agentId, prompt, {
        waitForResponse,
        timeout
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Get agent status
  app.get('/api/agents', (req, res) => {
    const agents = orchestrator.getAllAgents().map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      state: a.state,
      metrics: a.metrics,
      lastPrompt: a.lastPrompt?.substring(0, 50),
      lastResponse: a.lastResponse?.substring(0, 100)
    }));
    res.json(agents);
  });
  
  // Execute workflow
  app.post('/api/workflow', async (req, res) => {
    try {
      const workflow: Workflow = {
        id: `wf-${Date.now()}`,
        name: req.body.name,
        steps: req.body.steps,
        context: new Map(Object.entries(req.body.context || {}))
      };
      
      const results = await orchestrator.executeWorkflow(workflow);
      
      res.json({
        success: true,
        results: Array.from(results.entries())
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Terminate agent
  app.delete('/api/agent/:id', (req, res) => {
    orchestrator.terminateAgent(req.params.id);
    res.json({ success: true });
  });
  
  // Serve UI
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AI CLI Orchestrator</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'SF Mono', Monaco, monospace;
            background: #0a0a0a;
            color: #00ff00;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .header {
            background: linear-gradient(90deg, #1a1a1a, #2a2a2a);
            padding: 15px 20px;
            border-bottom: 2px solid #00ff00;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .header h1 {
            color: #00ff00;
            text-shadow: 0 0 10px #00ff00;
            font-size: 24px;
          }
          
          .main {
            flex: 1;
            display: flex;
            overflow: hidden;
          }
          
          .agents-panel {
            width: 300px;
            background: #111;
            border-right: 1px solid #333;
            overflow-y: auto;
          }
          
          .agent-card {
            padding: 15px;
            border-bottom: 1px solid #222;
            cursor: pointer;
            transition: background 0.3s;
          }
          
          .agent-card:hover {
            background: #1a1a1a;
          }
          
          .agent-card.active {
            background: #1a2a1a;
            border-left: 3px solid #00ff00;
          }
          
          .agent-name {
            color: #00ff00;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .agent-info {
            color: #888;
            font-size: 12px;
          }
          
          .agent-state {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            margin-top: 5px;
          }
          
          .state-ready { background: #0a4a0a; color: #00ff00; }
          .state-thinking { background: #4a4a0a; color: #ffff00; }
          .state-responding { background: #0a0a4a; color: #00ffff; }
          .state-error { background: #4a0a0a; color: #ff0000; }
          
          .terminal-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #000;
          }
          
          .terminal-header {
            background: #1a1a1a;
            padding: 10px;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .terminal-output {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          
          .terminal-input {
            border-top: 1px solid #333;
            padding: 15px;
            display: flex;
            gap: 10px;
          }
          
          .prompt-input {
            flex: 1;
            background: #1a1a1a;
            border: 1px solid #00ff00;
            color: #00ff00;
            padding: 10px;
            font-family: inherit;
            font-size: 14px;
          }
          
          .prompt-input:focus {
            outline: none;
            box-shadow: 0 0 10px #00ff0050;
          }
          
          button {
            background: #00ff00;
            color: #000;
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
          }
          
          button:hover {
            background: #00cc00;
            box-shadow: 0 0 10px #00ff00;
          }
          
          .controls {
            padding: 10px;
            background: #1a1a1a;
            display: flex;
            gap: 10px;
          }
          
          .spawn-form {
            display: flex;
            gap: 10px;
            align-items: center;
          }
          
          .spawn-form input, .spawn-form select {
            background: #0a0a0a;
            border: 1px solid #00ff00;
            color: #00ff00;
            padding: 5px 10px;
          }
          
          .status-bar {
            background: #0a0a0a;
            color: #00ff00;
            padding: 5px 15px;
            border-top: 1px solid #333;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
          }
          
          .output-line {
            margin: 2px 0;
          }
          
          .output-prompt { color: #ffff00; }
          .output-response { color: #00ffff; }
          .output-system { color: #ff00ff; }
          .output-error { color: #ff0000; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🤖 AI CLI Orchestrator</h1>
          <div class="controls">
            <div class="spawn-form">
              <input type="text" id="agent-name" placeholder="Agent name">
              <select id="agent-type">
                <option value="claude">Claude</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom</option>
              </select>
              <input type="text" id="agent-command" placeholder="Command (optional)">
              <button onclick="spawnAgent()">Spawn Agent</button>
            </div>
          </div>
        </div>
        
        <div class="main">
          <div class="agents-panel" id="agents-panel">
            <div style="padding: 15px; color: #666;">
              No agents spawned yet
            </div>
          </div>
          
          <div class="terminal-container">
            <div class="terminal-header">
              <div id="terminal-title">Select an agent</div>
              <div>
                <button onclick="clearTerminal()">Clear</button>
                <button onclick="terminateCurrentAgent()">Terminate</button>
              </div>
            </div>
            
            <div class="terminal-output" id="terminal-output">
              Welcome to AI CLI Orchestrator
              
              This system provides full visibility and control over AI CLI tools.
              
              1. Spawn AI agents using the controls above
              2. Select an agent from the left panel
              3. Send prompts and see responses in real-time
              4. Orchestrate multiple agents programmatically
            </div>
            
            <div class="terminal-input">
              <textarea class="prompt-input" id="prompt-input" 
                placeholder="Enter prompt for selected agent..." 
                rows="3"></textarea>
              <button onclick="sendPrompt()">Send</button>
              <button onclick="sendPromptWaitResponse()">Send & Wait</button>
            </div>
          </div>
        </div>
        
        <div class="status-bar">
          <span id="status-left">Ready</span>
          <span id="status-right">
            WebSocket: <span id="ws-status">Connecting...</span> | 
            Agents: <span id="agent-count">0</span>
          </span>
        </div>
        
        <script>
          const WS_URL = 'ws://localhost:${WS_PORT}';
          let ws = null;
          let currentAgentId = null;
          const agents = new Map();
          const terminalOutputs = new Map();
          
          function connectWebSocket() {
            ws = new WebSocket(WS_URL);
            
            ws.onopen = () => {
              console.log('WebSocket connected');
              document.getElementById('ws-status').textContent = 'Connected';
              document.getElementById('ws-status').style.color = '#00ff00';
            };
            
            ws.onmessage = (event) => {
              const data = JSON.parse(event.data);
              handleWebSocketMessage(data);
            };
            
            ws.onerror = (error) => {
              console.error('WebSocket error:', error);
              document.getElementById('ws-status').textContent = 'Error';
              document.getElementById('ws-status').style.color = '#ff0000';
            };
            
            ws.onclose = () => {
              document.getElementById('ws-status').textContent = 'Disconnected';
              document.getElementById('ws-status').style.color = '#ff0000';
              setTimeout(connectWebSocket, 3000);
            };
          }
          
          function handleWebSocketMessage(data) {
            switch(data.type) {
              case 'state':
                data.agents.forEach(agent => {
                  agents.set(agent.id, agent);
                });
                updateAgentsPanel();
                break;
                
              case 'agent-spawned':
                agents.set(data.agent.id, data.agent);
                terminalOutputs.set(data.agent.id, '');
                updateAgentsPanel();
                selectAgent(data.agent.id);
                break;
                
              case 'agent-output':
                const output = terminalOutputs.get(data.agentId) || '';
                terminalOutputs.set(data.agentId, output + data.data);
                
                if (data.agentId === currentAgentId) {
                  appendToTerminal(data.data);
                }
                break;
                
              case 'state-change':
                const agent = agents.get(data.agentId);
                if (agent) {
                  agent.state = data.newState;
                  updateAgentsPanel();
                }
                break;
                
              case 'agent-terminated':
                agents.delete(data.agentId);
                terminalOutputs.delete(data.agentId);
                updateAgentsPanel();
                if (data.agentId === currentAgentId) {
                  currentAgentId = null;
                  document.getElementById('terminal-title').textContent = 'Agent terminated';
                }
                break;
            }
          }
          
          function updateAgentsPanel() {
            const panel = document.getElementById('agents-panel');
            
            if (agents.size === 0) {
              panel.innerHTML = '<div style="padding: 15px; color: #666;">No agents spawned yet</div>';
              document.getElementById('agent-count').textContent = '0';
              return;
            }
            
            panel.innerHTML = '';
            agents.forEach((agent, id) => {
              const card = document.createElement('div');
              card.className = 'agent-card' + (id === currentAgentId ? ' active' : '');
              card.onclick = () => selectAgent(id);
              
              card.innerHTML = \`
                <div class="agent-name">\${agent.name}</div>
                <div class="agent-info">
                  Type: \${agent.type}<br>
                  ID: \${id.substring(0, 8)}...
                </div>
                <div class="agent-state state-\${agent.state}">\${agent.state}</div>
              \`;
              
              panel.appendChild(card);
            });
            
            document.getElementById('agent-count').textContent = agents.size;
          }
          
          function selectAgent(agentId) {
            currentAgentId = agentId;
            const agent = agents.get(agentId);
            
            if (agent) {
              document.getElementById('terminal-title').textContent = 
                \`\${agent.name} (\${agent.type}) - \${agent.state}\`;
              
              const output = terminalOutputs.get(agentId) || '';
              document.getElementById('terminal-output').textContent = output;
            }
            
            updateAgentsPanel();
          }
          
          function appendToTerminal(text) {
            const terminal = document.getElementById('terminal-output');
            terminal.textContent += text;
            terminal.scrollTop = terminal.scrollHeight;
          }
          
          async function spawnAgent() {
            const name = document.getElementById('agent-name').value || 
              'Agent-' + Date.now();
            const type = document.getElementById('agent-type').value;
            const command = document.getElementById('agent-command').value || undefined;
            
            try {
              const response = await fetch('/api/spawn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, command })
              });
              
              const result = await response.json();
              if (result.success) {
                document.getElementById('agent-name').value = '';
                document.getElementById('agent-command').value = '';
              }
            } catch (error) {
              console.error('Error spawning agent:', error);
            }
          }
          
          async function sendPrompt() {
            if (!currentAgentId) {
              alert('Please select an agent first');
              return;
            }
            
            const prompt = document.getElementById('prompt-input').value;
            if (!prompt) return;
            
            try {
              await fetch('/api/inject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  agentId: currentAgentId,
                  prompt,
                  waitForResponse: false
                })
              });
              
              document.getElementById('prompt-input').value = '';
            } catch (error) {
              console.error('Error sending prompt:', error);
            }
          }
          
          async function sendPromptWaitResponse() {
            if (!currentAgentId) {
              alert('Please select an agent first');
              return;
            }
            
            const prompt = document.getElementById('prompt-input').value;
            if (!prompt) return;
            
            try {
              const response = await fetch('/api/inject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  agentId: currentAgentId,
                  prompt,
                  waitForResponse: true,
                  timeout: 60000
                })
              });
              
              const result = await response.json();
              if (result.response) {
                appendToTerminal('\\n[RESPONSE CAPTURED]\\n' + result.response + '\\n');
              }
              
              document.getElementById('prompt-input').value = '';
            } catch (error) {
              console.error('Error sending prompt:', error);
            }
          }
          
          function clearTerminal() {
            document.getElementById('terminal-output').textContent = '';
            if (currentAgentId) {
              terminalOutputs.set(currentAgentId, '');
            }
          }
          
          async function terminateCurrentAgent() {
            if (!currentAgentId) return;
            
            if (confirm('Terminate this agent?')) {
              await fetch('/api/agent/' + currentAgentId, {
                method: 'DELETE'
              });
            }
          }
          
          // Keyboard shortcuts
          document.getElementById('prompt-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              sendPrompt();
            }
          });
          
          // Initialize
          connectWebSocket();
          
          // Load agents periodically
          setInterval(async () => {
            try {
              const response = await fetch('/api/agents');
              const agentsList = await response.json();
              
              agentsList.forEach(agent => {
                agents.set(agent.id, agent);
              });
              
              updateAgentsPanel();
            } catch (error) {
              console.error('Error loading agents:', error);
            }
          }, 5000);
        </script>
      </body>
      </html>
    `);
  });
  
  app.listen(PORT, '127.0.0.1', () => {
    logger.info(`🚀 AI CLI Orchestrator running on http://127.0.0.1:${PORT}`);
    logger.info(`🔌 WebSocket on ws://127.0.0.1:${WS_PORT}`);
    logger.info(`Ready to orchestrate AI CLI tools with full visibility!`);
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    orchestrator.shutdown();
    process.exit(0);
  });
}

// Launch
if (require.main === module) {
  createAPI().catch(error => {
    logger.error('Failed to start:', error);
    process.exit(1);
  });
}

export { AICLIOrchestrator };