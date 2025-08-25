#!/usr/bin/env tsx

/**
 * Enhanced Terminal Wrapper with Individual Agent Terminals
 * 
 * Features:
 * - Individual terminal view for each agent
 * - Manual input capability for each terminal
 * - Tab-based interface for switching between agents
 * - Real-time output streaming per agent
 */

import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { 
  createOrchestrator,
  Orchestrator
} from './src/terminal-wrapper';
import { MCPTerminalIntegration } from './src/terminal-wrapper/mcp-integration';
import { StreamHandler, WebSocketStreamAdapter } from './src/terminal-wrapper/stream-handler';
import { Logger, LogLevel } from './src/utils/logger';

// Configure logging
Logger.setGlobalConfig({
  level: LogLevel.INFO,
  console: true,
  colors: true
});

const logger = new Logger('EnhancedTerminal');

const PORT = 9800;
const WS_PORT = 9801;

// Track agent outputs separately
const agentOutputBuffers = new Map<string, string[]>();
const agentWebSockets = new Map<string, Set<WebSocket>>();

async function launchEnhancedServer() {
  logger.info('🚀 Starting Enhanced Terminal Wrapper with Individual Terminals');
  
  // Create orchestrator without built-in WebSocket (we'll handle it custom)
  const orchestrator = createOrchestrator({
    port: 0, // Disable built-in WebSocket
    enableWebSocket: false,
    memoryNamespace: 'terminal_wrapper'
  });

  // Create custom WebSocket server
  const wss = new WebSocketServer({ port: WS_PORT });
  
  // Create MCP integration
  const mcpIntegration = new MCPTerminalIntegration(orchestrator);

  // Create stream handler
  const streamHandler = new StreamHandler();

  // Enhanced WebSocket handling
  wss.on('connection', (ws) => {
    logger.info('New WebSocket connection established');
    
    let subscribedAgent: string | null = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'subscribe':
            // Subscribe to a specific agent's output
            subscribedAgent = data.agent;
            if (!agentWebSockets.has(subscribedAgent)) {
              agentWebSockets.set(subscribedAgent, new Set());
            }
            agentWebSockets.get(subscribedAgent)!.add(ws);
            
            // Send buffered output
            const buffer = agentOutputBuffers.get(subscribedAgent) || [];
            ws.send(JSON.stringify({
              type: 'agent-history',
              agent: subscribedAgent,
              history: buffer
            }));
            break;
            
          case 'unsubscribe':
            // Unsubscribe from agent
            if (subscribedAgent && agentWebSockets.has(subscribedAgent)) {
              agentWebSockets.get(subscribedAgent)!.delete(ws);
            }
            subscribedAgent = null;
            break;
            
          case 'input':
            // Manual input to agent
            if (data.agent && data.text) {
              logger.info(`[USER INPUT] ${data.agent}: ${data.text.trim()}`);
              await mcpIntegration.handleToolCall('inject_prompt_to_agent', {
                agent: data.agent,
                prompt: data.text,
                waitForReady: false,
                timeout: 1000
              });
            }
            break;
            
          case 'command':
            // Handle orchestrator commands
            await handleOrchestratorCommand(data, ws);
            break;
        }
      } catch (error) {
        logger.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: (error as Error).message
        }));
      }
    });
    
    ws.on('close', () => {
      // Clean up subscriptions
      if (subscribedAgent && agentWebSockets.has(subscribedAgent)) {
        agentWebSockets.get(subscribedAgent)!.delete(ws);
      }
    });
    
    // Send initial status
    ws.send(JSON.stringify({
      type: 'connected',
      agents: Array.from(agentOutputBuffers.keys())
    }));
  });

  // Set up orchestrator event handlers
  orchestrator.on('agent:spawned', (agent) => {
    const agentName = agent.config.name;
    logger.info(`Agent spawned: ${agentName}`);
    
    // Initialize output buffer
    agentOutputBuffers.set(agentName, []);
    
    // Set up output capture
    agent.pty.on('output', (data: string) => {
      // Log the output (strip ANSI codes for cleaner logs)
      const cleanData = data.replace(/\x1b\[[0-9;]*m/g, '').trim();
      if (cleanData) {
        logger.info(`[TERMINAL OUTPUT] ${agentName}: ${cleanData.substring(0, 100)}${cleanData.length > 100 ? '...' : ''}`);
      }
      
      // Store in buffer
      const buffer = agentOutputBuffers.get(agentName) || [];
      buffer.push(data);
      
      // Limit buffer size
      if (buffer.length > 1000) {
        buffer.shift();
      }
      
      // Broadcast to subscribed WebSockets
      const subscribers = agentWebSockets.get(agentName);
      if (subscribers) {
        const message = JSON.stringify({
          type: 'agent-output',
          agent: agentName,
          data: data,
          timestamp: Date.now()
        });
        
        subscribers.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        });
      }
    });
    
    // Broadcast agent spawn to all
    broadcast(wss, {
      type: 'agent-spawned',
      agent: agentName,
      config: agent.config
    });
  });

  orchestrator.on('agent:terminated', (agent) => {
    const agentName = typeof agent === 'string' ? agent : agent.config.name;
    logger.info(`Agent terminated: ${agentName}`);
    
    // Clean up
    agentOutputBuffers.delete(agentName);
    agentWebSockets.delete(agentName);
    
    broadcast(wss, {
      type: 'agent-terminated',
      agent: agentName
    });
  });

  async function handleOrchestratorCommand(data: any, ws: WebSocket) {
    switch (data.command) {
      case 'spawn':
        const result = await mcpIntegration.handleToolCall('spawn_ai_agent', data.config);
        ws.send(JSON.stringify({ type: 'spawn-result', result }));
        break;
        
      case 'terminate':
        await mcpIntegration.handleToolCall('terminate_ai_agent', { agent: data.agent });
        ws.send(JSON.stringify({ type: 'terminate-result', agent: data.agent }));
        break;
        
      case 'status':
        const status = await mcpIntegration.handleToolCall('get_agent_status', {});
        ws.send(JSON.stringify({ type: 'status-result', status }));
        break;
    }
  }

  function broadcast(wss: WebSocketServer, message: any) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Create Express server for HTTP API and enhanced UI
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'enhanced-terminal-wrapper',
      port: PORT,
      wsPort: WS_PORT,
      activeAgents: agentOutputBuffers.size,
      timestamp: Date.now()
    });
  });

  // API endpoints (same as before)
  app.post('/api/spawn-agent', async (req, res) => {
    try {
      const result = await mcpIntegration.handleToolCall('spawn_ai_agent', req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/inject-prompt', async (req, res) => {
    try {
      const result = await mcpIntegration.handleToolCall('inject_prompt_to_agent', req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/agent-status', async (req, res) => {
    try {
      const result = await mcpIntegration.handleToolCall('get_agent_status', {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Enhanced HTML interface with individual terminals
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Enhanced Terminal Wrapper - Multi-Agent Terminal View</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .header {
            background: #2d2d30;
            padding: 10px 20px;
            border-bottom: 2px solid #4EC9B0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .header h1 {
            color: #4EC9B0;
            font-size: 20px;
          }
          
          .controls {
            display: flex;
            gap: 10px;
          }
          
          button {
            background: #4EC9B0;
            color: #1e1e1e;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 12px;
          }
          
          button:hover {
            background: #3BA896;
          }
          
          button:disabled {
            background: #555;
            cursor: not-allowed;
          }
          
          .main-container {
            flex: 1;
            display: flex;
            overflow: hidden;
          }
          
          .sidebar {
            width: 250px;
            background: #252526;
            border-right: 1px solid #3e3e42;
            display: flex;
            flex-direction: column;
          }
          
          .sidebar-header {
            padding: 10px;
            background: #2d2d30;
            border-bottom: 1px solid #3e3e42;
            font-weight: bold;
          }
          
          .agent-list {
            flex: 1;
            overflow-y: auto;
          }
          
          .agent-item {
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid #3e3e42;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .agent-item:hover {
            background: #2d2d30;
          }
          
          .agent-item.active {
            background: #094771;
            border-left: 3px solid #4EC9B0;
          }
          
          .agent-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4EC9B0;
          }
          
          .agent-status.error {
            background: #f48771;
          }
          
          .agent-status.busy {
            background: #dcdcaa;
          }
          
          .terminal-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
          }
          
          .terminal-tabs {
            display: flex;
            background: #2d2d30;
            border-bottom: 1px solid #3e3e42;
            overflow-x: auto;
          }
          
          .terminal-tab {
            padding: 8px 16px;
            cursor: pointer;
            border-right: 1px solid #3e3e42;
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
          }
          
          .terminal-tab:hover {
            background: #383838;
          }
          
          .terminal-tab.active {
            background: #1e1e1e;
            color: #4EC9B0;
            border-bottom: 2px solid #4EC9B0;
          }
          
          .terminal-tab .close {
            color: #888;
            cursor: pointer;
            font-size: 16px;
          }
          
          .terminal-tab .close:hover {
            color: #f48771;
          }
          
          .terminal-view {
            flex: 1;
            display: none;
            flex-direction: column;
            background: #000;
          }
          
          .terminal-view.active {
            display: flex;
          }
          
          .terminal-output {
            flex: 1;
            padding: 10px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            color: #0f0;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          
          .terminal-input-container {
            border-top: 1px solid #3e3e42;
            padding: 10px;
            display: flex;
            gap: 10px;
            background: #1e1e1e;
          }
          
          .terminal-input {
            flex: 1;
            background: #2d2d30;
            border: 1px solid #3e3e42;
            color: #d4d4d4;
            padding: 8px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
          }
          
          .terminal-input:focus {
            outline: none;
            border-color: #4EC9B0;
          }
          
          .send-btn {
            padding: 8px 16px;
          }
          
          .no-agent {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #888;
            font-size: 18px;
          }
          
          .status-bar {
            background: #007ACC;
            color: white;
            padding: 4px 10px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
          }
          
          .new-agent-form {
            padding: 10px;
            background: #2d2d30;
            border-bottom: 1px solid #3e3e42;
          }
          
          .form-row {
            display: flex;
            gap: 5px;
            margin-bottom: 5px;
          }
          
          .form-input {
            flex: 1;
            padding: 4px 8px;
            background: #1e1e1e;
            border: 1px solid #3e3e42;
            color: #d4d4d4;
            font-size: 12px;
          }
          
          .quick-spawn {
            display: flex;
            gap: 5px;
            padding: 5px;
          }
          
          .quick-btn {
            flex: 1;
            padding: 4px;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🖥️ Enhanced Terminal Wrapper - Multi-Agent Terminal View</h1>
          <div class="controls">
            <button onclick="refreshAgents()">🔄 Refresh</button>
            <button onclick="clearCurrentTerminal()">🗑️ Clear Terminal</button>
            <button onclick="showHelp()">❓ Help</button>
          </div>
        </div>
        
        <div class="main-container">
          <div class="sidebar">
            <div class="sidebar-header">
              Active Agents
            </div>
            
            <div class="new-agent-form">
              <div class="form-row">
                <input type="text" class="form-input" id="agent-name" placeholder="Agent name">
              </div>
              <div class="form-row">
                <input type="text" class="form-input" id="agent-command" placeholder="Command (e.g., sh, python, node)">
              </div>
              <button onclick="spawnCustomAgent()" style="width: 100%; margin-top: 5px;">➕ Spawn Agent</button>
              
              <div class="quick-spawn">
                <button class="quick-btn" onclick="spawnShell()">Shell</button>
                <button class="quick-btn" onclick="spawnPython()">Python</button>
                <button class="quick-btn" onclick="spawnNode()">Node</button>
              </div>
            </div>
            
            <div class="agent-list" id="agent-list">
              <!-- Agent items will be added here -->
            </div>
          </div>
          
          <div class="terminal-container">
            <div class="terminal-tabs" id="terminal-tabs">
              <!-- Tabs will be added here -->
            </div>
            
            <div id="terminal-views">
              <div class="no-agent" id="no-agent">
                Select or spawn an agent to view its terminal
              </div>
            </div>
          </div>
        </div>
        
        <div class="status-bar">
          <span id="status-left">Ready</span>
          <span id="status-right">WebSocket: <span id="ws-status">Connecting...</span> | Agents: <span id="agent-count">0</span></span>
        </div>

        <script>
          const WS_URL = 'ws://localhost:${WS_PORT}';
          let ws = null;
          let currentAgent = null;
          const agents = new Set();
          const terminals = new Map();
          
          class AgentTerminal {
            constructor(name) {
              this.name = name;
              this.output = [];
              this.element = null;
              this.outputElement = null;
              this.inputElement = null;
            }
            
            createView() {
              const view = document.createElement('div');
              view.className = 'terminal-view';
              view.id = 'terminal-' + this.name;
              
              const output = document.createElement('div');
              output.className = 'terminal-output';
              output.id = 'output-' + this.name;
              
              const inputContainer = document.createElement('div');
              inputContainer.className = 'terminal-input-container';
              
              const input = document.createElement('input');
              input.type = 'text';
              input.className = 'terminal-input';
              input.placeholder = 'Type command and press Enter...';
              input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                  this.sendCommand(input.value);
                  input.value = '';
                }
              };
              
              const sendBtn = document.createElement('button');
              sendBtn.className = 'send-btn';
              sendBtn.textContent = 'Send';
              sendBtn.onclick = () => {
                this.sendCommand(input.value);
                input.value = '';
              };
              
              inputContainer.appendChild(input);
              inputContainer.appendChild(sendBtn);
              
              view.appendChild(output);
              view.appendChild(inputContainer);
              
              this.element = view;
              this.outputElement = output;
              this.inputElement = input;
              
              return view;
            }
            
            appendOutput(data) {
              this.output.push(data);
              if (this.outputElement) {
                this.outputElement.textContent += data;
                this.outputElement.scrollTop = this.outputElement.scrollHeight;
              }
            }
            
            clear() {
              this.output = [];
              if (this.outputElement) {
                this.outputElement.textContent = '';
              }
            }
            
            sendCommand(command) {
              if (!command.trim()) return;
              
              this.appendOutput('> ' + command + '\\n');
              
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'input',
                  agent: this.name,
                  text: command + '\\n'
                }));
              }
            }
            
            focus() {
              if (this.inputElement) {
                this.inputElement.focus();
              }
            }
          }
          
          function connectWebSocket() {
            ws = new WebSocket(WS_URL);
            
            ws.onopen = () => {
              console.log('WebSocket connected');
              document.getElementById('ws-status').textContent = 'Connected';
              document.getElementById('ws-status').style.color = '#4EC9B0';
              refreshAgents();
            };
            
            ws.onmessage = (event) => {
              const data = JSON.parse(event.data);
              handleWebSocketMessage(data);
            };
            
            ws.onerror = (error) => {
              console.error('WebSocket error:', error);
              document.getElementById('ws-status').textContent = 'Error';
              document.getElementById('ws-status').style.color = '#f48771';
            };
            
            ws.onclose = () => {
              console.log('WebSocket disconnected');
              document.getElementById('ws-status').textContent = 'Disconnected';
              document.getElementById('ws-status').style.color = '#f48771';
              setTimeout(connectWebSocket, 3000);
            };
          }
          
          function handleWebSocketMessage(data) {
            switch(data.type) {
              case 'connected':
                if (data.agents) {
                  data.agents.forEach(agent => addAgent(agent));
                }
                break;
                
              case 'agent-spawned':
                addAgent(data.agent);
                break;
                
              case 'agent-terminated':
                removeAgent(data.agent);
                break;
                
              case 'agent-output':
                const terminal = terminals.get(data.agent);
                if (terminal) {
                  terminal.appendOutput(data.data);
                }
                break;
                
              case 'agent-history':
                const histTerminal = terminals.get(data.agent);
                if (histTerminal && data.history) {
                  histTerminal.clear();
                  data.history.forEach(line => histTerminal.appendOutput(line));
                }
                break;
            }
          }
          
          function addAgent(name) {
            if (agents.has(name)) return;
            
            agents.add(name);
            
            // Add to sidebar
            const item = document.createElement('div');
            item.className = 'agent-item';
            item.id = 'agent-' + name;
            item.innerHTML = \`
              <span>\${name}</span>
              <span class="agent-status"></span>
            \`;
            item.onclick = () => selectAgent(name);
            document.getElementById('agent-list').appendChild(item);
            
            // Create terminal
            const terminal = new AgentTerminal(name);
            terminals.set(name, terminal);
            
            // Add tab
            const tab = document.createElement('div');
            tab.className = 'terminal-tab';
            tab.id = 'tab-' + name;
            tab.innerHTML = \`
              <span onclick="selectAgent('\${name}')">\${name}</span>
              <span class="close" onclick="event.stopPropagation(); terminateAgent('\${name}')">×</span>
            \`;
            document.getElementById('terminal-tabs').appendChild(tab);
            
            updateAgentCount();
            
            // Auto-select first agent
            if (agents.size === 1) {
              selectAgent(name);
            }
          }
          
          function removeAgent(name) {
            if (!agents.has(name)) return;
            
            agents.delete(name);
            terminals.delete(name);
            
            // Remove from UI
            const item = document.getElementById('agent-' + name);
            if (item) item.remove();
            
            const tab = document.getElementById('tab-' + name);
            if (tab) tab.remove();
            
            const view = document.getElementById('terminal-' + name);
            if (view) view.remove();
            
            updateAgentCount();
            
            // Select another agent if current was removed
            if (currentAgent === name) {
              currentAgent = null;
              if (agents.size > 0) {
                selectAgent(agents.values().next().value);
              } else {
                document.getElementById('no-agent').style.display = 'flex';
              }
            }
          }
          
          function selectAgent(name) {
            if (!agents.has(name)) return;
            
            currentAgent = name;
            
            // Update sidebar
            document.querySelectorAll('.agent-item').forEach(item => {
              item.classList.remove('active');
            });
            const item = document.getElementById('agent-' + name);
            if (item) item.classList.add('active');
            
            // Update tabs
            document.querySelectorAll('.terminal-tab').forEach(tab => {
              tab.classList.remove('active');
            });
            const tab = document.getElementById('tab-' + name);
            if (tab) tab.classList.add('active');
            
            // Show terminal view
            document.getElementById('no-agent').style.display = 'none';
            document.querySelectorAll('.terminal-view').forEach(view => {
              view.classList.remove('active');
            });
            
            let terminal = terminals.get(name);
            if (terminal) {
              if (!terminal.element) {
                const view = terminal.createView();
                document.getElementById('terminal-views').appendChild(view);
              }
              terminal.element.classList.add('active');
              terminal.focus();
              
              // Subscribe to this agent's output
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'subscribe',
                  agent: name
                }));
              }
            }
          }
          
          function spawnCustomAgent() {
            const name = document.getElementById('agent-name').value || 'agent-' + Date.now();
            const command = document.getElementById('agent-command').value || 'sh';
            
            fetch('/api/spawn-agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name,
                type: 'custom',
                command: command,
                args: []
              })
            }).then(response => response.json())
              .then(result => {
                console.log('Agent spawned:', result);
                document.getElementById('agent-name').value = '';
                document.getElementById('agent-command').value = '';
              })
              .catch(error => console.error('Error spawning agent:', error));
          }
          
          function spawnShell() {
            const name = 'shell-' + Date.now();
            fetch('/api/spawn-agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name,
                type: 'custom',
                command: 'sh',
                args: []
              })
            });
          }
          
          function spawnPython() {
            const name = 'python-' + Date.now();
            fetch('/api/spawn-agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name,
                type: 'custom',
                command: 'python3',
                args: ['-i']  // Interactive mode
              })
            });
          }
          
          function spawnNode() {
            const name = 'node-' + Date.now();
            fetch('/api/spawn-agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name,
                type: 'custom',
                command: 'node',
                args: ['-i']  // Interactive mode
              })
            });
          }
          
          function terminateAgent(name) {
            if (confirm('Terminate agent ' + name + '?')) {
              fetch('/api/spawn-agent', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent: name })
              });
            }
          }
          
          function clearCurrentTerminal() {
            if (currentAgent) {
              const terminal = terminals.get(currentAgent);
              if (terminal) {
                terminal.clear();
              }
            }
          }
          
          function refreshAgents() {
            fetch('/api/agent-status')
              .then(response => response.json())
              .then(status => {
                // Clear and rebuild agent list
                agents.clear();
                terminals.clear();
                document.getElementById('agent-list').innerHTML = '';
                document.getElementById('terminal-tabs').innerHTML = '';
                
                if (status.agents) {
                  status.agents.forEach(agent => {
                    addAgent(agent.name);
                  });
                }
              });
          }
          
          function updateAgentCount() {
            document.getElementById('agent-count').textContent = agents.size;
          }
          
          function showHelp() {
            alert(\`Enhanced Terminal Wrapper - Help
            
• Each agent runs in its own isolated terminal
• Click on an agent in the sidebar to view its terminal
• Type commands in the input field and press Enter to send
• Use the quick spawn buttons to create new agents
• Click the × on a tab to terminate an agent
• Each terminal shows real-time output from its agent
• You can interact with multiple agents simultaneously\`);
          }
          
          // Initialize
          connectWebSocket();
        </script>
      </body>
      </html>
    `);
  });

  // Start Express server
  app.listen(PORT, '127.0.0.1', () => {
    logger.info(`📡 Enhanced HTTP server listening on http://127.0.0.1:${PORT}`);
    logger.info(`🔌 WebSocket server on ws://127.0.0.1:${WS_PORT}`);
    logger.info(`🌐 Open http://127.0.0.1:${PORT} to see the enhanced multi-terminal UI`);
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down Enhanced Terminal Wrapper...');
    orchestrator.shutdown();
    wss.close();
    process.exit(0);
  });
}

// Launch the server
if (require.main === module) {
  launchEnhancedServer().catch(error => {
    console.error('Failed to launch enhanced server:', error);
    logger.error('Failed to launch:', error.message);
    process.exit(1);
  });
}

export { launchEnhancedServer };