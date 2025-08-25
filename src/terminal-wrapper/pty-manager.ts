import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

export interface PTYConfig {
  command: string;
  args?: string[];
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface PTYMetrics {
  startTime: number;
  endTime?: number;
  bytesWritten: number;
  bytesRead: number;
  commandCount: number;
  errorCount: number;
  lastActivity: number;
}

export type PTYState = 
  | 'initializing' 
  | 'ready' 
  | 'processing' 
  | 'waiting'
  | 'error' 
  | 'terminated';

export interface PTYManagerEvents {
  'state-change': (state: PTYState, previousState: PTYState) => void;
  'output': (data: string) => void;
  'ready': () => void;
  'error': (error: Error) => void;
  'terminated': (exitCode: number, signal?: number) => void;
  'prompt-detected': (prompt: string) => void;
}

export class PTYManager extends EventEmitter {
  private pty: pty.IPty | null = null;
  private config: PTYConfig;
  private state: PTYState = 'initializing';
  private outputBuffer: string = '';
  private currentPrompt: string = '';
  private metrics: PTYMetrics;
  private logger: Logger;
  private readyPatterns: RegExp[] = [];
  private errorPatterns: RegExp[] = [];
  private completionPatterns: RegExp[] = [];
  private outputAccumulator: string = '';
  private maxBufferSize = 1024 * 1024; // 1MB buffer limit

