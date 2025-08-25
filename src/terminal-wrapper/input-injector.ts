import { PTYManager } from './pty-manager';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface InjectionOptions {
  humanLike?: boolean;           // Simulate human typing
  typingSpeed?: number;          // Characters per minute (for human-like mode)
  waitForReady?: boolean;        // Wait for ready state before injecting
  timeout?: number;              // Timeout in milliseconds
  confirmWithEnter?: boolean;    // Automatically add enter key
  clearBefore?: boolean;         // Send clear command before injection
  validateResponse?: boolean;    // Wait for response validation
}

export interface InjectionResult {
  success: boolean;
  injectedText: string;
  responseReceived?: string;
  duration: number;
  error?: Error;
}

export interface InjectionQueueItem {
  id: string;
  agentName: string;
  text: string;
  options: InjectionOptions;
  priority: number;
  timestamp: number;
  retries: number;
  callback?: (result: InjectionResult) => void;
}

export class InputInjector extends EventEmitter {
  private agents: Map<string, PTYManager> = new Map();
  private injectionQueue: InjectionQueueItem[] = [];
  private activeInjections: Map<string, InjectionQueueItem> = new Map();
  private logger: Logger;
  private isProcessing: boolean = false;
  private injectionHistory: InjectionResult[] = [];
  private maxHistorySize: number = 100;

  constructor() {
    super();
    this.logger = new Logger('InputInjector');
  }

  registerAgent(name: string, ptyManager: PTYManager): void {
    this.agents.set(name, ptyManager);
    this.logger.info(`Registered agent: ${name}`);
  }

  unregisterAgent(name: string): void {
    this.agents.delete(name);
    this.activeInjections.delete(name);
    this.logger.info(`Unregistered agent: ${name}`);
  }

