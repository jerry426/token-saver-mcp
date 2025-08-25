#!/usr/bin/env tsx

/**
 * Test script for GPT-5's AI Terminal Wrapper implementation
 */

import { Orchestrator, AgentConfig } from './src/ai-terminal-wrapper';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Logger, LogLevel } from './src/utils/logger';

Logger.setGlobalConfig({
  level: LogLevel.INFO,
  console: true
});

const logger = new Logger('TestWrapper');
const PORT = 9805;
const WS_PORT = 9806;

async function createTestServer() {
  const orchestrator = new Orchestrator();
  const app = express();
  app.use(express.json());
  
  // Create WebSocket server
  const wss = new WebSocketServer({ port: WS_PORT });
  
  // Forward orchestrator events to WebSocket clients
  orchestrator.on('agent-spawned', (data) => {
    broadcast({ type: 'agent-spawned', ...data });
  });
  
  orchestrator.on('agent-output', (data) => {
    broadcast({ type: 'agent-output', ...data });
  });
  
  orchestrator.on('state-change', (data) => {
    broadcast({ type: 'state-change', ...data });
  });
  
  orchestrator.on('agent-error', (data) => {
    broadcast({ type: 'agent-error', ...data });
  });
  
  function broadcast(data: any) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(msg);
      }
    });
  }
  
  // REST API endpoints
  app.post('/api/agents/spawn', async (req, res) => {
    try {
      const { name, type, command, args } = req.body;
      const config: AgentConfig = {
        id: `${type}-${Date.now()}`,
        name: name || `Agent-${Date.now()}`,
        type: type || 'custom',
        command: command || '/bin/sh',  // Simple sh shell
        args: args || []  // No special args needed
      };
      
      const info = await orchestrator.spawnAgent(config);
      res.json({ success: true, agent: info });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  app.post('/api/agents/:id/inject', async (req, res) => {
    try {
      const { prompt, waitForResponse } = req.body;
      const result = await orchestrator.injectToAgent(
        req.params.id, 
        prompt, 
        { waitForResponse }
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  app.get('/api/agents', (req, res) => {
    res.json(orchestrator.listAgents());
  });
  
  app.get('/api/agents/:id', (req, res) => {
    try {
      const info = orchestrator.getAgentInfo(req.params.id);
      res.json(info);
    } catch (error) {
      res.status(404).json({ error: (error as Error).message });
    }
  });
  
  app.delete('/api/agents/:id', (req, res) => {
    orchestrator.terminateAgent(req.params.id);
    res.json({ success: true });
  });
  
  // Serve the enhanced UI
  app.get('/', (req, res) => {
    res.sendFile('/Users/jerry/VSCode/token-saver-mcp/enhanced-terminal-ui.html');
  });
  
  // Original simple UI (for fallback)
  app.get('/simple', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AI Terminal Wrapper Test</title>
        <style>
          body {
            font-family: monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
          }
          .terminal {
            background: #000;
            color: #0f0;
            padding: 10px;
            height: 400px;
            overflow-y: auto;
            border: 1px solid #4EC9B0;
            white-space: pre-wrap;
          }
          button {
            background: #4EC9B0;
            color: #1e1e1e;
            border: none;
            padding: 10px;
            margin: 5px;
            cursor: pointer;
          }
          input {
            background: #2d2d30;
            color: #d4d4d4;
            border: 1px solid #4EC9B0;
            padding: 8px;
            width: 300px;
            margin: 5px;
          }
          .status {
            padding: 10px;
            background: #2d2d30;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <h1>AI Terminal Wrapper Test (GPT-5 Implementation)</h1>
        
        <div class="status">
          <strong>Status:</strong> <span id="status">Connecting...</span><br>
          <strong>Agents:</strong> <span id="agent-count">0</span><br>
          <strong>Current State:</strong> <span id="current-state">-</span>
        </div>
        
        <div>
          <button onclick="spawnShell()">Spawn Test Shell</button>
          <button onclick="listAgents()">List Agents</button>
          <button onclick="clearTerminal()">Clear</button>
        </div>
        
        <div>
          <input type="text" id="agent-id" placeholder="Agent ID">
          <input type="text" id="command" placeholder="Command">
          <button onclick="injectCommand()">Inject</button>
        </div>
        
        <div class="terminal" id="terminal"></div>
        
        <script>
          const ws = new WebSocket('ws://localhost:${WS_PORT}');
          const terminal = document.getElementById('terminal');
          const status = document.getElementById('status');
          let currentAgentId = null;
          
          ws.onopen = () => {
            status.textContent = 'Connected';
            listAgents();
          };
          
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'agent-spawned') {
              appendToTerminal('[SPAWNED] ' + data.agent.name);
              currentAgentId = data.agent.id;
              document.getElementById('agent-id').value = currentAgentId;
              listAgents();
            }
            
            if (data.type === 'agent-output') {
              appendToTerminal(data.data);
            }
            
            if (data.type === 'state-change') {
              document.getElementById('current-state').textContent = 
                data.newState + (data.confidence ? ' (' + Math.round(data.confidence * 100) + '%)' : '');
            }
            
            if (data.type === 'agent-error') {
              appendToTerminal('[ERROR] ' + data.error);
            }
          };
          
          ws.onerror = (error) => {
            status.textContent = 'Error: ' + error;
          };
          
          function appendToTerminal(text) {
            terminal.textContent += text;
            terminal.scrollTop = terminal.scrollHeight;
          }
          
          async function spawnShell() {
            const response = await fetch('/api/agents/spawn', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: 'test-shell',
                type: 'custom',
                command: '/bin/sh',  // Use simple sh instead of zsh
                args: []
              })
            });
            const result = await response.json();
            console.log('Spawned:', result);
          }
          
          async function injectCommand() {
            const agentId = document.getElementById('agent-id').value;
            const command = document.getElementById('command').value;
            
            const response = await fetch('/api/agents/' + agentId + '/inject', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: command })
            });
            const result = await response.json();
            console.log('Injected:', result);
          }
          
          async function listAgents() {
            const response = await fetch('/api/agents');
            const agents = await response.json();
            document.getElementById('agent-count').textContent = agents.length;
            console.log('Agents:', agents);
          }
          
          function clearTerminal() {
            terminal.textContent = '';
          }
        </script>
      </body>
      </html>
    `);
  });
  
  app.listen(PORT, '127.0.0.1', () => {
    logger.info(`Test server running on http://127.0.0.1:${PORT}`);
    logger.info(`WebSocket on ws://127.0.0.1:${WS_PORT}`);
    logger.info('Testing GPT-5\'s AI Terminal Wrapper implementation');
  });
}

if (require.main === module) {
  createTestServer().catch(error => {
    logger.error('Failed to start test server:', error);
    process.exit(1);
  });
}