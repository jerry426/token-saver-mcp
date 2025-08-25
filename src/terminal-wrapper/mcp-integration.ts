import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Orchestrator, AgentConfig, Workflow, WorkflowStep } from './orchestrator';
import { Logger } from '../utils/logger';

const logger = new Logger('MCP-Terminal-Integration');

// Schema definitions for MCP tools
const SpawnAgentSchema = z.object({
  name: z.string().describe('Unique name for the agent'),
  type: z.enum(['claude', 'gemini', 'gpt4', 'llama', 'custom']).describe('Type of AI agent'),
  command: z.string().describe('Command to execute'),
  args: z.array(z.string()).optional().describe('Command arguments'),
  capabilities: z.array(z.string()).optional().describe('Agent capabilities'),
  env: z.record(z.string()).optional().describe('Environment variables')
});

const InjectPromptSchema = z.object({
  agent: z.string().describe('Agent name to inject prompt to'),
  prompt: z.string().describe('The prompt text to inject'),
  humanLike: z.boolean().optional().describe('Simulate human typing'),
  waitForReady: z.boolean().optional().default(true).describe('Wait for agent to be ready'),
  timeout: z.number().optional().default(30000).describe('Timeout in milliseconds')
});

const ExecuteWorkflowSchema = z.object({
  workflow: z.object({
    id: z.string().describe('Unique workflow ID'),
    name: z.string().describe('Workflow name'),
    description: z.string().optional().describe('Workflow description'),
    steps: z.array(z.object({
      id: z.string().describe('Step ID'),
      name: z.string().describe('Step name'),
      agent: z.string().optional().describe('Specific agent or let orchestrator choose'),
      prompt: z.string().describe('Prompt template with {{variable}} support'),
      requirements: z.array(z.string()).optional().describe('Required capabilities'),
      timeout: z.number().optional().describe('Step timeout'),
      dependsOn: z.array(z.string()).optional().describe('Step dependencies'),
      outputKey: z.string().optional().describe('Key to store output in shared memory'),
      retryOnError: z.boolean().optional().describe('Retry on error'),
      maxRetries: z.number().optional().describe('Maximum retry attempts')
    })).describe('Workflow steps'),
    parallel: z.boolean().optional().default(false).describe('Execute steps in parallel where possible'),
    onError: z.enum(['stop', 'continue', 'retry']).optional().default('stop').describe('Error handling strategy')
  }).describe('Workflow definition')
});

const TerminateAgentSchema = z.object({
  agent: z.string().describe('Agent name to terminate')
});

const GetAgentStatusSchema = z.object({
  agent: z.string().optional().describe('Specific agent or all if omitted')
});

const SaveMemorySchema = z.object({
  key: z.string().describe('Memory key'),
  value: z.any().describe('Value to store')
});

const LoadMemorySchema = z.object({
  key: z.string().describe('Memory key to load')
});

const CreateCheckpointSchema = z.object({
  description: z.string().optional().describe('Checkpoint description')
});

const RestoreCheckpointSchema = z.object({
  checkpointId: z.string().describe('Checkpoint ID to restore')
});

export class MCPTerminalIntegration {
  private orchestrator: Orchestrator;
  private activeAgents: Map<string, any> = new Map();

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator || new Orchestrator({
      port: 9800,
      enableWebSocket: true,
      memoryNamespace: 'mcp_orchestration'
    });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.orchestrator.on('agent:spawned', (agent) => {
      logger.info(`Agent spawned: ${agent.config.name}`);
      this.activeAgents.set(agent.config.name, agent);
    });

    this.orchestrator.on('workflow:started', (workflow) => {
      logger.info(`Workflow started: ${workflow.name}`);
    });

    this.orchestrator.on('workflow:completed', ({ workflow, results }) => {
      logger.info(`Workflow completed: ${workflow.name}`);
    });