  constructor(config: PTYConfig) {
    super();
    this.config = config;
    this.logger = new Logger(`PTY:${config.name || config.command}`);
    this.metrics = {
      startTime: Date.now(),
      bytesWritten: 0,
      bytesRead: 0,
      commandCount: 0,
      errorCount: 0,
      lastActivity: Date.now()
    };
    
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Common prompt patterns for various AI CLIs
    this.readyPatterns = [
      /^[>❯$#]\s*$/m,                    // Common prompt characters
      /^(gemini|claude|gpt|llama)>\s*$/im, // Named AI prompts
      /^assistant>\s*$/im,                // Generic assistant prompt
      /\n>>> $/,                          // Python-style prompt
      /\nAI\s*:\s*$/,                     // Conversational prompt
      /\n\$ $/,                           // Shell prompt
      /Ready for input/i,                // Explicit ready message
      /Enter your prompt:/i              // Input request
    ];

    // Error detection patterns
    this.errorPatterns = [
      /^Error:/im,
      /^Failed to/im,
      /^Exception:/im,
      /Rate limit exceeded/i,
      /Authentication failed/i,
      /Connection refused/i,
      /Timeout/i,
      /Invalid request/i,
      /API error/i
    ];

    // Completion detection patterns
    this.completionPatterns = [
      /^Task completed$/im,
      /^---\s*END\s*---$/im,
      /\[END OF RESPONSE\]/i,
      /^Done\.$/im,
      /^Finished\.$/im,
      /Response complete/i
    ];
  }

  async spawn(): Promise<void> {
    try {
      this.logger.info(`Spawning PTY: ${this.config.command} ${this.config.args?.join(' ') || ''}`);
      
      this.pty = pty.spawn(this.config.command, this.config.args || [], {
        name: this.config.name || 'xterm-256color',
        cols: this.config.cols || 120,
        rows: this.config.rows || 40,
        cwd: this.config.cwd || process.cwd(),
        env: { ...process.env, ...this.config.env }
      });

      this.setupEventHandlers();
      this.setState('ready');
      
      this.logger.info(`PTY spawned successfully with PID: ${this.pty.pid}`);
    } catch (error) {
      this.logger.error('Failed to spawn PTY:', error);
      this.setState('error');
      this.emit('error', error as Error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.pty) return;

    this.pty.onData((data: string) => {
      this.handleOutput(data);
    });

    this.pty.onExit(({ exitCode, signal }) => {
      this.logger.info(`PTY exited with code ${exitCode}, signal ${signal}`);
      this.metrics.endTime = Date.now();
      this.setState('terminated');
      this.emit('terminated', exitCode, signal);
      this.cleanup();
    });
  }

  private handleOutput(data: string): void {
    this.metrics.bytesRead += Buffer.byteLength(data);
    this.metrics.lastActivity = Date.now();
    
    // Add to output buffer with size limit
    this.outputBuffer += data;
    if (this.outputBuffer.length > this.maxBufferSize) {
      this.outputBuffer = this.outputBuffer.slice(-this.maxBufferSize / 2);
    }
    
    // Accumulate output for pattern detection
    this.outputAccumulator += data;
    if (this.outputAccumulator.length > 10000) {
      this.outputAccumulator = this.outputAccumulator.slice(-5000);
    }
    
    // Emit raw output
    this.emit('output', data);
    
    // Detect state transitions
    this.detectStateTransitions(data);
  }

  private detectStateTransitions(data: string): void {
    const previousState = this.state;
    
    // Check for ready state (prompt detection)
    for (const pattern of this.readyPatterns) {
      if (pattern.test(this.outputAccumulator)) {
        const match = this.outputAccumulator.match(pattern);
        if (match) {
          this.currentPrompt = match[0];
          this.setState('ready');
          this.emit('prompt-detected', this.currentPrompt);
          return;
        }
      }
    }
    
    // Check for error state
    for (const pattern of this.errorPatterns) {
      if (pattern.test(data)) {
        this.setState('error');
        this.metrics.errorCount++;
        return;
      }
    }
    
    // Check for completion
    for (const pattern of this.completionPatterns) {
      if (pattern.test(data)) {
        this.setState('ready');
        return;
      }
    }
    
    // If we were ready and received new data, we're likely processing
    if (previousState === 'ready' && data.trim().length > 0) {
      this.setState('processing');
    }
  }

  private setState(newState: PTYState): void {
    if (this.state === newState) return;
    
    const previousState = this.state;
    this.state = newState;
    
    this.logger.debug(`State transition: ${previousState} -> ${newState}`);
    this.emit('state-change', newState, previousState);
    
    if (newState === 'ready') {
      this.emit('ready');
    }
  }

  async write(text: string): Promise<void> {
    if (!this.pty) {
      throw new Error('PTY not initialized');
    }
    
    if (this.state === 'terminated') {
      throw new Error('PTY has terminated');
    }
    
    this.logger.debug(`Writing to PTY: ${text.substring(0, 50)}...`);
    
    this.pty.write(text);
    this.metrics.bytesWritten += Buffer.byteLength(text);
    this.metrics.lastActivity = Date.now();
    
    // If we're writing a command (ends with newline), increment command count
    if (text.includes('\n') || text.includes('\r')) {
      this.metrics.commandCount++;
      this.setState('processing');
    }
  }

  async writeCommand(command: string): Promise<void> {
    // Ensure command ends with newline
    const fullCommand = command.endsWith('\n') ? command : `${command}\n`;
    await this.write(fullCommand);
  }

  async writeWithDelay(text: string, delayMs: number = 50): Promise<void> {
    for (const char of text) {
      await this.write(char);
      await new Promise(resolve => setTimeout(resolve, Math.random() * delayMs + 20));
    }
  }

  async waitForState(targetState: PTYState, timeoutMs: number = 30000): Promise<void> {
    if (this.state === targetState) return;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('state-change', stateHandler);
        reject(new Error(`Timeout waiting for state: ${targetState}`));
      }, timeoutMs);
      
      const stateHandler = (newState: PTYState) => {
        if (newState === targetState) {
          clearTimeout(timeout);
          this.removeListener('state-change', stateHandler);
          resolve();
        }
      };
      
      this.on('state-change', stateHandler);
    });
  }

  async waitForPrompt(timeoutMs: number = 30000): Promise<string> {
    if (this.state === 'ready' && this.currentPrompt) {
      return this.currentPrompt;
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('prompt-detected', promptHandler);
        reject(new Error('Timeout waiting for prompt'));
      }, timeoutMs);
      
      const promptHandler = (prompt: string) => {
        clearTimeout(timeout);
        this.removeListener('prompt-detected', promptHandler);
        resolve(prompt);
      };
      
      this.on('prompt-detected', promptHandler);
    });
  }

  async waitForOutput(pattern: RegExp, timeoutMs: number = 30000): Promise<string> {
    const startTime = Date.now();
    let accumulated = '';
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('output', outputHandler);
        reject(new Error(`Timeout waiting for pattern: ${pattern}`));
      }, timeoutMs);
      
      const outputHandler = (data: string) => {
        accumulated += data;
        
        const match = accumulated.match(pattern);
        if (match) {
          clearTimeout(timeout);
          this.removeListener('output', outputHandler);
          resolve(match[0]);
        }
        
        // Prevent unbounded accumulation
        if (accumulated.length > 100000) {
          accumulated = accumulated.slice(-50000);
        }
      };
      
      this.on('output', outputHandler);
    });
  }

  resize(cols: number, rows: number): void {
    if (!this.pty) {
      throw new Error('PTY not initialized');
    }
    
    this.logger.debug(`Resizing PTY to ${cols}x${rows}`);
    this.pty.resize(cols, rows);
  }

  kill(signal?: string): void {
    if (!this.pty) return;
    
    this.logger.info(`Killing PTY with signal: ${signal || 'SIGTERM'}`);
    this.pty.kill(signal);
    this.cleanup();
  }

  private cleanup(): void {
    if (this.pty) {
      this.pty = null;
    }
    
    this.removeAllListeners();
    this.outputBuffer = '';
    this.outputAccumulator = '';
  }

  getState(): PTYState {
    return this.state;
  }

  getMetrics(): PTYMetrics {
    return { ...this.metrics };
  }

  getOutputBuffer(): string {
    return this.outputBuffer;
  }

  getRecentOutput(lines: number = 50): string {
    const outputLines = this.outputBuffer.split('\n');
    return outputLines.slice(-lines).join('\n');
  }

  isAlive(): boolean {
    return this.pty !== null && this.state !== 'terminated';
  }

  getPid(): number | undefined {
    return this.pty?.pid;
  }

  addReadyPattern(pattern: RegExp): void {
    this.readyPatterns.push(pattern);
  }

  addErrorPattern(pattern: RegExp): void {
    this.errorPatterns.push(pattern);
  }

  addCompletionPattern(pattern: RegExp): void {
    this.completionPatterns.push(pattern);
  }
}