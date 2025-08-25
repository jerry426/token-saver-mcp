import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

export interface StatePattern {
  name: string;
  patterns: RegExp[];
  confidence: number; // 0-1 confidence score
  priority: number;   // Higher priority patterns are checked first
}

export interface DetectionResult {
  state: string;
  confidence: number;
  pattern: string;
  match: string;
  timestamp: number;
}

export interface StateDetectorConfig {
  defaultState?: string;
  historySize?: number;
  debounceMs?: number;
}

export class StateDetector extends EventEmitter {
  private patterns: Map<string, StatePattern> = new Map();
  private currentState: string;
  private stateHistory: DetectionResult[] = [];
  private historySize: number;
  private debounceMs: number;
  private debounceTimer: NodeJS.Timeout | null = null;
  private logger: Logger;
  private outputBuffer: string = '';
  private bufferMaxSize = 50000; // Keep last 50KB for pattern matching

  constructor(config: StateDetectorConfig = {}) {
    super();
    this.currentState = config.defaultState || 'unknown';
    this.historySize = config.historySize || 100;
    this.debounceMs = config.debounceMs || 100;
    this.logger = new Logger('StateDetector');
    
    this.initializeDefaultPatterns();
  }

  private initializeDefaultPatterns(): void {
    // Ready state patterns - highest priority
    this.addStatePattern({
      name: 'ready',
      patterns: [
        /^[>❯$#]\s*$/m,                      // Common prompt characters
        /^(gemini|claude|gpt|llama)>\s*$/im, // Named AI prompts  
        /^assistant>\s*$/im,                 // Generic assistant prompt
        /\n>>> $/,                           // Python-style prompt
        /\nAI\s*:\s*$/,                      // Conversational prompt
        /Ready for input/i,                  // Explicit ready message
        /Enter your (prompt|question|command):/i, // Input request
        /^\w+@[\w-]+.*[$#]\s*$/m,           // Unix prompt with hostname
        /^In \[\d+\]:\s*$/m,                // IPython/Jupyter prompt
        /^(❯|→|▶)\s*$/m                      // Modern shell prompts
      ],
      confidence: 0.9,
      priority: 100
    });

    // Processing state patterns
    this.addStatePattern({
      name: 'processing',
      patterns: [
        /^Thinking\.{2,}$/im,
        /^Analyzing/im,
        /^Generating response/im,
        /^Processing/im,
        /^Working on/im,
        /^Loading/im,
        /^Please wait/im,
        /\[.*%\]/,                           // Progress indicators
        /^\.{3,}$/m,                         // Ellipsis animation
        /^(⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏)/        // Spinner characters
      ],
      confidence: 0.8,
      priority: 80
    });

    // Complete state patterns
    this.addStatePattern({
      name: 'complete',
      patterns: [
        /^Task completed?\.?$/im,
        /^---+\s*(END|DONE|COMPLETE)\s*---+$/im,
        /\[(END OF RESPONSE|RESPONSE COMPLETE)\]/i,
        /^(Done|Finished|Complete)\.?$/im,
        /^Response complete\.?$/im,
        /^Successfully (completed|finished)/im,
        /^✓ Complete$/im,
        /^✅ Done$/im
      ],
      confidence: 0.85,
      priority: 90
    });

    // Error state patterns
    this.addStatePattern({
      name: 'error',
      patterns: [
        /^(Error|ERROR):/im,
        /^Failed to/im,
        /^Exception:/im,
        /^Traceback \(most recent call last\):/im,
        /Rate limit exceeded/i,
        /Authentication failed/i,
        /Connection refused/i,
        /Timeout/i,
        /Invalid (request|input|command)/i,
        /API error/i,
        /^❌ Error/im,
        /^⚠️ Warning/im,
        /Fatal error/i,
        /Unhandled exception/i,
        /Segmentation fault/i,
        /Command not found/i
      ],
      confidence: 0.95,
      priority: 110  // Highest priority - errors should be detected immediately
    });

    // Waiting state patterns
    this.addStatePattern({
      name: 'waiting',
      patterns: [
        /Waiting for/i,
        /Press any key to continue/i,
        /Continue\? \(y\/n\)/i,
        /Are you sure\?/i,
        /\[Y\/n\]/,
        /Confirm:/i,
        /Please confirm/i,
        /Proceed\?/i
      ],
      confidence: 0.7,
      priority: 70
    });

    // Streaming state patterns
    this.addStatePattern({
      name: 'streaming',
      patterns: [
        /^data:\s*{/m,                      // Server-sent events
        /^event:\s*\w+/m,                   // SSE event names
        /^\[STREAM\]/i,
        /Streaming response/i
      ],
      confidence: 0.75,
      priority: 60
    });
  }

  addStatePattern(pattern: StatePattern): void {
    this.patterns.set(pattern.name, pattern);
    this.logger.debug(`Added state pattern: ${pattern.name} with ${pattern.patterns.length} patterns`);
  }

  removeStatePattern(name: string): void {
    this.patterns.delete(name);
  }

  analyzeOutput(output: string): DetectionResult | null {
    // Update buffer with new output
    this.outputBuffer += output;
    if (this.outputBuffer.length > this.bufferMaxSize) {
      this.outputBuffer = this.outputBuffer.slice(-this.bufferMaxSize / 2);
    }

    // Sort patterns by priority (descending)
    const sortedPatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.priority - a.priority);

    // Check each pattern group
    for (const statePattern of sortedPatterns) {
      for (const pattern of statePattern.patterns) {
        // Check both recent output and buffer for better detection
        const matchInOutput = pattern.test(output);
        const matchInBuffer = pattern.test(this.outputBuffer.slice(-1000));
        
        if (matchInOutput || matchInBuffer) {
          const match = output.match(pattern) || this.outputBuffer.match(pattern);
          const result: DetectionResult = {
            state: statePattern.name,
            confidence: statePattern.confidence,
            pattern: pattern.toString(),
            match: match ? match[0] : '',
            timestamp: Date.now()
          };
          
          this.logger.debug(`Detected state: ${result.state} with confidence ${result.confidence}`);
          return result;
        }
      }
    }

    return null;
  }

  processOutput(output: string): void {
    const detection = this.analyzeOutput(output);
    
    if (detection) {
      // Add to history
      this.stateHistory.push(detection);
      if (this.stateHistory.length > this.historySize) {
        this.stateHistory.shift();
      }

      // Debounce state changes to avoid rapid switching
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.updateState(detection);
      }, this.debounceMs);
    }
  }

