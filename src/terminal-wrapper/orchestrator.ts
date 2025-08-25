import { EventEmitter } from 'events';
import { PTYManager, PTYConfig } from './pty-manager';
import { StateDetector } from './state-detector';
import { InputInjector } from './input-injector';
import { Logger } from '../utils/logger';
import { WebSocket, WebSocketServer } from 'ws';

export interface AgentConfig {
  name: string;
  type: 'claude' | 'gemini' | 'gpt4' | 'llama' | 'custom';
  command: string;
  args?: string[];
  capabilities?: string[];
  maxTokens?: number;
  costPerToken?: number;
  env?: Record<string, string>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agent?: string;  // Specific agent or let orchestrator choose
  prompt: string;
  requirements?: string[];
  timeout?: number;
  dependsOn?: string[];  // Step IDs this step depends on
  outputKey?: string;    // Key to store output in shared memory
  retryOnError?: boolean;
  maxRetries?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  parallel?: boolean;  // Run steps in parallel where possible
  onError?: 'stop' | 'continue' | 'retry';
}

export interface Agent {
  config: AgentConfig;
  pty: PTYManager;
  stateDetector: StateDetector;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: WorkflowStep;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    totalTokensUsed: number;
    totalCost: number;
    averageResponseTime: number;
    uptime: number;
    lastActivity: number;
  };
}

export interface OrchestratorConfig {
  port?: number;
  maxAgents?: number;
  defaultTimeout?: number;
  enableWebSocket?: boolean;
  memoryNamespace?: string;
}

