#!/usr/bin/env tsx

/**
 * Terminal Orchestration Demo
 * 
 * This example demonstrates how to use the Terminal Wrapper to orchestrate
 * multiple AI agents working together on complex tasks.
 */

import { 
  createOrchestrator,
  AGENT_CONFIGS,
  WORKFLOW_PATTERNS
} from '../src/terminal-wrapper';
import { MCPTerminalIntegration } from '../src/terminal-wrapper/mcp-integration';
import { StreamHandler, WebSocketStreamAdapter } from '../src/terminal-wrapper/stream-handler';
import { Logger, LogLevel } from '../src/utils/logger';

// Configure logging
Logger.setGlobalConfig({
  level: LogLevel.INFO,
  console: true,
  file: './logs/orchestration-demo.log'
});

const logger = new Logger('OrchestrationDemo');

async function runDemo() {
  logger.info('Starting Terminal Orchestration Demo');

  // Create orchestrator
  const orchestrator = createOrchestrator({
    port: 9800,
    enableWebSocket: true,
    memoryNamespace: 'demo'
  });

  // Create MCP integration
  const mcpIntegration = new MCPTerminalIntegration(orchestrator);

  // Create stream handler for output streaming
  const streamHandler = new StreamHandler();
  const wsAdapter = new WebSocketStreamAdapter(streamHandler);

  try {
    // Example 1: Spawn multiple agents
    logger.info('=== Example 1: Spawning AI Agents ===');
    
    const agents = [
      {
        name: 'architect',
        type: 'claude' as const,
        command: 'echo',
        args: ['[Claude] Architect Agent Ready'],
        capabilities: ['architecture', 'design', 'review']
      },
      {
        name: 'developer',
        type: 'gemini' as const,
        command: 'echo',
        args: ['[Gemini] Developer Agent Ready'],
        capabilities: ['coding', 'implementation', 'testing']
      },
      {
        name: 'reviewer',
        type: 'gpt4' as const,
        command: 'echo',
        args: ['[GPT-4] Reviewer Agent Ready'],
        capabilities: ['review', 'analysis', 'optimization']
      }
    ];

    for (const agentConfig of agents) {
      const result = await mcpIntegration.handleToolCall('spawn_ai_agent', agentConfig);
      logger.info(`Spawned agent: ${result.agent.name} (PID: ${result.agent.pid})`);
      
      // Create stream for the agent
      const stream = streamHandler.createAgentStream(agentConfig.name);
      logger.info(`Created stream for agent: ${agentConfig.name}`);
    }

    // Example 2: Pipeline Workflow
    logger.info('=== Example 2: Pipeline Workflow ===');
    
    const pipelineWorkflow = {
      workflow: {
        id: 'design-implement-review',
        name: 'Design-Implement-Review Pipeline',
        description: 'Sequential workflow through design, implementation, and review',
        steps: [
          {
            id: 'design',
            name: 'Design Architecture',
            agent: 'architect',
            prompt: 'Design a REST API for a todo list application',
            outputKey: 'api_design',
            timeout: 5000
          },
          {
            id: 'implement',
            name: 'Implement Code',
            agent: 'developer',
            prompt: 'Implement the API based on design: {{api_design}}',
            dependsOn: ['design'],
            outputKey: 'implementation',
            timeout: 5000
          },
          {
            id: 'review',
            name: 'Review Code',
            agent: 'reviewer',
            prompt: 'Review the implementation: {{implementation}}',
            dependsOn: ['implement'],
            outputKey: 'review_results',
            timeout: 5000
          }
        ],
        parallel: false,
        onError: 'stop'
      }
    };

    const pipelineResult = await mcpIntegration.handleToolCall(
      'execute_ai_workflow',
      pipelineWorkflow
    );
    logger.info('Pipeline workflow completed:', pipelineResult);

    // Example 3: Parallel Workflow
    logger.info('=== Example 3: Parallel Workflow ===');
    
    const parallelWorkflow = {
      workflow: {
        id: 'parallel-analysis',
        name: 'Parallel Analysis',
        description: 'Multiple agents analyze the same problem in parallel',
        steps: [
          {
            id: 'analysis1',
            name: 'Architecture Analysis',
            agent: 'architect',
            prompt: 'Analyze scalability requirements for a social media platform',
            outputKey: 'scalability_analysis'
          },
          {
            id: 'analysis2',
            name: 'Security Analysis',
            agent: 'developer',
            prompt: 'Analyze security requirements for a social media platform',
            outputKey: 'security_analysis'
          },
          {
            id: 'analysis3',
            name: 'Performance Analysis',
            agent: 'reviewer',
            prompt: 'Analyze performance requirements for a social media platform',
            outputKey: 'performance_analysis'
          }
        ],
        parallel: true,
        onError: 'continue'
      }
    };

    const parallelResult = await mcpIntegration.handleToolCall(
      'execute_ai_workflow',
      parallelWorkflow
    );
    logger.info('Parallel workflow completed:', parallelResult);

    // Example 4: Memory and Checkpointing
    logger.info('=== Example 4: Memory and Checkpointing ===');
    
    // Save to memory
    await mcpIntegration.handleToolCall('save_orchestration_memory', {
      key: 'project_requirements',
      value: {
        name: 'Social Media Platform',
        features: ['user auth', 'posts', 'comments', 'likes'],
        scale: 'millions of users'
      }
    });
    logger.info('Saved project requirements to memory');

    // Create checkpoint
    const checkpoint = await mcpIntegration.handleToolCall(
      'create_orchestration_checkpoint',
      { description: 'After initial analysis phase' }
    );
    logger.info(`Created checkpoint: ${checkpoint.checkpointId}`);

    // Load from memory
    const loaded = await mcpIntegration.handleToolCall('load_orchestration_memory', {
      key: 'project_requirements'
    });
    logger.info('Loaded from memory:', loaded);

    // Example 5: Consensus Workflow
    logger.info('=== Example 5: Consensus Workflow ===');
    
    const consensusWorkflow = mcpIntegration.createWorkflowPattern('consensus', {
      agents: ['architect', 'developer', 'reviewer'],
      prompt: 'What is the best database choice for our social media platform?',
      name: 'Database Selection Consensus'
    });

    orchestrator.registerWorkflow(consensusWorkflow);
    const consensusResult = await orchestrator.executeWorkflow(consensusWorkflow.id);
    logger.info('Consensus workflow completed');

    // Example 6: Stream Monitoring
    logger.info('=== Example 6: Stream Monitoring ===');
    
    const stats = streamHandler.getAllStreams();
    for (const [name, stream] of stats) {
      const streamStats = stream.getStats();
      logger.info(`Stream ${name}: ${JSON.stringify(streamStats)}`);
    }

    // Example 7: Agent Status
    logger.info('=== Example 7: Agent Status ===');
    
    const status = await mcpIntegration.handleToolCall('get_agent_status', {});
    logger.info('Agent status:', status);

    // Example 8: Direct Agent Injection
    logger.info('=== Example 8: Direct Agent Injection ===');
    
    const injectionResult = await mcpIntegration.handleToolCall('inject_prompt_to_agent', {
      agent: 'architect',
      prompt: 'Describe microservices architecture in one sentence',
      humanLike: false,
      waitForReady: true,
      timeout: 5000
    });
    logger.info('Injection result:', injectionResult);

  } catch (error) {
    logger.error('Demo failed:', error);
  } finally {
    // Cleanup
    logger.info('Cleaning up...');
    
    // Terminate all agents
    for (const agent of ['architect', 'developer', 'reviewer']) {
      try {
        await mcpIntegration.handleToolCall('terminate_ai_agent', { agent });
        logger.info(`Terminated agent: ${agent}`);
      } catch (e) {
        // Agent might already be terminated
      }
    }

    // Clear streams
    streamHandler.clearAll();
    
    // Shutdown orchestrator
    orchestrator.shutdown();
    
    logger.info('Demo completed');
    process.exit(0);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the demo
if (require.main === module) {
  runDemo().catch(error => {
    logger.error('Demo error:', error);
    process.exit(1);
  });
}