  private updateState(detection: DetectionResult): void {
    const previousState = this.currentState;
    
    // Only update if confidence is high enough or state is different with medium confidence
    const shouldUpdate = detection.confidence >= 0.8 || 
      (detection.state !== previousState && detection.confidence >= 0.6);
    
    if (shouldUpdate && detection.state !== previousState) {
      this.currentState = detection.state;
      this.logger.info(`State changed: ${previousState} -> ${detection.state}`);
      
      this.emit('state-changed', {
        previous: previousState,
        current: detection.state,
        confidence: detection.confidence,
        timestamp: detection.timestamp
      });
    }
  }

  getCurrentState(): string {
    return this.currentState;
  }

  getStateHistory(): DetectionResult[] {
    return [...this.stateHistory];
  }

  getRecentStates(count: number = 10): DetectionResult[] {
    return this.stateHistory.slice(-count);
  }

  getStateConfidence(): number {
    const recent = this.stateHistory.slice(-5);
    if (recent.length === 0) return 0;
    
    // Calculate average confidence of recent detections
    const avgConfidence = recent.reduce((sum, r) => sum + r.confidence, 0) / recent.length;
    
    // Boost confidence if recent states are consistent
    const consistentStates = recent.filter(r => r.state === this.currentState).length;
    const consistencyBonus = (consistentStates / recent.length) * 0.2;
    
    return Math.min(1, avgConfidence + consistencyBonus);
  }

  reset(): void {
    this.currentState = 'unknown';
    this.stateHistory = [];
    this.outputBuffer = '';
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // Advanced pattern learning (for future ML integration)
  learnPattern(output: string, actualState: string): void {
    this.logger.debug(`Learning pattern for state: ${actualState}`);
    // This could be extended to use ML for pattern recognition
    // For now, just log for analysis
    this.emit('pattern-learned', {
      output: output.substring(0, 100),
      state: actualState,
      timestamp: Date.now()
    });
  }

  // Get statistics about state detection
  getStatistics(): Record<string, any> {
    const stats: Record<string, number> = {};
    
    // Count state occurrences
    for (const detection of this.stateHistory) {
      stats[detection.state] = (stats[detection.state] || 0) + 1;
    }
    
    // Calculate state durations
    const durations: Record<string, number[]> = {};
    let lastState: string | null = null;
    let lastTime = 0;
    
    for (const detection of this.stateHistory) {
      if (lastState && lastState !== detection.state) {
        const duration = detection.timestamp - lastTime;
        if (!durations[lastState]) durations[lastState] = [];
        durations[lastState].push(duration);
      }
      lastState = detection.state;
      lastTime = detection.timestamp;
    }
    
    // Calculate average durations
    const avgDurations: Record<string, number> = {};
    for (const [state, times] of Object.entries(durations)) {
      if (times.length > 0) {
        avgDurations[state] = times.reduce((a, b) => a + b, 0) / times.length;
      }
    }
    
    return {
      currentState: this.currentState,
      confidence: this.getStateConfidence(),
      stateCounts: stats,
      averageDurations: avgDurations,
      historySize: this.stateHistory.length,
      patternsConfigured: this.patterns.size
    };
  }
}