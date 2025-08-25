#!/usr/bin/env tsx

/**
 * Safe AI CLI Wrapper
 * 
 * This version handles AI CLIs (Claude, ChatGPT, etc.) safely without
 * causing terminal control conflicts or paste buffer issues.
 */

import express from 'express';
import { PTYManager } from './src/terminal-wrapper/pty-manager';
import { SafeTerminalHandler, AICLIHandler } from './src/terminal-wrapper/safe-terminal-handler';
import { Logger, LogLevel } from './src/utils/logger';

Logger.setGlobalConfig({
  level: LogLevel.INFO,
  console: true
});

const logger = new Logger('SafeAIWrapper');
const PORT = 9802;

interface SafeAgent {
  name: string;
  type: string;
  pty: PTYManager;
  handler: SafeTerminalHandler | AICLIHandler;
  outputHistory: string[];
  isAICLI: boolean;
}

const agents = new Map<string, SafeAgent>();

async function launchSafeServer() {
  logger.info('🛡️ Starting Safe AI CLI Wrapper');
  
  const app = express();
  app.use(express.json());

  // Spawn a safe shell
  app.post('/api/spawn-safe-shell', async (req, res) => {
    try {
      const { name = `shell-${Date.now()}` } = req.body;
      
      const pty = new PTYManager({
        command: 'sh',
        args: [],
        name
      });
      
      await pty.spawn();
      
      const handler = new SafeTerminalHandler({
        maxOutputBuffer: 50000,
        stripAnsiCodes: false,
        escapeControlChars: true
      });
      
      const agent: SafeAgent = {
        name,
        type: 'shell',
        pty,
        handler,
        outputHistory: [],
        isAICLI: false
      };
      
      // Process all output through safe handler
      pty.on('output', (data) => {
        const cleaned = handler.processOutput(data, name);
        agent.outputHistory.push(cleaned);
        
        // Limit history
        if (agent.outputHistory.length > 100) {
          agent.outputHistory.shift();
        }
        
        // Log output for debugging
        logger.info(`[OUTPUT] ${name}: ${cleaned.substring(0, 100)}`);
      });
      
      agents.set(name, agent);
      
      res.json({
        success: true,
        agent: name,
        warning: null
      });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Spawn an AI CLI with special handling
  app.post('/api/spawn-ai-cli', async (req, res) => {
    try {
      const { name, command, args = [] } = req.body;
      
      // Warn about AI CLIs
      const warning = `
        ⚠️ AI CLI Spawned with Safety Features:
        - Terminal control sequences are filtered
        - Output is buffered and rate-limited
        - Copy/paste will use cleaned text
        - Some interactive features may not work perfectly
      `;
      
      logger.warn(`Spawning AI CLI: ${command} with safety measures`);
      
      const pty = new PTYManager({
        command,
        args,
        name
      });
      
      await pty.spawn();
      
      const handler = new AICLIHandler();
      
      const agent: SafeAgent = {
        name,
        type: command,
        pty,
        handler,
        outputHistory: [],
        isAICLI: true
      };
      
      // Process output with AI-specific handling
      pty.on('output', (data) => {
        const result = (handler as AICLIHandler).processAIOutput(data, command);
        agent.outputHistory.push(result.cleaned);
        
        // Log state changes
        if (result.state === 'prompting') {
          logger.info(`${name}: Ready for input`);
        } else if (result.state === 'responding') {
          logger.info(`${name}: Generating response`);
        }
      });
      
      agents.set(name, agent);
      
      res.json({
        success: true,
        agent: name,
        warning: warning.trim()
      });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Safe command injection
  app.post('/api/safe-inject', async (req, res) => {
    try {
      const { agent: agentName, command } = req.body;
      const agent = agents.get(agentName);
      
      if (!agent) {
        throw new Error(`Agent ${agentName} not found`);
      }
      
      // Check if command might cause issues
      if (agent.handler.isInteractiveCommand(command)) {
        logger.warn(`Warning: ${command} might spawn interactive UI`);
        
        return res.json({
          success: false,
          warning: 'This command might spawn an interactive interface that could cause issues. Consider using non-interactive flags or alternatives.'
        });
      }
      
      // For AI CLIs, use special injection
      if (agent.isAICLI && agent.handler instanceof AICLIHandler) {
        const safePrompt = await agent.handler.injectSafePrompt(command);
        await agent.pty.write(safePrompt + '\n');
      } else {
        await agent.pty.write(command + '\n');
      }
      
      res.json({ success: true });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get agent output
  app.get('/api/output/:agent', (req, res) => {
    const agent = agents.get(req.params.agent);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({
      success: true,
      output: agent.outputHistory.join(''),
      lines: agent.outputHistory
    });
  });

  // Get safe copy text (for clipboard)
  app.get('/api/safe-copy/:agent', (req, res) => {
    const agent = agents.get(req.params.agent);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const safeCopy = agent.handler.getSafeCopyText();
    
    res.json({
      success: true,
      text: safeCopy,
      warning: 'All control characters and ANSI codes have been removed for safe pasting'
    });
  });

  // Enhanced UI with safety features
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Safe AI CLI Wrapper</title>
        <style>
          body {
            font-family: monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
          }
          
          .warning {
            background: #664400;
            border: 2px solid #ffaa00;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
          }
          
          .terminal {
            background: #000;
            color: #0f0;
            padding: 10px;
            height: 400px;
            overflow-y: auto;
            border: 1px solid #4EC9B0;
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          
          .controls {
            margin: 20px 0;
          }
          
          button {
            background: #4EC9B0;
            color: #1e1e1e;
            border: none;
            padding: 10px 20px;
            margin: 5px;
            cursor: pointer;
            border-radius: 5px;
          }
          
          button:hover {
            background: #3BA896;
          }
          
          button.danger {
            background: #f48771;
          }
          
          input {
            background: #2d2d30;
            color: #d4d4d4;
            border: 1px solid #4EC9B0;
            padding: 8px;
            width: 300px;
            margin: 5px;
          }
          
          .safe-indicator {
            display: inline-block;
            padding: 5px 10px;
            background: #004400;
            border: 1px solid #00ff00;
            border-radius: 5px;
            margin-left: 10px;
          }
          
          #status {
            padding: 10px;
            background: #2d2d30;
            margin: 10px 0;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <h1>🛡️ Safe AI CLI Wrapper</h1>
        
        <div class="warning">
          ⚠️ <strong>Safety Features Active:</strong><br>
          • Terminal control sequences are filtered<br>
          • Output is sanitized for safe copy/paste<br>
          • Interactive CLIs are detected and warned<br>
          • Rate limiting prevents output flooding
        </div>
        
        <div id="status">
          Status: <span id="status-text">Ready</span>
          <span class="safe-indicator">🛡️ Protected Mode</span>
        </div>
        
        <div class="controls">
          <button onclick="spawnSafeShell()">🖥️ Spawn Safe Shell</button>
          <button onclick="testEcho()">✅ Test Echo Command</button>
          <button onclick="getSafeCopy()">📋 Get Safe Copy</button>
          <button onclick="clearTerminal()">🗑️ Clear</button>
          
          <br><br>
          
          <div class="warning">
            ⚠️ AI CLIs: These may not work perfectly due to their interactive nature
          </div>
          
          <input type="text" id="ai-command" placeholder="AI CLI command (e.g., claude)">
          <button class="danger" onclick="spawnAICLI()">⚡ Spawn AI CLI (Experimental)</button>
        </div>
        
        <div class="terminal" id="terminal">
          Safe Terminal Output (filtered and sanitized)
        </div>
        
        <div style="margin-top: 20px;">
          <input type="text" id="command-input" placeholder="Enter command..." style="width: 70%;">
          <button onclick="sendCommand()">Send</button>
        </div>
        
        <script>
          let currentAgent = null;
          let outputPoller = null;
          const terminal = document.getElementById('terminal');
          const statusText = document.getElementById('status-text');
          
          function updateStatus(text, isError = false) {
            statusText.textContent = text;
            statusText.style.color = isError ? '#f48771' : '#4EC9B0';
          }
          
          function appendToTerminal(text) {
            terminal.textContent += text + '\\n';
            terminal.scrollTop = terminal.scrollHeight;
          }
          
          // Poll for output updates
          async function pollOutput() {
            if (!currentAgent) return;
            
            try {
              const response = await fetch('/api/output/' + currentAgent);
              const result = await response.json();
              
              if (result.success) {
                terminal.textContent = result.output;
                terminal.scrollTop = terminal.scrollHeight;
              }
            } catch (error) {
              console.error('Poll error:', error);
            }
          }
          
          function startPolling() {
            stopPolling();
            outputPoller = setInterval(pollOutput, 500); // Poll every 500ms
          }
          
          function stopPolling() {
            if (outputPoller) {
              clearInterval(outputPoller);
              outputPoller = null;
            }
          }
          
          async function spawnSafeShell() {
            try {
              const response = await fetch('/api/spawn-safe-shell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
              });
              
              const result = await response.json();
              if (result.success) {
                currentAgent = result.agent;
                updateStatus('Safe shell spawned: ' + currentAgent);
                appendToTerminal('[System] Safe shell created: ' + currentAgent);
                startPolling(); // Start polling for output
              }
            } catch (error) {
              updateStatus('Error: ' + error.message, true);
            }
          }
          
          async function spawnAICLI() {
            const command = document.getElementById('ai-command').value;
            if (!command) {
              alert('Please enter an AI CLI command');
              return;
            }
            
            if (!confirm('AI CLIs may not work perfectly in this safe mode. Continue?')) {
              return;
            }
            
            try {
              const response = await fetch('/api/spawn-ai-cli', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: command + '-' + Date.now(),
                  command: command,
                  args: []
                })
              });
              
              const result = await response.json();
              if (result.success) {
                currentAgent = result.agent;
                updateStatus('AI CLI spawned (safe mode): ' + currentAgent);
                appendToTerminal('[System] ' + result.warning);
              }
            } catch (error) {
              updateStatus('Error: ' + error.message, true);
            }
          }
          
          async function sendCommand() {
            const input = document.getElementById('command-input');
            const command = input.value;
            if (!command || !currentAgent) return;
            
            try {
              const response = await fetch('/api/safe-inject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  agent: currentAgent,
                  command: command
                })
              });
              
              const result = await response.json();
              if (result.success) {
                appendToTerminal('> ' + command);
              } else if (result.warning) {
                appendToTerminal('[Warning] ' + result.warning);
              }
              
              input.value = '';
            } catch (error) {
              updateStatus('Error: ' + error.message, true);
            }
          }
          
          async function testEcho() {
            if (!currentAgent) {
              await spawnSafeShell();
            }
            
            await sendCommandDirect('echo "This is a safe test"');
          }
          
          async function sendCommandDirect(cmd) {
            const response = await fetch('/api/safe-inject', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agent: currentAgent,
                command: cmd
              })
            });
          }
          
          async function getSafeCopy() {
            if (!currentAgent) {
              alert('No agent active');
              return;
            }
            
            try {
              const response = await fetch('/api/safe-copy/' + currentAgent);
              const result = await response.json();
              
              if (result.success) {
                navigator.clipboard.writeText(result.text);
                appendToTerminal('[System] Safe text copied to clipboard (control chars removed)');
              }
            } catch (error) {
              updateStatus('Error: ' + error.message, true);
            }
          }
          
          function clearTerminal() {
            terminal.textContent = '';
          }
          
          document.getElementById('command-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              sendCommand();
            }
          });
        </script>
      </body>
      </html>
    `);
  });

  app.listen(PORT, '127.0.0.1', () => {
    logger.info(`🛡️ Safe AI CLI Wrapper running on http://127.0.0.1:${PORT}`);
    logger.info('Features: Output sanitization, control sequence filtering, safe copy/paste');
  });
}

if (require.main === module) {
  launchSafeServer().catch(error => {
    logger.error('Failed to start:', error);
    process.exit(1);
  });
}