    this.orchestrator.on('error', (error) => {
      logger.error('Orchestrator error:', error);
    });
  }

  getTools(): Tool[] {
    return [
      {
        name: 'spawn_ai_agent',
        description: 'Spawn a new AI agent terminal instance for orchestration',
        inputSchema: SpawnAgentSchema
      },
      {
        name: 'inject_prompt_to_agent',
        description: 'Inject a prompt to a specific AI agent and optionally wait for response',
        inputSchema: InjectPromptSchema
      },
      {
        name: 'execute_ai_workflow',
        description: 'Execute a multi-agent workflow with dependencies and parallel execution',
        inputSchema: ExecuteWorkflowSchema
      },
      {
        name: 'terminate_ai_agent',
        description: 'Terminate a running AI agent',
        inputSchema: TerminateAgentSchema
      },
      {
        name: 'get_agent_status',
        description: 'Get status and metrics of AI agents',
        inputSchema: GetAgentStatusSchema
      },
      {
        name: 'save_orchestration_memory',
        description: 'Save data to shared orchestration memory',
        inputSchema: SaveMemorySchema
      },
      {
        name: 'load_orchestration_memory',
        description: 'Load data from shared orchestration memory',
        inputSchema: LoadMemorySchema
      },
      {
        name: 'create_orchestration_checkpoint',
        description: 'Create a checkpoint of current orchestration state',
        inputSchema: CreateCheckpointSchema
      },
      {
        name: 'restore_orchestration_checkpoint',
        description: 'Restore orchestration state from a checkpoint',
        inputSchema: RestoreCheckpointSchema
      }
    ];
  }

  async handleToolCall(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        case 'spawn_ai_agent':
          return await this.spawnAgent(args);
        
        case 'inject_prompt_to_agent':
          return await this.injectPrompt(args);
        
        case 'execute_ai_workflow':
          return await this.executeWorkflow(args);
        
        case 'terminate_ai_agent':
          return await this.terminateAgent(args);
        
        case 'get_agent_status':
          return await this.getAgentStatus(args);
        
        case 'save_orchestration_memory':
          return await this.saveMemory(args);
        
        case 'load_orchestration_memory':
          return await this.loadMemory(args);
        
        case 'create_orchestration_checkpoint':
          return await this.createCheckpoint(args);
        
        case 'restore_orchestration_checkpoint':
          return await this.restoreCheckpoint(args);
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      logger.error(`Tool call failed: ${toolName}`, error);
      throw error;
    }
  }

  private async spawnAgent(args: z.infer<typeof SpawnAgentSchema>): Promise<any> {
    const config: AgentConfig = {
      name: args.name,
      type: args.type,
      command: args.command,
      args: args.args,
      capabilities: args.capabilities,
      env: args.env
    };

    const agent = await this.orchestrator.spawnAgent(config);
    
    return {
      success: true,
      agent: {
        name: agent.config.name,
        type: agent.config.type,
        pid: agent.pty.getPid(),
        status: agent.status,
        state: agent.stateDetector.getCurrentState()
      }
    };
  }

  private async injectPrompt(args: z.infer<typeof InjectPromptSchema>): Promise<any> {
    const result = await this.orchestrator.injectToAgent(
      args.agent,
      args.prompt,
      {
        humanLike: args.humanLike,
        waitForReady: args.waitForReady,
        timeout: args.timeout
      }
    );

    return {
      success: result.success,
      agent: args.agent,
      injectedText: result.injectedText,
      duration: result.duration,
      response: result.responseReceived
    };
  }

  private async executeWorkflow(args: z.infer<typeof ExecuteWorkflowSchema>): Promise<any> {
    const workflow: Workflow = args.workflow;
    
    // Register the workflow
    this.orchestrator.registerWorkflow(workflow);
    
    // Execute it
    const results = await this.orchestrator.executeWorkflow(workflow.id);
    
    // Convert Map to object for JSON serialization
    const resultsObject: Record<string, any> = {};
    for (const [key, value] of results) {
      resultsObject[key] = value;
    }
    
    return {
      success: true,
      workflowId: workflow.id,
      workflowName: workflow.name,
      results: resultsObject
    };
  }

  private async terminateAgent(args: z.infer<typeof TerminateAgentSchema>): Promise<any> {
    await this.orchestrator.terminateAgent(args.agent);
    
    return {
      success: true,
      message: `Agent ${args.agent} terminated`
    };
  }

  private async getAgentStatus(args: z.infer<typeof GetAgentStatusSchema>): Promise<any> {
    const statuses = this.orchestrator['getAgentStatuses']();
    
    if (args.agent) {
      const agentStatus = statuses.find(s => s.name === args.agent);
      if (!agentStatus) {
        throw new Error(`Agent ${args.agent} not found`);
      }
      return agentStatus;
    }
    
    return {
      agents: statuses,
      totalAgents: statuses.length,
      activeAgents: statuses.filter(s => s.status === 'busy').length,
      idleAgents: statuses.filter(s => s.status === 'idle').length
    };
  }

  private async saveMemory(args: z.infer<typeof SaveMemorySchema>): Promise<any> {
    await this.orchestrator.saveToMemory(args.key, args.value);
    
    return {
      success: true,
      key: args.key,
      message: `Saved to memory: ${args.key}`
    };
  }

  private async loadMemory(args: z.infer<typeof LoadMemorySchema>): Promise<any> {
    const value = await this.orchestrator.loadFromMemory(args.key);
    
    return {
      success: true,
      key: args.key,
      value: value,
      found: value !== undefined
    };
  }

  private async createCheckpoint(args: z.infer<typeof CreateCheckpointSchema>): Promise<any> {
    const checkpointId = await this.orchestrator.checkpoint();
    
    // Save description if provided
    if (args.description) {
      await this.orchestrator.saveToMemory(
        `checkpoint_desc_${checkpointId}`,
        args.description
      );
    }
    
    return {
      success: true,
      checkpointId,
      description: args.description,
      timestamp: Date.now()
    };
  }

  private async restoreCheckpoint(args: z.infer<typeof RestoreCheckpointSchema>): Promise<any> {
    await this.orchestrator.restoreFromCheckpoint(args.checkpointId);
    
    // Load description if exists
    const description = await this.orchestrator.loadFromMemory(
      `checkpoint_desc_${args.checkpointId}`
    );
    
    return {
      success: true,
      checkpointId: args.checkpointId,
      description,
      message: `Restored from checkpoint: ${args.checkpointId}`
    };
  }

  // Helper method to create common workflow patterns
  createWorkflowPattern(
    type: 'pipeline' | 'parallel' | 'mapReduce' | 'consensus',
    config: any
  ): Workflow {
    const timestamp = Date.now();
    
    switch (type) {
      case 'pipeline':
        return this.createPipelineWorkflow(config.steps, config.name);
      
      case 'parallel':
        return this.createParallelWorkflow(config.steps, config.name);
      
      case 'mapReduce':
        return this.createMapReduceWorkflow(
          config.mapSteps,
          config.reduceStep,
          config.name
        );
      
      case 'consensus':
        return this.createConsensusWorkflow(
          config.agents,
          config.prompt,
          config.name
        );
      
      default:
        throw new Error(`Unknown workflow pattern: ${type}`);
    }
  }

  private createPipelineWorkflow(steps: WorkflowStep[], name?: string): Workflow {
    const stepsWithDeps = steps.map((step, index) => ({
      ...step,
      dependsOn: index > 0 ? [steps[index - 1].id] : undefined
    }));

    return {
      id: `pipeline_${Date.now()}`,
      name: name || 'Pipeline Workflow',
      steps: stepsWithDeps,
      parallel: false,
      onError: 'stop'
    };
  }

  private createParallelWorkflow(steps: WorkflowStep[], name?: string): Workflow {
    return {
      id: `parallel_${Date.now()}`,
      name: name || 'Parallel Workflow',
      steps,
      parallel: true,
      onError: 'continue'
    };
  }

  private createMapReduceWorkflow(
    mapSteps: WorkflowStep[],
    reduceStep: WorkflowStep,
    name?: string
  ): Workflow {
    const reduceWithDeps = {
      ...reduceStep,
      dependsOn: mapSteps.map(s => s.id)
    };

    return {
      id: `mapreduce_${Date.now()}`,
      name: name || 'Map-Reduce Workflow',
      steps: [...mapSteps, reduceWithDeps],
      parallel: true,
      onError: 'stop'
    };
  }

  private createConsensusWorkflow(
    agents: string[],
    prompt: string,
    name?: string
  ): Workflow {
    const proposalSteps: WorkflowStep[] = agents.map(agent => ({
      id: `proposal_${agent}`,
      name: `${agent} Proposal`,
      agent,
      prompt,
      outputKey: `proposal.${agent}`
    }));

    const reviewSteps: WorkflowStep[] = agents.map(reviewer => ({
      id: `review_${reviewer}`,
      name: `${reviewer} Review`,
      agent: reviewer,
      prompt: `Review and rank these proposals: {{proposals}}`,
      dependsOn: proposalSteps.map(s => s.id),
      outputKey: `review.${reviewer}`
    }));

    return {
      id: `consensus_${Date.now()}`,
      name: name || 'Consensus Workflow',
      steps: [...proposalSteps, ...reviewSteps],
      parallel: true,
      onError: 'continue'
    };
  }

  shutdown(): void {
    logger.info('Shutting down MCP Terminal Integration');
    this.orchestrator.shutdown();
  }
}