export { PTYManager, PTYConfig, PTYMetrics, PTYState } from './pty-manager';
export { StateDetector, StatePattern, DetectionResult } from './state-detector';
export { InputInjector, InjectionOptions, InjectionResult } from './input-injector';
export { 
  Orchestrator, 
  OrchestratorConfig,
  Agent,
  AgentConfig,
  Workflow,
  WorkflowStep 
} from './orchestrator';

import { Orchestrator, OrchestratorConfig } from './orchestrator';

// Export factory function for easy setup
export function createOrchestrator(config?: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}

// Export predefined agent configurations
export const AGENT_CONFIGS = {
  claude: {
    name: 'claude',
    type: 'claude' as const,
    command: 'claude',
    args: [],
    capabilities: ['code', 'analysis', 'architecture', 'review']
  },
  gemini: {
    name: 'gemini',
    type: 'gemini' as const,
    command: 'gemini',
    args: [],
    capabilities: ['code', 'frontend', 'ui', 'creative']
  },
  gpt4: {
    name: 'gpt4',
    type: 'gpt4' as const,
    command: 'gpt',
    args: ['--model', 'gpt-4'],
    capabilities: ['code', 'backend', 'api', 'optimization']
  },
  llama: {
    name: 'llama',
    type: 'llama' as const,
    command: 'llama',
    args: [],
    capabilities: ['testing', 'documentation', 'analysis']
  }
};

// Export predefined workflow patterns
export const WORKFLOW_PATTERNS = {
  pipeline: (steps: WorkflowStep[]): Workflow => ({
    id: `pipeline_${Date.now()}`,
    name: 'Pipeline Workflow',
    description: 'Sequential processing through multiple agents',
    steps: steps.map((step, index) => ({
      ...step,
      dependsOn: index > 0 ? [steps[index - 1].id] : undefined
    })),
    parallel: false,
    onError: 'stop'
  }),

  parallel: (steps: WorkflowStep[]): Workflow => ({
    id: `parallel_${Date.now()}`,
    name: 'Parallel Workflow',
    description: 'Execute all steps in parallel',
    steps,
    parallel: true,
    onError: 'continue'
  }),

  mapReduce: (
    mapSteps: WorkflowStep[],
    reduceStep: WorkflowStep
  ): Workflow => ({
    id: `mapreduce_${Date.now()}`,
    name: 'Map-Reduce Workflow',
    description: 'Parallel map phase followed by reduce',
    steps: [
      ...mapSteps,
      {
        ...reduceStep,
        dependsOn: mapSteps.map(s => s.id)
      }
    ],
    parallel: true,
    onError: 'stop'
  }),

  consensus: (agents: string[], prompt: string): Workflow => {
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
      name: 'Consensus Workflow',
      description: 'Multiple agents reach consensus',
      steps: [...proposalSteps, ...reviewSteps],
      parallel: true,
      onError: 'continue'
    };
  }
};