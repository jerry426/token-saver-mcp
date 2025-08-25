import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

export interface SafeTerminalConfig {
  maxOutputBuffer?: number;      // Maximum bytes to buffer
  maxLineLength?: number;         // Maximum characters per line
  stripAnsiCodes?: boolean;       // Remove ANSI escape sequences
  escapeControlChars?: boolean;   // Escape non-printable characters
  rateLimit?: number;            // Max events per second
}

export class SafeTerminalHandler extends EventEmitter {
  private config: SafeTerminalConfig;
  private outputBuffer: string[] = [];
  private logger: Logger;
  private lastEventTime: number = 0;
  private eventCount: number = 0;

  // Regex patterns for dangerous sequences
  private readonly ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
  private readonly CONTROL_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  private readonly CURSOR_CONTROL = /\x1b\[([0-9]+;)?([0-9]+)?[HfABCDEFGJKSTsu]/g;
  private readonly CLEAR_SCREEN = /\x1b\[(2J|[0-9]*K)/g;
  
  constructor(config?: SafeTerminalConfig) {
    super();
    this.config = {
      maxOutputBuffer: 100000,    // 100KB default
      maxLineLength: 500,          // 500 chars per line
      stripAnsiCodes: false,       // Keep colors by default
      escapeControlChars: true,    // Escape dangerous chars
      rateLimit: 100,             // 100 events/sec max
      ...config
    };
    this.logger = new Logger('SafeTerminalHandler');
  }

  /**
   * Safely process terminal output
   */
  processOutput(data: string, source: string): string {
    // Rate limiting
    if (!this.checkRateLimit()) {
      this.logger.warn(`Rate limit exceeded for ${source}`);
      return '[Rate limited]';
    }

    // Size check
    if (data.length > this.config.maxOutputBuffer!) {
      this.logger.warn(`Output too large from ${source}: ${data.length} bytes`);
      data = data.substring(0, this.config.maxOutputBuffer!) + '\n[Truncated]';
    }

    // Clean the data
    let cleaned = data;
    
    // Remove dangerous control sequences
    cleaned = this.removeDangerousSequences(cleaned);
    
    // Optionally strip all ANSI codes
    if (this.config.stripAnsiCodes) {
      cleaned = this.stripAnsi(cleaned);
    }
    
    // Escape control characters
    if (this.config.escapeControlChars) {
      cleaned = this.escapeControl(cleaned);
    }
    
    // Limit line length
    cleaned = this.limitLineLength(cleaned);
    
    // Buffer management
    this.addToBuffer(cleaned);
    
    return cleaned;
  }

  /**
   * Remove sequences that could cause terminal hijacking
   */
  private removeDangerousSequences(text: string): string {
    // Remove cursor positioning commands
    text = text.replace(this.CURSOR_CONTROL, '');
    
    // Remove clear screen commands
    text = text.replace(this.CLEAR_SCREEN, '');
    
    // Remove terminal mode switches
    text = text.replace(/\x1b\[[\?]?[0-9;]*[hlmr]/g, '');
    
    // Remove alternate screen buffer switches
    text = text.replace(/\x1b\[\?1049[hl]/g, '');
    
    return text;
  }

  /**
   * Strip all ANSI escape sequences
   */
  private stripAnsi(text: string): string {
    return text.replace(this.ANSI_REGEX, '');
  }

  /**
   * Escape control characters to prevent terminal hijacking
   */
  private escapeControl(text: string): string {
    return text.replace(this.CONTROL_REGEX, (char) => {
      const code = char.charCodeAt(0);
      // Keep newlines and tabs
      if (code === 0x0A || code === 0x0D || code === 0x09) {
        return char;
      }
      // Escape others
      return `\\x${code.toString(16).padStart(2, '0')}`;
    });
  }

  /**
   * Limit line length to prevent UI overflow
   */
  private limitLineLength(text: string): string {
    const lines = text.split('\n');
    return lines.map(line => {
      if (line.length > this.config.maxLineLength!) {
        return line.substring(0, this.config.maxLineLength!) + '...';
      }
      return line;
    }).join('\n');
  }

  /**
   * Add to buffer with size management
   */
  private addToBuffer(text: string): void {
    this.outputBuffer.push(text);
    
    // Limit buffer size
    let totalSize = this.outputBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    while (totalSize > this.config.maxOutputBuffer! && this.outputBuffer.length > 0) {
      const removed = this.outputBuffer.shift();
      if (removed) {
        totalSize -= removed.length;
      }
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastEventTime;
    
    if (elapsed > 1000) {
      // Reset counter every second
      this.eventCount = 0;
      this.lastEventTime = now;
    }
    
    this.eventCount++;
    return this.eventCount <= this.config.rateLimit!;
  }

  /**
   * Get safe copy of buffer for clipboard
   */
  getSafeCopyText(): string {
    const combined = this.outputBuffer.join('');
    
    // Strip all ANSI codes for clipboard
    let safe = this.stripAnsi(combined);
    
    // Escape any remaining control chars
    safe = this.escapeControl(safe);
    
    // Limit total size for clipboard
    if (safe.length > 50000) {
      safe = safe.substring(0, 50000) + '\n\n[Output truncated for safety]';
    }
    
    return safe;
  }

  /**
   * Get formatted output for display
   */
  getDisplayText(stripColors: boolean = false): string {
    const combined = this.outputBuffer.join('');
    
    if (stripColors) {
      return this.stripAnsi(combined);
    }
    
    // Keep colors but remove dangerous sequences
    return this.removeDangerousSequences(combined);
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.outputBuffer = [];
    this.eventCount = 0;
  }

  /**
   * Detect if output contains interactive CLI patterns
   */
  detectInteractiveCLI(output: string): boolean {
    const patterns = [
      /\x1b\[\?1049h/,        // Alternate screen buffer (vim, less, etc)
      /\x1b\[2J/,             // Clear screen
      /\x1b\[\d+;\d+H/,       // Cursor positioning
      /^Username:/m,          // Login prompts
      /^Password:/m,
      /Continue\? \(y\/n\)/,  // Interactive prompts
      /Press any key/i,
      /\(END\)/,              // Less pager
      /^:/m,                  // Vim command mode
    ];
    
    return patterns.some(pattern => pattern.test(output));
  }

  /**
   * Check if a command might spawn an interactive CLI
   */
  isInteractiveCommand(command: string): boolean {
    const interactiveCommands = [
      'vim', 'vi', 'emacs', 'nano',     // Editors
      'less', 'more',                    // Pagers
      'top', 'htop', 'btop',            // System monitors
      'ssh', 'telnet', 'ftp',           // Network tools
      'python', 'python3', 'node',       // REPLs (without -c flag)
      'irb', 'pry',                      // Ruby REPLs
      'mysql', 'psql', 'mongo',         // Database CLIs
      'docker', 'kubectl',               // With certain subcommands
      'claude', 'chatgpt', 'gemini'     // AI CLIs
    ];
    
    const cmdLower = command.toLowerCase();
    return interactiveCommands.some(cmd => 
      cmdLower.startsWith(cmd + ' ') || cmdLower === cmd
    );
  }
}

/**
 * Special handler for AI CLI tools
 */
export class AICLIHandler extends SafeTerminalHandler {
  private promptBuffer: string = '';
  private responseBuffer: string = '';
  private state: 'waiting' | 'prompting' | 'responding' = 'waiting';
  
  constructor() {
    super({
      maxOutputBuffer: 500000,  // Larger buffer for AI responses
      stripAnsiCodes: false,    // Keep formatting
      escapeControlChars: true,
      rateLimit: 200           // Higher rate for streaming
    });
  }

  /**
   * Process AI CLI specific output
   */
  processAIOutput(data: string, cliType: string): any {
    const cleaned = this.processOutput(data, cliType);
    
    // Detect state transitions
    if (this.detectPromptReady(cleaned)) {
      this.state = 'prompting';
      this.emit('prompt-ready', { cli: cliType });
    } else if (this.detectResponseStart(cleaned)) {
      this.state = 'responding';
      this.responseBuffer = '';
      this.emit('response-start', { cli: cliType });
    } else if (this.detectResponseEnd(cleaned)) {
      this.emit('response-complete', { 
        cli: cliType, 
        response: this.responseBuffer 
      });
      this.state = 'waiting';
    }
    
    // Accumulate response
    if (this.state === 'responding') {
      this.responseBuffer += cleaned;
    }
    
    return {
      cleaned,
      state: this.state,
      isInteractive: true
    };
  }

  private detectPromptReady(output: string): boolean {
    const patterns = [
      /^> $/m,                    // Claude prompt
      /^You: $/m,                 // ChatGPT style
      /^Human: $/m,               // Anthropic style
      /^>>> $/m,                  // Python-like
      /\nEnter your prompt:/i
    ];
    
    return patterns.some(p => p.test(output));
  }

  private detectResponseStart(output: string): boolean {
    const patterns = [
      /^Assistant:/m,
      /^Claude:/m,
      /^AI:/m,
      /^Response:/m,
      /^Output:/m
    ];
    
    return patterns.some(p => p.test(output));
  }

  private detectResponseEnd(output: string): boolean {
    const patterns = [
      /\n> $/,                    // New prompt appeared
      /^Human: $/m,               // Ready for next input
      /\[END\]/,
      /^---$/m
    ];
    
    return patterns.some(p => p.test(output));
  }

  /**
   * Safely inject prompt to AI CLI
   */
  async injectSafePrompt(prompt: string): Promise<string> {
    // Escape any control characters in the prompt
    let safePrompt = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Limit prompt length
    if (safePrompt.length > 10000) {
      safePrompt = safePrompt.substring(0, 10000) + '... [truncated]';
    }
    
    return safePrompt;
  }
}