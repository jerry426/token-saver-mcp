import { EventEmitter } from 'events'

export interface StatePattern {
  name: string
  patterns: RegExp[]
  confidence: number
  priority: number
}

export interface DetectionResult {
  state: string
  confidence: number
  pattern: string
  match: string
  timestamp: number
}

export interface StateDetectorConfig {
  defaultState?: string
  historySize?: number
  debounceMs?: number
}

export class StateDetector extends EventEmitter {
  private patterns = new Map<string, StatePattern>()
  private current: string
  private history: DetectionResult[] = []
  private debounceTimer: NodeJS.Timeout | null = null
  private readonly historySize: number
  private readonly debounceMs: number
  private buffer = ''
  private readonly maxBuf = 5_000  // Reduced from 50KB to 5KB - only need recent output for pattern matching

  constructor(cfg: StateDetectorConfig = {}) {
    super()
    this.current = cfg.defaultState ?? 'unknown'
    this.historySize = cfg.historySize ?? 100
    this.debounceMs = cfg.debounceMs ?? 100
    this.addDefaults()
  }

  private addDefaults() {
    this.addPattern({ name: 'ready', confidence: 0.9, priority: 100, patterns: [
      /^[>❯$#%]\s*$/m,  // Added % for zsh
      /^(gemini|claude|gpt|llama|chatgpt|openai)>\s*$/im,
      /^assistant>\s*$/im,
      /\n>>> $/,
      /\nAI\s*:\s*$/,
      /Enter your (prompt|question|command):/i,
      /^\w+@[\w-].*[$#%]\s*$/m,  // Added % for zsh
      /^➜.*$/m,  // Common zsh prompt with arrow
      /^[\w-]+\s+%\s*$/m,  // Simple zsh prompt like "jerry %"
      /^\[.*\]\s*[$#%]\s*$/m,  // Bracketed prompts
    ]})

    this.addPattern({ name: 'processing', confidence: 0.8, priority: 80, patterns: [
      /^Thinking\.{2,}$/im,
      /^Analyzing/im,
      /^Generating/im,
      /^Processing/im,
      /^Please wait/im,
      /\[.*%\]/,
    ]})

    this.addPattern({ name: 'complete', confidence: 0.85, priority: 90, patterns: [
      /^Task completed?\.?$/im,
      /\[(END OF RESPONSE|RESPONSE COMPLETE)\]/i,
      /^(Done|Finished|Complete)\.?$/im,
    ]})

    this.addPattern({ name: 'error', confidence: 0.95, priority: 110, patterns: [
      /^(Error|ERROR):\s+/im,  // Must have colon and space after Error
      /^Failed to\s+\w+/im,     // Must have something after "Failed to"
      /^Exception:\s+/im,       // Must have colon and space
      /Connection refused/i,
      /command not found/i,     // Common shell error
      /Permission denied/i,     // Common shell error
      /No such file or directory/i,  // Common shell error
    ]})
  }

  addPattern(p: StatePattern) { this.patterns.set(p.name, p) }
  removePattern(name: string) { this.patterns.delete(name) }

  process(output: string) {
    // Keep only recent output for pattern matching
    this.buffer = (this.buffer + output).slice(-this.maxBuf)

    const det = this.analyze(output)
    if (!det) return

    this.history.push(det)
    if (this.history.length > this.historySize) this.history.shift()

    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.commit(det), this.debounceMs)
  }

  private analyze(chunk: string): DetectionResult | null {
    const sorted = [...this.patterns.values()].sort((a, b) => b.priority - a.priority)
    for (const g of sorted) {
      for (const re of g.patterns) {
        if (re.test(chunk) || re.test(this.buffer.slice(-1000))) {
          const m = (chunk.match(re) || this.buffer.match(re))?.[0] ?? ''
          return { state: g.name, confidence: g.confidence, pattern: re.toString(), match: m, timestamp: Date.now() }
        }
      }
    }
    return null
  }

  private commit(det: DetectionResult) {
    if (det.state === this.current) return
    this.current = det.state
    this.emit('state-changed', { current: det.state, confidence: det.confidence, timestamp: det.timestamp })
  }

  getCurrent() { return this.current }
  getHistory() { return [...this.history] }
  
  setState(state: string) {
    this.current = state
    this.emit('state-changed', { current: state, confidence: 1.0, timestamp: Date.now() })
  }
}

