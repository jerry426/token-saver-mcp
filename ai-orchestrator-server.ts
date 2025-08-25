#!/usr/bin/env tsx

/**
 * AI Terminal Orchestrator Server
 * Production-ready server with port management and graceful shutdown
 */

import { Orchestrator, AgentConfig } from './src/ai-terminal-wrapper';
import { PortManager, getOrchestratorPorts, releaseOrchestratorPorts } from './src/ai-terminal-wrapper/port-manager';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Logger, LogLevel } from './src/utils/logger';
import * as path from 'path';

// Configure logger
Logger.setGlobalConfig({
  level: LogLevel.INFO,
  console: true,
  file: path.join(__dirname, 'logs', 'ai-orchestrator.log')
});

const logger = new Logger('OrchestratorServer');

async function startServer() {
  try {
    // Get or allocate ports
    const { httpPort, wsPort } = await getOrchestratorPorts();
    
    logger.info(`Starting AI Terminal Orchestrator...`);
    logger.info(`HTTP API Port: ${httpPort}`);
    logger.info(`WebSocket Port: ${wsPort}`);
    
    // Check if another instance is running
    const status = PortManager.getStatus();
    if (status.running && status.pid !== process.pid) {
      logger.warn(`Another orchestrator instance is running (PID: ${status.pid})`);
      logger.warn(`Project: ${status.project}`);
      logger.info(`Connecting to existing instance at ports ${httpPort}:${wsPort}`);
    }
    
    // Initialize orchestrator
    const orchestrator = new Orchestrator();
    const app = express();
    app.use(express.json());
    
    // Create WebSocket server
    const wss = new WebSocketServer({ port: wsPort, host: '127.0.0.1' });
    
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
    
    orchestrator.on('agent-terminated', (data) => {
      broadcast({ type: 'agent-terminated', ...data });
    });
    
    function broadcast(data: any) {
      const msg = JSON.stringify(data);
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(msg);
        }
      });
    }
    
    // WebSocket connection handling
    wss.on('connection', (ws) => {
      logger.info('New WebSocket client connected');
      
      // Send current agent list to new client
      const agents = orchestrator.listAgents();
      ws.send(JSON.stringify({ 
        type: 'initial-state', 
        agents 
      }));
      
      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
      });
      
      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });
    
    // REST API endpoints
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        agents: orchestrator.listAgents().length,
        ports: { httpPort, wsPort }
      });
    });
    
    app.post('/api/agents/spawn', async (req, res) => {
      try {
        const { name, type, command, args, env, tags } = req.body;
        
        const config: AgentConfig = {
          id: `${type || 'agent'}-${Date.now()}`,
          name: name || `Agent-${Date.now()}`,
          type: type || 'custom',
          command: command || '/bin/sh',
          args: args || [],
          env: env,
          tags: tags
        };
        
        logger.info(`Spawning agent: ${config.name} (${config.type})`);
        const info = await orchestrator.spawnAgent(config);
        
        res.json({ success: true, agent: info });
      } catch (error) {
        logger.error('Error spawning agent:', error);
        res.status(500).json({ error: (error as Error).message });
      }
    });
    
    app.post('/api/agents/:id/inject', async (req, res) => {
      try {
        const { prompt, waitForResponse, raw } = req.body;
        
        logger.debug(`Injecting to agent ${req.params.id}: ${prompt}${raw ? ' (raw)' : ''}`);
        const result = await orchestrator.injectToAgent(
          req.params.id, 
          prompt, 
          { waitForResponse, raw }
        );
        
        res.json(result);
      } catch (error) {
        logger.error('Error injecting prompt:', error);
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
      try {
        logger.info(`Terminating agent: ${req.params.id}`);
        orchestrator.terminateAgent(req.params.id);
        res.json({ success: true });
      } catch (error) {
        logger.error('Error terminating agent:', error);
        res.status(500).json({ error: (error as Error).message });
      }
    });
    
    app.post('/api/agents/:id/resize', (req, res) => {
      try {
        const { cols, rows } = req.body;
        logger.debug(`Resizing agent ${req.params.id} to ${cols}x${rows}`);
        orchestrator.resizeAgent(req.params.id, cols, rows);
        res.json({ success: true });
      } catch (error) {
        logger.error('Error resizing agent:', error);
        res.status(500).json({ error: (error as Error).message });
      }
    });
    
    app.post('/api/workflows', async (req, res) => {
      try {
        const workflow = req.body;
        logger.info(`Executing workflow: ${workflow.name}`);
        
        const results = await orchestrator.executeWorkflow(workflow);
        res.json({ success: true, results });
      } catch (error) {
        logger.error('Error executing workflow:', error);
        res.status(500).json({ error: (error as Error).message });
      }
    });
    
    // Serve the xterm-based UI for proper terminal emulation
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'xterm-terminal-ui.html'));
    });
    
    // Also serve the old UI at /old for comparison
    app.get('/old', (req, res) => {
      res.sendFile(path.join(__dirname, 'enhanced-terminal-ui.html'));
    });
    
    // Serve static assets if needed
    app.use('/static', express.static(path.join(__dirname, 'static')));
    
    // Start HTTP server
    const server = app.listen(httpPort, '127.0.0.1', () => {
      logger.info(`HTTP API running on http://127.0.0.1:${httpPort}`);
      logger.info(`WebSocket running on ws://127.0.0.1:${wsPort}`);
      logger.info('AI Terminal Orchestrator is ready');
      
      // Write PID file for monitoring
      const fs = require('fs');
      fs.writeFileSync('.orchestrator.pid', process.pid.toString());
    });
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });
      
      wss.close(() => {
        logger.info('WebSocket server closed');
      });
      
      // Terminate all agents
      const agents = orchestrator.listAgents();
      logger.info(`Terminating ${agents.length} agents...`);
      
      for (const agent of agents) {
        try {
          orchestrator.terminateAgent(agent.id);
        } catch (error) {
          logger.error(`Error terminating agent ${agent.id}:`, error);
        }
      }
      
      // Release ports
      releaseOrchestratorPorts();
      
      // Clean up PID file
      try {
        const fs = require('fs');
        fs.unlinkSync('.orchestrator.pid');
      } catch (error) {
        // Ignore
      }
      
      logger.info('Graceful shutdown complete');
      process.exit(0);
    };
    
    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    const status = PortManager.getStatus();
    if (status.running) {
      console.log('AI Terminal Orchestrator is running');
      console.log(`PID: ${status.pid}`);
      console.log(`HTTP Port: ${status.ports?.httpPort}`);
      console.log(`WebSocket Port: ${status.ports?.wsPort}`);
      console.log(`Project: ${status.project}`);
    } else {
      console.log('AI Terminal Orchestrator is not running');
    }
    process.exit(0);
  }
  
  if (args.includes('--stop')) {
    const status = PortManager.getStatus();
    if (status.running && status.pid) {
      try {
        process.kill(status.pid, 'SIGTERM');
        console.log(`Sent SIGTERM to orchestrator (PID: ${status.pid})`);
      } catch (error) {
        console.error('Error stopping orchestrator:', error);
        process.exit(1);
      }
    } else {
      console.log('AI Terminal Orchestrator is not running');
    }
    process.exit(0);
  }
  
  if (args.includes('--help')) {
    console.log('AI Terminal Orchestrator Server');
    console.log('');
    console.log('Usage:');
    console.log('  ai-orchestrator-server           Start the orchestrator server');
    console.log('  ai-orchestrator-server --status  Check if orchestrator is running');
    console.log('  ai-orchestrator-server --stop    Stop the orchestrator server');
    console.log('  ai-orchestrator-server --help    Show this help message');
    process.exit(0);
  }
  
  // Start the server
  startServer();
}

export { startServer };