export class Orchestrator extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private sharedMemory: Map<string, any> = new Map();
  private inputInjector: InputInjector;
  private logger: Logger;
  private config: OrchestratorConfig;
  private wsServer?: WebSocketServer;
  private activeWorkflows: Map<string, Set<string>> = new Map(); // workflow ID -> active step IDs
  private completedSteps: Map<string, any> = new Map(); // step ID -> result

  constructor(config: OrchestratorConfig = {}) {
    super();
    this.config = {
      port: 9800,
      maxAgents: 10,
      defaultTimeout: 30000,
      enableWebSocket: true,
      memoryNamespace: 'orchestration',
      ...config
    };
    
    this.logger = new Logger('Orchestrator');
    this.inputInjector = new InputInjector();
    
    if (this.config.enableWebSocket) {
      this.initializeWebSocketServer();
    }
  }

  private initializeWebSocketServer(): void {
    this.wsServer = new WebSocketServer({ 
      port: this.config.port 
    });

    this.wsServer.on('connection', (ws) => {
      this.logger.info('New WebSocket connection established');
      
      ws.on('message', async (message) => {
        try {
          const command = JSON.parse(message.toString());
          await this.handleWebSocketCommand(ws, command);
        } catch (error) {
          this.logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: (error as Error).message
          }));
        }
      });

      // Send initial status
      ws.send(JSON.stringify({
        type: 'status',
        agents: this.getAgentStatuses(),
        workflows: Array.from(this.workflows.keys())
      }));
    });

    this.logger.info(`WebSocket server listening on port ${this.config.port}`);
  }

  private async handleWebSocketCommand(ws: WebSocket, command: any): Promise<void> {
    switch (command.type) {
      case 'spawn':
        await this.spawnAgent(command.config);
        break;
        
      case 'inject':
        await this.injectToAgent(command.agent, command.prompt, command.options);
        break;
        
      case 'execute-workflow':
        await this.executeWorkflow(command.workflowId);
        break;
        
      case 'query':
        ws.send(JSON.stringify({
          type: 'status',
          agents: this.getAgentStatuses(),
          memory: this.getSharedMemorySnapshot()
        }));
        break;
        
      case 'kill':
        await this.terminateAgent(command.agent);
        break;
        
      case 'pause':
        this.pauseAgent(command.agent);
        break;
        
      case 'resume':
        this.resumeAgent(command.agent);
        break;
    }
  }

  async spawnAgent(config: AgentConfig): Promise<Agent> {
    if (this.agents.size >= (this.config.maxAgents || 10)) {
      throw new Error('Maximum number of agents reached');
    }

    if (this.agents.has(config.name)) {
      throw new Error(`Agent ${config.name} already exists`);
    }

    this.logger.info(`Spawning agent: ${config.name} (${config.type})`);

    // Create PTY manager
    const ptyConfig: PTYConfig = {
      command: config.command,
      args: config.args,
      name: `${config.type}-${config.name}`,
      env: config.env
    };
    
    const pty = new PTYManager(ptyConfig);
    await pty.spawn();

    // Create state detector
    const stateDetector = new StateDetector({
      defaultState: 'initializing'
    });

    // Connect state detector to PTY output
    pty.on('output', (data) => {
      stateDetector.processOutput(data);
    });

    // Create agent
    const agent: Agent = {
      config,
      pty,
      stateDetector,
      status: 'idle',
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        averageResponseTime: 0,
        uptime: Date.now(),
        lastActivity: Date.now()
      }
    };

    // Register with input injector
    this.inputInjector.registerAgent(config.name, pty);

    // Set up event handlers
    this.setupAgentEventHandlers(agent);

    // Store agent
    this.agents.set(config.name, agent);

    // Broadcast agent spawn
    this.broadcast({
      type: 'agent-spawned',
      agent: config.name,
      config
    });

    this.emit('agent:spawned', agent);

    return agent;
  }

  private setupAgentEventHandlers(agent: Agent): void {
    // Handle state changes
    agent.stateDetector.on('state-changed', (change) => {
      this.logger.debug(`Agent ${agent.config.name} state: ${change.current}`);
      
      this.broadcast({
        type: 'agent-state',
        agent: agent.config.name,
        state: change.current,
        confidence: change.confidence
      });
    });

    // Handle PTY output
    agent.pty.on('output', (data) => {
      this.broadcast({
        type: 'agent-output',
        agent: agent.config.name,
        data: data
      });
    });

    // Handle PTY termination
    agent.pty.on('terminated', () => {
      agent.status = 'offline';
      this.logger.warn(`Agent ${agent.config.name} terminated`);
      
      this.broadcast({
        type: 'agent-terminated',
        agent: agent.config.name
      });
    });

    // Handle errors
    agent.pty.on('error', (error) => {
      agent.status = 'error';
      this.logger.error(`Agent ${agent.config.name} error:`, error);
      
      this.broadcast({
        type: 'agent-error',
        agent: agent.config.name,
        error: error.message
      });
    });
  }

  async injectToAgent(
    agentName: string, 
    prompt: string, 
    options?: any
  ): Promise<any> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    agent.status = 'busy';
    agent.metrics.lastActivity = Date.now();

    const startTime = Date.now();
    
    try {
      const result = await this.inputInjector.injectPrompt(
        agentName, 
        prompt, 
        options
      );
      
      // Update metrics
      agent.metrics.tasksCompleted++;
      const responseTime = Date.now() - startTime;
      agent.metrics.averageResponseTime = 
        (agent.metrics.averageResponseTime * (agent.metrics.tasksCompleted - 1) + responseTime) 
        / agent.metrics.tasksCompleted;
      
      agent.status = 'idle';
      
      return result;
    } catch (error) {
      agent.metrics.tasksFailed++;
      agent.status = 'error';
      throw error;
    }
  }

  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    this.logger.info(`Registered workflow: ${workflow.name}`);
  }

  async executeWorkflow(workflowId: string): Promise<Map<string, any>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    this.logger.info(`Executing workflow: ${workflow.name}`);
    this.emit('workflow:started', workflow);

    const results = new Map<string, any>();
    this.activeWorkflows.set(workflowId, new Set());

    try {
      if (workflow.parallel) {
        await this.executeParallelWorkflow(workflow, results);
      } else {
        await this.executeSequentialWorkflow(workflow, results);
      }

      this.emit('workflow:completed', { workflow, results });
      return results;

    } catch (error) {
      this.logger.error(`Workflow ${workflow.name} failed:`, error);
      
      if (workflow.onError === 'stop') {
        this.emit('workflow:failed', { workflow, error });
        throw error;
      } else if (workflow.onError === 'continue') {
        this.emit('workflow:partial', { workflow, results, error });
        return results;
      }
      
      throw error;
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  private async executeSequentialWorkflow(
    workflow: Workflow, 
    results: Map<string, any>
  ): Promise<void> {
    for (const step of workflow.steps) {
      await this.executeWorkflowStep(workflow, step, results);
    }
  }

  private async executeParallelWorkflow(
    workflow: Workflow,
    results: Map<string, any>
  ): Promise<void> {
    // Group steps by dependencies
    const stepGroups = this.groupStepsByDependencies(workflow.steps);
    
    // Execute each group in sequence, but steps within a group in parallel
    for (const group of stepGroups) {
      const promises = group.map(step => 
        this.executeWorkflowStep(workflow, step, results)
      );
      
      await Promise.all(promises);
    }
  }

  private groupStepsByDependencies(steps: WorkflowStep[]): WorkflowStep[][] {
    const groups: WorkflowStep[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(steps);
    
    while (remaining.size > 0) {
      const group: WorkflowStep[] = [];
      
      for (const step of remaining) {
        // Check if all dependencies are completed
        const dependenciesMet = !step.dependsOn || 
          step.dependsOn.every(dep => completed.has(dep));
        
        if (dependenciesMet) {
          group.push(step);
        }
      }
      
      if (group.length === 0) {
        throw new Error('Circular dependency detected in workflow');
      }
      
      // Remove from remaining and add to completed
      for (const step of group) {
        remaining.delete(step);
        completed.add(step.id);
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  private async executeWorkflowStep(
    workflow: Workflow,
    step: WorkflowStep,
    results: Map<string, any>
  ): Promise<void> {
    this.logger.debug(`Executing step: ${step.name}`);
    this.emit('step:started', { workflow, step });

    const activeSteps = this.activeWorkflows.get(workflow.id);
    if (activeSteps) {
      activeSteps.add(step.id);
    }

    try {
      // Find suitable agent
      const agent = this.findBestAgent(step);
      if (!agent) {
        throw new Error(`No suitable agent for step: ${step.name}`);
      }

      agent.currentTask = step;

      // Build prompt with variable substitution
      const prompt = this.buildPrompt(step.prompt);

      // Execute with retry logic
      let attempts = 0;
      const maxRetries = step.maxRetries || 3;
      let result: any;

      while (attempts < maxRetries) {
        try {
          result = await this.injectToAgent(
            agent.config.name,
            prompt,
            { timeout: step.timeout || this.config.defaultTimeout }
          );
          break;
        } catch (error) {
          attempts++;
          if (attempts >= maxRetries || !step.retryOnError) {
            throw error;
          }
          this.logger.warn(`Retrying step ${step.name}, attempt ${attempts}`);
          await this.sleep(2000 * attempts); // Exponential backoff
        }
      }

      // Store result
      if (step.outputKey) {
        this.sharedMemory.set(step.outputKey, result);
      }
      
      results.set(step.id, result);
      this.completedSteps.set(step.id, result);

      agent.currentTask = undefined;
      
      this.emit('step:completed', { workflow, step, result });

    } finally {
      if (activeSteps) {
        activeSteps.delete(step.id);
      }
    }
  }

  private findBestAgent(step: WorkflowStep): Agent | null {
    // If specific agent requested
    if (step.agent) {
      const agent = this.agents.get(step.agent);
      if (agent && agent.status === 'idle') {
        return agent;
      }
      return null;
    }

    // Find best available agent based on requirements
    let bestAgent: Agent | null = null;
    let bestScore = 0;

    for (const agent of this.agents.values()) {
      if (agent.status !== 'idle') continue;

      let score = 1;

      // Check capabilities match
      if (step.requirements && agent.config.capabilities) {
        const matches = step.requirements.filter(req => 
          agent.config.capabilities?.includes(req)
        ).length;
        score += matches * 10;
      }

      // Prefer agents with better success rate
      const successRate = agent.metrics.tasksCompleted > 0
        ? agent.metrics.tasksCompleted / (agent.metrics.tasksCompleted + agent.metrics.tasksFailed)
        : 0.5;
      score *= successRate;

      // Consider response time
      if (agent.metrics.averageResponseTime > 0) {
        score *= (10000 / agent.metrics.averageResponseTime);
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  private buildPrompt(template: string): string {
    let prompt = template;

    // Replace variables from shared memory
    const variables = template.match(/\{\{(\w+)\}\}/g) || [];
    
    for (const variable of variables) {
      const key = variable.slice(2, -2);
      const value = this.sharedMemory.get(key);
      
      if (value !== undefined) {
        prompt = prompt.replace(variable, String(value));
      }
    }

    return prompt;
  }

  async terminateAgent(agentName: string): Promise<void> {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    this.logger.info(`Terminating agent: ${agentName}`);
    
    agent.pty.kill();
    this.inputInjector.unregisterAgent(agentName);
    this.agents.delete(agentName);
    
    this.broadcast({
      type: 'agent-removed',
      agent: agentName
    });
  }

  pauseAgent(agentName: string): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    agent.status = 'idle';
    // Could implement more sophisticated pausing logic
  }

  resumeAgent(agentName: string): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    agent.status = 'idle';
  }

  private broadcast(message: any): void {
    if (!this.wsServer) return;

    const data = JSON.stringify(message);
    this.wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private getAgentStatuses(): any[] {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.config.name,
      type: agent.config.type,
      status: agent.status,
      state: agent.stateDetector.getCurrentState(),
      currentTask: agent.currentTask?.name,
      metrics: agent.metrics
    }));
  }

  private getSharedMemorySnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    for (const [key, value] of this.sharedMemory) {
      snapshot[key] = value;
    }
    return snapshot;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Memory coordination methods
  async saveToMemory(key: string, value: any): Promise<void> {
    const fullKey = `${this.config.memoryNamespace}.${key}`;
    this.sharedMemory.set(fullKey, value);
    
    this.emit('memory:saved', { key: fullKey, value });
  }

  async loadFromMemory(key: string): Promise<any> {
    const fullKey = `${this.config.memoryNamespace}.${key}`;
    return this.sharedMemory.get(fullKey);
  }

  async checkpoint(): Promise<string> {
    const checkpointId = `checkpoint_${Date.now()}`;
    const state = {
      agents: this.getAgentStatuses(),
      memory: this.getSharedMemorySnapshot(),
      workflows: Array.from(this.activeWorkflows.keys()),
      timestamp: Date.now()
    };
    
    await this.saveToMemory(checkpointId, state);
    this.logger.info(`Created checkpoint: ${checkpointId}`);
    
    return checkpointId;
  }

  async restoreFromCheckpoint(checkpointId: string): Promise<void> {
    const state = await this.loadFromMemory(checkpointId);
    if (!state) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    
    // Restore shared memory
    for (const [key, value] of Object.entries(state.memory)) {
      this.sharedMemory.set(key, value);
    }
    
    this.logger.info(`Restored from checkpoint: ${checkpointId}`);
    this.emit('checkpoint:restored', checkpointId);
  }

  shutdown(): void {
    this.logger.info('Shutting down orchestrator');
    
    // Terminate all agents
    for (const [name] of this.agents) {
      this.terminateAgent(name);
    }
    
    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    this.emit('shutdown');
  }
}