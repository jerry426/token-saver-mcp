import { EventEmitter } from 'events'

export interface AIPattern {
  name: string
  patterns: RegExp[]
  bufferSize?: number  // How much output to keep for this AI type
}

export interface ReadinessResult {
  ready: boolean
  aiType: string
  match?: string
  confidence: number
  timestamp: number
}

/**
 * Detects when AI CLIs are ready for input by watching for specific prompt patterns
 * Uses a FIFO buffer to efficiently track recent output without memory bloat
 */
export class AIReadinessDetector extends EventEmitter {
  private buffer = ''
  private maxBufferSize: number
  private lastReadyState = false
  private aiType: string
  private patterns: Map<string, AIPattern> = new Map()
  private detectTimeout: NodeJS.Timeout | null = null
  
  constructor(aiType: string = 'unknown', maxBufferSize = 1000) {
    super()
    this.aiType = aiType
    this.maxBufferSize = maxBufferSize
    this.initializePatterns()
  }
  
  private initializePatterns() {
    // Claude CLI patterns
    this.patterns.set('claude', {
      name: 'Claude CLI',
      patterns: [
        />[\s]*$/m,  // Simple > prompt
        /Assistant:[\s]*$/m,  // After Claude responds
        /Human:[\s]*$/m,  // Waiting for human input
        /claude>[\s]*$/m,  // Some versions use claude> prompt
        /\n>[\s]*$/,  // New line followed by prompt
      ],
      bufferSize: 500  // Claude has simple prompts
    })
    
    // ChatGPT CLI patterns
    this.patterns.set('chatgpt', {
      name: 'ChatGPT CLI',
      patterns: [
        /You:[\s]*$/m,  // Common ChatGPT prompt
        /User:[\s]*$/m,  // Alternative prompt
        /chatgpt>[\s]*$/m,  // Some versions
        />>>[\s]*$/m,  // Python-style prompt some CLIs use
        /\?[\s]*$/m,  // Question prompt
      ],
      bufferSize: 500
    })
    
    // Gemini CLI patterns  
    this.patterns.set('gemini', {
      name: 'Gemini CLI',
      patterns: [
        />[\s]+Type your message or @path\/to\/file[\s]*$/m,  // Actual Gemini prompt
        />[\s]+Type your message[\s]*$/m,  // Variation without file option
        /gemini>[\s]*$/m,
        /Gemini:[\s]*$/m,
        />[\s]*$/m,  // Fallback to simple prompt
        /Input:[\s]*$/m,
        /\$[\s]*$/m,  // Some versions use shell-like prompt
      ],
      bufferSize: 800  // Increased slightly for the longer prompt
    })
    
    // OpenAI CLI patterns
    this.patterns.set('openai', {
      name: 'OpenAI CLI',
      patterns: [
        /openai>[\s]*$/m,
        /gpt>[\s]*$/m,
        />[\s]*$/m,
        /Input:[\s]*$/m,
        /Query:[\s]*$/m,
      ],
      bufferSize: 500
    })
    
    // Generic/Custom AI patterns
    this.patterns.set('custom', {
      name: 'Custom AI',
      patterns: [
        />[\s]+Type your message or @path\/to\/file[\s]*$/m,  // Gemini pattern
        />[\s]+Type your message[\s]*$/m,  // Gemini variation
        />[\s]*$/m,  // Most CLIs use >
        /\$[\s]*$/m,  // Shell-like
        /#[\s]*$/m,  // Root-like
        /:[\s]*$/m,  // Colon prompt
        /Input:[\s]*$/m,
        /Ready[\s]*$/mi,
        /\[READY\]/i,
      ],
      bufferSize: 1000  // Larger buffer for unknown patterns
    })
    
    // Shell patterns (for testing and fallback)
    this.patterns.set('shell', {
      name: 'Shell',
      patterns: [
        /\$[\s]*$/m,  // Bash/sh prompt
        /%[\s]*$/m,   // zsh prompt
        /#[\s]*$/m,   // Root prompt
        />[\s]*$/m,   // Generic prompt
      ],
      bufferSize: 200
    })
  }
  
  /**
   * Process new output from the AI terminal
   * Maintains a FIFO buffer and checks for readiness patterns
   */
  process(output: string) {
    // Add to buffer and maintain FIFO size
    this.buffer += output
    
    // Get the appropriate buffer size for this AI type
    const pattern = this.patterns.get(this.aiType) || this.patterns.get('custom')!
    const bufferSize = pattern.bufferSize || this.maxBufferSize
    
    // Keep only the most recent output (FIFO)
    if (this.buffer.length > bufferSize) {
      this.buffer = this.buffer.slice(-bufferSize)
    }
    
    // Debounce the detection to avoid rapid state changes
    if (this.detectTimeout) {
      clearTimeout(this.detectTimeout)
    }
    
    this.detectTimeout = setTimeout(() => {
      this.detectReadiness()
    }, 100)  // Wait 100ms for output to settle
  }
  
  /**
   * Check if the AI is ready for input based on current buffer
   */
  private detectReadiness() {
    const pattern = this.patterns.get(this.aiType) || this.patterns.get('custom')!
    
    // Check each pattern for this AI type
    for (const regex of pattern.patterns) {
      if (regex.test(this.buffer)) {
        const match = this.buffer.match(regex)?.[0] || ''
        
        // Only emit if state changed to ready
        if (!this.lastReadyState) {
          this.lastReadyState = true
          const result: ReadinessResult = {
            ready: true,
            aiType: this.aiType,
            match: match.trim(),
            confidence: this.aiType === 'custom' ? 0.7 : 0.9,
            timestamp: Date.now()
          }
          
          this.emit('ready', result)
        }
        return
      }
    }
    
    // Not ready - AI is probably still processing
    if (this.lastReadyState) {
      this.lastReadyState = false
      const result: ReadinessResult = {
        ready: false,
        aiType: this.aiType,
        confidence: 0.9,
        timestamp: Date.now()
      }
      
      this.emit('not-ready', result)
    }
  }
  
  /**
   * Set the AI type to use appropriate patterns
   */
  setAIType(aiType: string) {
    this.aiType = aiType
    this.buffer = ''  // Clear buffer when switching AI types
    this.lastReadyState = false
    
    // Adjust buffer size based on AI type
    const pattern = this.patterns.get(aiType)
    if (pattern?.bufferSize) {
      this.maxBufferSize = pattern.bufferSize
    }
  }
  
  /**
   * Add custom patterns for a specific AI
   */
  addCustomPattern(aiType: string, patterns: RegExp[], bufferSize?: number) {
    this.patterns.set(aiType, {
      name: `Custom ${aiType}`,
      patterns,
      bufferSize: bufferSize || 1000
    })
  }
  
  /**
   * Get current readiness state
   */
  isReady(): boolean {
    return this.lastReadyState
  }
  
  /**
   * Clear the buffer (useful after injection)
   */
  clearBuffer() {
    this.buffer = ''
  }
  
  /**
   * Get the current buffer (for debugging)
   */
  getBuffer(): string {
    return this.buffer
  }
  
  /**
   * Get buffer size info
   */
  getBufferInfo() {
    return {
      currentSize: this.buffer.length,
      maxSize: this.maxBufferSize,
      aiType: this.aiType,
      ready: this.lastReadyState
    }
  }
}