  async injectPrompt(
    agentName: string, 
    text: string, 
    options: InjectionOptions = {}
  ): Promise<InjectionResult> {
    const startTime = Date.now();
    
    try {
      const agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Agent not found: ${agentName}`);
      }

      // Default options
      const opts: InjectionOptions = {
        humanLike: false,
        typingSpeed: 300, // 300 CPM = 60 WPM
        waitForReady: true,
        timeout: 30000,
        confirmWithEnter: true,
        clearBefore: false,
        validateResponse: false,
        ...options
      };

      this.logger.debug(`Injecting to ${agentName}: ${text.substring(0, 50)}...`);

      // Clear terminal if requested
      if (opts.clearBefore) {
        await this.clearTerminal(agent);
      }

      // Wait for ready state if requested
      if (opts.waitForReady) {
        await this.waitForReady(agent, opts.timeout || 30000);
      }

      // Inject the text
      if (opts.humanLike) {
        await this.injectHumanLike(agent, text, opts.typingSpeed || 300);
      } else {
        await agent.write(text);
      }

      // Add enter key if requested
      if (opts.confirmWithEnter && !text.endsWith('\n') && !text.endsWith('\r')) {
        await agent.write('\n');
      }

      // Wait for response if validation requested
      let responseReceived: string | undefined;
      if (opts.validateResponse) {
        responseReceived = await this.waitForResponse(agent, opts.timeout || 30000);
      }

      const result: InjectionResult = {
        success: true,
        injectedText: text,
        responseReceived,
        duration: Date.now() - startTime
      };

      this.addToHistory(result);
      this.emit('injection-complete', { agentName, result });
      
      return result;

    } catch (error) {
      const result: InjectionResult = {
        success: false,
        injectedText: text,
        duration: Date.now() - startTime,
        error: error as Error
      };

      this.addToHistory(result);
      this.emit('injection-failed', { agentName, error });
      
      throw error;
    }
  }

  private async injectHumanLike(
    agent: PTYManager, 
    text: string, 
    typingSpeed: number
  ): Promise<void> {
    // Calculate delay between characters based on typing speed (CPM)
    const baseDelay = 60000 / typingSpeed; // ms per character
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Add variability to simulate human typing
      const variation = 0.3; // 30% variation
      const minDelay = baseDelay * (1 - variation);
      const maxDelay = baseDelay * (1 + variation);
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      
      // Occasionally add longer pauses (thinking)
      const longPauseChance = 0.05; // 5% chance
      const actualDelay = Math.random() < longPauseChance ? delay * 3 : delay;
      
      await agent.write(char);
      
      // Don't delay after the last character
      if (i < text.length - 1) {
        await this.sleep(actualDelay);
      }
      
      // Emit progress for long texts
      if (i % 10 === 0) {
        this.emit('typing-progress', {
          agent: agent,
          progress: i / text.length,
          character: i
        });
      }
    }
  }

  async queueInjection(
    agentName: string,
    text: string,
    options: InjectionOptions = {},
    priority: number = 0
  ): Promise<InjectionResult> {
    return new Promise((resolve, reject) => {
      const item: InjectionQueueItem = {
        id: this.generateId(),
        agentName,
        text,
        options,
        priority,
        timestamp: Date.now(),
        retries: 0,
        callback: (result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(result.error);
          }
        }
      };

      this.injectionQueue.push(item);
      this.injectionQueue.sort((a, b) => b.priority - a.priority);
      
      this.logger.debug(`Queued injection for ${agentName}, queue size: ${this.injectionQueue.length}`);
      this.emit('injection-queued', item);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.injectionQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.injectionQueue.length > 0) {
      const item = this.injectionQueue.shift();
      if (!item) break;

      // Skip if agent is already busy
      if (this.activeInjections.has(item.agentName)) {
        // Re-queue the item
        this.injectionQueue.unshift(item);
        await this.sleep(100);
        continue;
      }

      this.activeInjections.set(item.agentName, item);

      try {
        const result = await this.injectPrompt(
          item.agentName,
          item.text,
          item.options
        );
        
        if (item.callback) {
          item.callback(result);
        }
      } catch (error) {
        // Retry logic
        if (item.retries < 3) {
          item.retries++;
          this.logger.warn(`Retrying injection for ${item.agentName}, attempt ${item.retries}`);
          this.injectionQueue.unshift(item);
        } else {
          this.logger.error(`Failed to inject after 3 retries for ${item.agentName}`);
          if (item.callback) {
            item.callback({
              success: false,
              injectedText: item.text,
              duration: 0,
              error: error as Error
            });
          }
        }
      } finally {
        this.activeInjections.delete(item.agentName);
      }
    }

    this.isProcessing = false;
  }

  private async waitForReady(agent: PTYManager, timeout: number): Promise<void> {
    const state = agent.getState();
    if (state === 'ready') return;

    this.logger.debug(`Waiting for agent to be ready, current state: ${state}`);
    await agent.waitForState('ready', timeout);
  }

  private async waitForResponse(agent: PTYManager, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let responseBuffer = '';
      
      const timer = setTimeout(() => {
        agent.removeListener('output', outputHandler);
        reject(new Error('Timeout waiting for response'));
      }, timeout);

      const outputHandler = (data: string) => {
        responseBuffer += data;
        
        // Check if we've received a complete response
        // This is a simple heuristic - could be made more sophisticated
        if (this.isCompleteResponse(responseBuffer)) {
          clearTimeout(timer);
          agent.removeListener('output', outputHandler);
          resolve(responseBuffer);
        }
      };

      agent.on('output', outputHandler);
    });
  }

  private isCompleteResponse(output: string): boolean {
    // Simple heuristics to detect complete response
    const completionIndicators = [
      /\n[>❯$#]\s*$/,        // New prompt appeared
      /\[END\]/i,            // Explicit end marker
      /\n{2,}$/,             // Multiple newlines at end
      /\.\s*$/               // Sentence ending
    ];

    return completionIndicators.some(pattern => pattern.test(output));
  }

  private async clearTerminal(agent: PTYManager): Promise<void> {
    // Send clear command (works for most terminals)
    await agent.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to top
    // Alternative: await agent.write('clear\n');
  }

  async injectToAll(text: string, options: InjectionOptions = {}): Promise<Map<string, InjectionResult>> {
    const results = new Map<string, InjectionResult>();
    const promises: Promise<void>[] = [];

    for (const [agentName] of this.agents) {
      promises.push(
        this.injectPrompt(agentName, text, options)
          .then(result => {
            results.set(agentName, result);
          })
          .catch(error => {
            results.set(agentName, {
              success: false,
              injectedText: text,
              duration: 0,
              error
            });
          })
      );
    }

    await Promise.all(promises);
    return results;
  }

  async injectSequence(
    agentName: string,
    prompts: string[],
    delayBetween: number = 1000
  ): Promise<InjectionResult[]> {
    const results: InjectionResult[] = [];

    for (const prompt of prompts) {
      const result = await this.injectPrompt(agentName, prompt);
      results.push(result);
      
      if (delayBetween > 0) {
        await this.sleep(delayBetween);
      }
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `inj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(result: InjectionResult): void {
    this.injectionHistory.push(result);
    if (this.injectionHistory.length > this.maxHistorySize) {
      this.injectionHistory.shift();
    }
  }

  getHistory(): InjectionResult[] {
    return [...this.injectionHistory];
  }

  getQueueStatus(): {
    queueLength: number;
    activeInjections: string[];
    nextInQueue?: InjectionQueueItem;
  } {
    return {
      queueLength: this.injectionQueue.length,
      activeInjections: Array.from(this.activeInjections.keys()),
      nextInQueue: this.injectionQueue[0]
    };
  }

  clearQueue(): void {
    this.injectionQueue = [];
    this.logger.info('Injection queue cleared');
  }

  getAgentStatus(agentName: string): {
    isRegistered: boolean;
    isActive: boolean;
    state?: string;
  } {
    const agent = this.agents.get(agentName);
    return {
      isRegistered: !!agent,
      isActive: this.activeInjections.has(agentName),
      state: agent?.getState()
    };
  }
}