import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  PTYManager, 
  StateDetector, 
  InputInjector,
  Orchestrator,
  createOrchestrator,
  AGENT_CONFIGS,
  WORKFLOW_PATTERNS
} from '../src/terminal-wrapper';
import { Logger, LogLevel } from '../src/utils/logger';

// Set up test logging
Logger.setGlobalConfig({
  level: LogLevel.DEBUG,
  console: true,
  file: './test-logs/terminal-wrapper.log'
});

describe('Terminal Wrapper Tests', () => {
  describe('PTYManager', () => {
    let pty: PTYManager;

    afterEach(async () => {
      if (pty && pty.isAlive()) {
        pty.kill();
      }
    });

    it('should spawn a shell process', async () => {
      pty = new PTYManager({
        command: 'sh',
        args: ['-c', 'echo "Hello Terminal"']
      });

      await pty.spawn();
      expect(pty.isAlive()).toBe(true);
      expect(pty.getPid()).toBeDefined();
    });

    it('should capture output', async () => {
      pty = new PTYManager({
        command: 'sh',
        args: ['-c', 'echo "Test Output"']
      });

      let outputReceived = '';
      pty.on('output', (data) => {
        outputReceived += data;
      });

      await pty.spawn();
      
      // Wait for output
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(outputReceived).toContain('Test Output');
    });

    it('should detect ready state', async () => {
      pty = new PTYManager({
        command: 'sh'
      });

      await pty.spawn();
      
      // Write a command that will produce a prompt
      await pty.write('echo "ready"\n');
      
      // Wait for ready state
      const state = await Promise.race([
        pty.waitForState('ready', 2000),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 2000))
      ]);

      expect(pty.getState()).not.toBe('terminated');
    });

    it('should handle command injection', async () => {
      pty = new PTYManager({
        command: 'sh'
      });

      await pty.spawn();
      
      // Inject a command
      await pty.writeCommand('echo "Injected Command"');
      
      // Wait for output
      const output = await pty.waitForOutput(/Injected Command/, 2000);
      
      expect(output).toContain('Injected Command');
    });
  });

  describe('StateDetector', () => {
    let detector: StateDetector;

    beforeEach(() => {
      detector = new StateDetector();
    });

    it('should detect ready state from prompt', () => {
      const result = detector.analyzeOutput('$ ');
      expect(result).toBeDefined();
      expect(result?.state).toBe('ready');
    });

    it('should detect error state', () => {
      const result = detector.analyzeOutput('Error: Command not found');
      expect(result).toBeDefined();
      expect(result?.state).toBe('error');
    });

    it('should detect processing state', () => {
      const result = detector.analyzeOutput('Processing...');
      expect(result).toBeDefined();
      expect(result?.state).toBe('processing');
    });

    it('should maintain state history', () => {
      detector.processOutput('$ ');
      detector.processOutput('Processing...');
      detector.processOutput('Error: Failed');
      
      const history = detector.getStateHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const states = history.map(h => h.state);
      expect(states).toContain('ready');
      expect(states).toContain('processing');
      expect(states).toContain('error');
    });
  });

  describe('InputInjector', () => {
    let injector: InputInjector;
    let pty: PTYManager;

    beforeEach(() => {
      injector = new InputInjector();
    });

    afterEach(() => {
      if (pty && pty.isAlive()) {
        pty.kill();
      }
    });

    it('should inject text to PTY', async () => {
      pty = new PTYManager({
        command: 'sh'
      });
      await pty.spawn();

      injector.registerAgent('test-agent', pty);

      const result = await injector.injectPrompt(
        'test-agent',
        'echo "Injected via InputInjector"',
        { waitForReady: false, timeout: 2000 }
      );

      expect(result.success).toBe(true);
      expect(result.injectedText).toContain('Injected via InputInjector');
    });

    it('should support human-like typing', async () => {
      pty = new PTYManager({
        command: 'sh'
      });
      await pty.spawn();

      injector.registerAgent('test-agent', pty);

      const startTime = Date.now();
      const result = await injector.injectPrompt(
        'test-agent',
        'test',
        { 
          humanLike: true, 
          typingSpeed: 600, // Very fast for testing
          waitForReady: false 
        }
      );

      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeGreaterThan(100); // Should take some time
    });

    it('should handle injection queue', async () => {
      pty = new PTYManager({
        command: 'sh'
      });
      await pty.spawn();

      injector.registerAgent('test-agent', pty);

      // Queue multiple injections
      const promises = [
        injector.queueInjection('test-agent', 'echo "First"', {}, 1),
        injector.queueInjection('test-agent', 'echo "Second"', {}, 2),
        injector.queueInjection('test-agent', 'echo "Third"', {}, 0)
      ];

      const results = await Promise.all(promises);
      
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Orchestrator', () => {
    let orchestrator: Orchestrator;

    beforeEach(() => {
      orchestrator = createOrchestrator({
        enableWebSocket: false // Disable for testing
      });
    });

    afterEach(() => {
      orchestrator.shutdown();
    });

    it('should spawn an agent', async () => {
      const agent = await orchestrator.spawnAgent({
        name: 'test-shell',
        type: 'custom',
        command: 'sh',
        args: []
      });

      expect(agent).toBeDefined();
      expect(agent.config.name).toBe('test-shell');
      expect(agent.pty.isAlive()).toBe(true);
    });

    it('should execute a simple workflow', async () => {
      // Spawn a test agent
      await orchestrator.spawnAgent({
        name: 'test-agent',
        type: 'custom',
        command: 'sh',
        args: []
      });

      // Register a simple workflow
      const workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step1',
            name: 'Echo Test',
            agent: 'test-agent',
            prompt: 'echo "Workflow Test"',
            outputKey: 'test-output'
          }
        ],
        parallel: false,
        onError: 'stop' as const
      };

      orchestrator.registerWorkflow(workflow);

      // Execute workflow
      const results = await orchestrator.executeWorkflow('test-workflow');
      
      expect(results.size).toBe(1);
      expect(results.has('step1')).toBe(true);
    });

    it('should handle shared memory', async () => {
      await orchestrator.saveToMemory('test-key', 'test-value');
      const value = await orchestrator.loadFromMemory('test-key');
      
      expect(value).toBe('test-value');
    });

    it('should create and restore checkpoints', async () => {
      await orchestrator.saveToMemory('checkpoint-test', 'before');
      
      const checkpointId = await orchestrator.checkpoint();
      expect(checkpointId).toBeDefined();
      
      // Modify memory
      await orchestrator.saveToMemory('checkpoint-test', 'after');
      
      // Restore
      await orchestrator.restoreFromCheckpoint(checkpointId);
      
      const restored = await orchestrator.loadFromMemory('checkpoint-test');
      expect(restored).toBe('before');
    });
  });

  describe('Workflow Patterns', () => {
    it('should create pipeline workflow', () => {
      const steps = [
        { id: 'step1', name: 'Step 1', prompt: 'Do step 1' },
        { id: 'step2', name: 'Step 2', prompt: 'Do step 2' },
        { id: 'step3', name: 'Step 3', prompt: 'Do step 3' }
      ];

      const workflow = WORKFLOW_PATTERNS.pipeline(steps);
      
      expect(workflow.parallel).toBe(false);
      expect(workflow.steps[1].dependsOn).toEqual(['step1']);
      expect(workflow.steps[2].dependsOn).toEqual(['step2']);
    });

    it('should create parallel workflow', () => {
      const steps = [
        { id: 'task1', name: 'Task 1', prompt: 'Do task 1' },
        { id: 'task2', name: 'Task 2', prompt: 'Do task 2' },
        { id: 'task3', name: 'Task 3', prompt: 'Do task 3' }
      ];

      const workflow = WORKFLOW_PATTERNS.parallel(steps);
      
      expect(workflow.parallel).toBe(true);
      expect(workflow.steps.every(s => !s.dependsOn)).toBe(true);
    });

    it('should create map-reduce workflow', () => {
      const mapSteps = [
        { id: 'map1', name: 'Map 1', prompt: 'Process chunk 1' },
        { id: 'map2', name: 'Map 2', prompt: 'Process chunk 2' }
      ];
      
      const reduceStep = {
        id: 'reduce',
        name: 'Reduce',
        prompt: 'Combine results'
      };

      const workflow = WORKFLOW_PATTERNS.mapReduce(mapSteps, reduceStep);
      
      expect(workflow.parallel).toBe(true);
      expect(workflow.steps[2].dependsOn).toEqual(['map1', 'map2']);
    });

    it('should create consensus workflow', () => {
      const agents = ['agent1', 'agent2', 'agent3'];
      const prompt = 'Solve this problem';

      const workflow = WORKFLOW_PATTERNS.consensus(agents, prompt);
      
      expect(workflow.parallel).toBe(true);
      expect(workflow.steps.length).toBe(6); // 3 proposals + 3 reviews
      
      // Check that reviews depend on all proposals
      const reviewSteps = workflow.steps.filter(s => s.id.startsWith('review_'));
      const proposalIds = workflow.steps
        .filter(s => s.id.startsWith('proposal_'))
        .map(s => s.id);
      
      expect(reviewSteps.every(r => 
        JSON.stringify(r.dependsOn) === JSON.stringify(proposalIds)
      )).toBe(true);
    });
  });
});