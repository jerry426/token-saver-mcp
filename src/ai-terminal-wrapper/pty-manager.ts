import * as pty from 'node-pty'
import { EventEmitter } from 'events'

export type PTYState = 'initializing' | 'ready' | 'processing' | 'waiting' | 'error' | 'terminated'

export interface PTYConfig {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export interface PTYMetrics {
  startTime: number
  endTime?: number
  bytesWritten: number
  bytesRead: number
  commands: number
  errors: number
  lastActivity: number
}

export interface PTYEvents {
  'state-change': (state: PTYState, prev: PTYState) => void
  'output': (data: string) => void
  'error': (err: Error) => void
  'terminated': (code: number, signal?: number) => void
  'prompt': (prompt: string) => void
}

export class PTYManager extends EventEmitter {
  private proc: pty.IPty | null = null
  private state: PTYState = 'initializing'
  private buffer = ''  // Keep minimal buffer for state detection only
  private metrics: PTYMetrics
  private readonly maxBuffer = 10_000  // Reduced from 1MB to 10KB - just enough for recent output

  constructor(private readonly config: PTYConfig) {
    super()
    this.metrics = {
      startTime: Date.now(),
      bytesWritten: 0,
      bytesRead: 0,
      commands: 0,
      errors: 0,
      lastActivity: Date.now(),
    }
  }

  async spawn(): Promise<void> {
    try {
      this.proc = pty.spawn(this.config.command, this.config.args ?? [], {
        name: 'xterm-256color',
        cols: this.config.cols ?? 80,  // More standard default
        rows: this.config.rows ?? 24,  // More standard default
        cwd: this.config.cwd ?? process.cwd(),
        env: { ...process.env, ...(this.config.env ?? {}) },
      })

      this.proc.onData((d) => this.onData(d))
      this.proc.onExit(({ exitCode, signal }) => {
        this.metrics.endTime = Date.now()
        this.setState('terminated')
        this.emit('terminated', exitCode, signal)
        this.cleanup()
      })
    } catch (e) {
      this.metrics.errors++
      this.setState('error')
      this.emit('error', e as Error)
      throw e
    }
  }

  private onData(data: string) {
    this.metrics.bytesRead += Buffer.byteLength(data)
    this.metrics.lastActivity = Date.now()

    // Optional: Keep only last bit for getRecentOutput() 
    // Could remove buffering entirely if not needed
    this.buffer = (this.buffer + data).slice(-this.maxBuffer)

    this.emit('output', data)
  }

  private setState(next: PTYState) {
    if (this.state === next) return
    const prev = this.state
    this.state = next
    this.emit('state-change', next, prev)
    if (next === 'ready') this.emit('prompt', '>')
  }

  async write(text: string): Promise<void> {
    if (!this.proc) throw new Error('PTY not initialized')
    if (this.state === 'terminated') throw new Error('PTY terminated')
    this.proc.write(text)
    this.metrics.bytesWritten += Buffer.byteLength(text)
    this.metrics.lastActivity = Date.now()
    if (text.includes('\n') || text.includes('\r')) {
      this.metrics.commands++
      this.setState('processing')
    }
  }

  async writeCommand(cmd: string): Promise<void> {
    await this.write(cmd.endsWith('\n') ? cmd : cmd + '\n')
  }

  resize(cols: number, rows: number) {
    if (!this.proc) {
      console.error('PTY resize called but process is null')
      return
    }
    console.log(`PTY resizing to ${cols}x${rows}`)
    this.proc.resize(cols, rows)
  }

  kill(signal?: string) {
    if (!this.proc) return
    this.proc.kill(signal)
    this.cleanup()
  }

  private cleanup() {
    this.proc = null
    this.removeAllListeners('output')
  }

  getState(): PTYState { return this.state }
  getMetrics(): PTYMetrics { return { ...this.metrics } }
  getRecentOutput(lines = 100): string {
    const arr = this.buffer.split('\n')
    return arr.slice(-lines).join('\n')
  }
  getPid(): number | undefined { return this.proc?.pid }
}

