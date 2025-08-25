#!/usr/bin/env tsx

/**
 * Terminal Wrapper Launch Script
 * 
 * This script launches the terminal wrapper orchestrator with a WebSocket server
 * and demonstrates its capabilities.
 */

import express from 'express';
import { WebSocket } from 'ws';
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

const logger = new Logger('TerminalWrapper');

const PORT = 9800;
const WS_PORT = 9801;

async function launchServer() {
  logger.info('🚀 Starting Terminal Wrapper Orchestrator');
  
  // Create orchestrator
  const orchestrator = createOrchestrator({
    port: WS_PORT,
    enableWebSocket: true,
    memoryNamespace: 'terminal_wrapper'
  });

  // Create MCP integration
  const mcpIntegration = new MCPTerminalIntegration(orchestrator);

  // Create stream handler
  const streamHandler = new StreamHandler();
  const wsAdapter = new WebSocketStreamAdapter(streamHandler);

  // Create Express server for HTTP API
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'terminal-wrapper',
      port: PORT,
      wsPort: WS_PORT,
      timestamp: Date.now()
    });
  });

  // API endpoint to spawn agent
  app.post('/api/spawn-agent', async (req, res) => {
    try {
      const result = await mcpIntegration.handleToolCall('spawn_ai_agent', req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API endpoint to inject prompt
  app.post('/api/inject-prompt', async (req, res) => {
    try {
      const result = await mcpIntegration.handleToolCall('inject_prompt_to_agent', req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API endpoint to execute workflow
  app.post('/api/execute-workflow', async (req, res) => {
    try {
      const result = await mcpIntegration.handleToolCall('execute_ai_workflow', req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API endpoint to get agent status
  app.get('/api/agent-status', async (req, res) => {
    try {
      const result = await mcpIntegration.handleToolCall('get_agent_status', {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // API endpoint to get specific agent status
  app.get('/api/agent-status/:agent', async (req, res) => {
    try {
      const result = await mcpIntegration.handleToolCall('get_agent_status', {
        agent: req.params.agent
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Create demo HTML interface
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Terminal Wrapper Orchestrator</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
          }
          h1 {
            color: #4EC9B0;
            border-bottom: 2px solid #4EC9B0;
            padding-bottom: 10px;
          }
          .status {
            background: #2d2d30;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .terminal {
            background: #000;
            color: #0f0;
            padding: 10px;
            border-radius: 5px;
            height: 400px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            border: 1px solid #4EC9B0;
          }
          button {
            background: #4EC9B0;
            color: #1e1e1e;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
            font-weight: bold;
          }
          button:hover {
            background: #3BA896;
          }
          .controls {
            margin: 20px 0;
          }
          .agent-card {
            background: #2d2d30;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 3px solid #4EC9B0;
          }
          .log-entry {
            margin: 2px 0;
            padding: 2px 5px;
          }
          .log-info { color: #4EC9B0; }
          .log-error { color: #f48771; }
          .log-warn { color: #dcdcaa; }
        </style>
      </head>
      <body>
        <h1>🎼 Terminal Wrapper Orchestrator</h1>
        
        <div class="status">
          <h2>Status</h2>
          <div id="status-info">
            🟢 Server running on port ${PORT}<br>
            🔌 WebSocket on port ${WS_PORT}<br>
            📊 <span id="agent-count">0</span> agents active
          </div>
        </div>

        <div class="controls">
          <h2>Quick Actions</h2>
          <button onclick="spawnTestAgent()">🚀 Spawn Test Agent</button>
          <button onclick="runPipelineDemo()">⚡ Run Pipeline Demo</button>
          <button onclick="runParallelDemo()">🔄 Run Parallel Demo</button>
          <button onclick="getStatus()">📊 Get Status</button>
          <button onclick="clearTerminal()">🗑️ Clear Terminal</button>
        </div>

        <div id="agents-container">
          <h2>Active Agents</h2>
          <div id="agents-list"></div>
        </div>

        <div class="terminal" id="terminal">
          <div class="log-entry log-info">Terminal Wrapper Orchestrator Ready...</div>
          <div class="log-entry log-info">WebSocket connection available on ws://localhost:${WS_PORT}</div>
        </div>

        <script>
          const terminal = document.getElementById('terminal');
          const ws = new WebSocket('ws://localhost:${WS_PORT}');
          
          ws.onopen = () => {
            addLog('WebSocket connected', 'info');
          };
          
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          };
          
          ws.onerror = (error) => {
            addLog('WebSocket error: ' + error, 'error');
          };

          function addLog(message, level = 'info') {
            const entry = document.createElement('div');
            entry.className = 'log-entry log-' + level;
            entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
            terminal.appendChild(entry);
            terminal.scrollTop = terminal.scrollHeight;
          }

          function handleWebSocketMessage(data) {
            switch(data.type) {
              case 'agent-spawned':
                addLog('Agent spawned: ' + data.agent, 'info');
                updateAgentsList();
                break;
              case 'agent-output':
                addLog('[' + data.agent + '] ' + data.data, 'info');
                break;
              case 'agent-error':
                addLog('[' + data.agent + '] Error: ' + data.error, 'error');
                break;
              case 'agent-terminated':
                addLog('Agent terminated: ' + data.agent, 'warn');
                updateAgentsList();
                break;
              case 'workflow-started':
                addLog('Workflow started: ' + data.workflow.name, 'info');
                break;
              case 'workflow-completed':
                addLog('Workflow completed: ' + data.workflow.name, 'info');
                break;
              default:
                console.log('Unhandled message type:', data.type);
            }
          }

          async function spawnTestAgent() {
            addLog('Spawning test agent...', 'info');
            try {
              const response = await fetch('/api/spawn-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: 'test-agent-' + Date.now(),
                  type: 'custom',
                  command: 'sh',
                  args: ['-c', 'echo "Test agent ready" && sleep 1 && echo "Processing..." && sleep 1 && echo "Done"']
                })
              });
              const result = await response.json();
              addLog('Agent spawned: ' + JSON.stringify(result), 'info');
              updateAgentsList();
            } catch (error) {
              addLog('Error spawning agent: ' + error, 'error');
            }
          }

          async function runPipelineDemo() {
            addLog('Running pipeline demo...', 'info');
            
            // First spawn agents
            const agents = ['echo-architect', 'echo-developer', 'echo-reviewer'];
            for (const agent of agents) {
              await fetch('/api/spawn-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: agent,
                  type: 'custom',
                  command: 'sh',
                  args: ['-c', 'while true; do read input; echo "[' + agent + '] Processing: $input"; done']
                })
              });
            }
            
            // Run pipeline workflow
            const workflow = {
              workflow: {
                id: 'demo-pipeline-' + Date.now(),
                name: 'Demo Pipeline',
                steps: [
                  {
                    id: 'step1',
                    name: 'Architecture Design',
                    agent: 'echo-architect',
                    prompt: 'Design the system architecture\\n',
                    outputKey: 'architecture'
                  },
                  {
                    id: 'step2',
                    name: 'Implementation',
                    agent: 'echo-developer',
                    prompt: 'Implement based on {{architecture}}\\n',
                    dependsOn: ['step1'],
                    outputKey: 'implementation'
                  },
                  {
                    id: 'step3',
                    name: 'Review',
                    agent: 'echo-reviewer',
                    prompt: 'Review the {{implementation}}\\n',
                    dependsOn: ['step2'],
                    outputKey: 'review'
                  }
                ],
                parallel: false,
                onError: 'stop'
              }
            };
            
            try {
              const response = await fetch('/api/execute-workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(workflow)
              });
              const result = await response.json();
              addLog('Pipeline completed: ' + JSON.stringify(result), 'info');
            } catch (error) {
              addLog('Pipeline error: ' + error, 'error');
            }
          }

          async function runParallelDemo() {
            addLog('Running parallel demo...', 'info');
            
            // Spawn multiple agents if not already present
            const agents = ['parallel-1', 'parallel-2', 'parallel-3'];
            for (const agent of agents) {
              await fetch('/api/spawn-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: agent,
                  type: 'custom',
                  command: 'sh',
                  args: ['-c', 'echo "[' + agent + '] Starting analysis..." && sleep 2 && echo "[' + agent + '] Analysis complete!"']
                })
              });
            }
            
            addLog('All parallel agents spawned, running parallel tasks...', 'info');
          }

          async function getStatus() {
            try {
              const response = await fetch('/api/agent-status');
              const status = await response.json();
              addLog('Status: ' + JSON.stringify(status, null, 2), 'info');
              updateAgentCount(status.totalAgents || 0);
            } catch (error) {
              addLog('Error getting status: ' + error, 'error');
            }
          }

          async function updateAgentsList() {
            try {
              const response = await fetch('/api/agent-status');
              const status = await response.json();
              const agentsList = document.getElementById('agents-list');
              
              if (status.agents && status.agents.length > 0) {
                agentsList.innerHTML = status.agents.map(agent => \`
                  <div class="agent-card">
                    <strong>\${agent.name}</strong> (\${agent.type})<br>
                    Status: \${agent.status} | State: \${agent.state}<br>
                    Metrics: \${agent.metrics.tasksCompleted} completed, \${agent.metrics.tasksFailed} failed
                  </div>
                \`).join('');
              } else {
                agentsList.innerHTML = '<div class="agent-card">No active agents</div>';
              }
              
              updateAgentCount(status.totalAgents || 0);
            } catch (error) {
              console.error('Error updating agents list:', error);
            }
          }

          function updateAgentCount(count) {
            document.getElementById('agent-count').textContent = count;
          }

          function clearTerminal() {
            terminal.innerHTML = '<div class="log-entry log-info">Terminal cleared</div>';
          }

          // Initial status check
          setTimeout(() => {
            getStatus();
            updateAgentsList();
          }, 1000);

          // Periodic updates
          setInterval(() => {
            updateAgentsList();
          }, 5000);
        </script>
      </body>
      </html>
    `);
  });

  // Start Express server
  app.listen(PORT, '127.0.0.1', () => {
    logger.info(`📡 HTTP server listening on http://127.0.0.1:${PORT}`);
    logger.info(`🔌 WebSocket server on ws://127.0.0.1:${WS_PORT}`);
    logger.info(`🌐 Open http://127.0.0.1:${PORT} in your browser to see the UI`);
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down Terminal Wrapper...');
    orchestrator.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down Terminal Wrapper...');
    orchestrator.shutdown();
    process.exit(0);
  });
}

// Launch the server
if (require.main === module) {
  launchServer().catch(error => {
    console.error('Failed to launch server:', error);
    logger.error('Failed to launch server:', error.message || error);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  });
}

export { launchServer };