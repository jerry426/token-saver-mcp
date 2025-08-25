import { EventEmitter } from 'events'
import { PTYManager } from './pty-manager'

export interface InjectionOptions {
  humanLike?: boolean
  typingSpeed?: number // chars per minute
  waitForReady?: boolean
  timeout?: number
  confirmWithEnter?: boolean
  raw?: boolean  // Send raw input without processing
}

export interface InjectionResult {
  success: boolean
  injectedText: string
  duration: number
  error?: Error
}

interface QueueItem {
  id: string
  agent: string
  text: string
  options: Required<InjectionOptions>
  retries: number
}

export class InputInjector extends EventEmitter {
  private agents = new Map<string, PTYManager>()
  private queue: QueueItem[] = []
  private processing = false

  constructor() {
    super()
    this.setMaxListeners(50) // Increase max listeners to prevent warning
  }

  registerAgent(name: string, pty: PTYManager) { this.agents.set(name, pty) }
  unregisterAgent(name: string) { this.agents.delete(name) }

  async inject(agent: string, text: string, options: InjectionOptions = {}): Promise<InjectionResult> {
    const item: QueueItem = {
      id: `inj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agent,
      text,
      options: {
        humanLike: options.humanLike ?? false,
        typingSpeed: options.typingSpeed ?? 300,
        waitForReady: options.waitForReady ?? true,
        timeout: options.timeout ?? 30_000,
        confirmWithEnter: options.confirmWithEnter ?? true,
        raw: options.raw ?? false,
      },
      retries: 0,
    }

    return new Promise((resolve, reject) => {
      const start = Date.now()
      this.queue.push(item)
      this.process().catch(() => {})

      const onDone = (res: InjectionResult) => resolve(res)
      const onFail = (err: Error) => reject(err)

      const doneHandler = (payload: any) => {
        if (payload.id !== item.id) return
        this.off('inject-failed', failHandler)
        onDone({ success: true, injectedText: text, duration: Date.now() - start })
      }
      const failHandler = (payload: any) => {
        if (payload.id !== item.id) return
        this.off('injected', doneHandler)
        onFail(payload.error)
      }
      this.on('injected', doneHandler)
      this.on('inject-failed', failHandler)
    })
  }

  private async process() {
    if (this.processing) return
    this.processing = true
    try {
      while (this.queue.length) {
        const item = this.queue.shift()!
        const pty = this.agents.get(item.agent)
        if (!pty) {
          this.emit('inject-failed', { id: item.id, error: new Error(`Agent not found: ${item.agent}`) })
          continue
        }
        try {
          if (item.options.raw) {
            // Send raw input without any processing
            await pty.write(item.text)
          } else if (item.options.humanLike) {
            await this.humanType(pty, item.text, item.options.typingSpeed)
          } else {
            await pty.write(item.text)
          }
          
          if (item.options.confirmWithEnter && !item.options.raw && !item.text.endsWith('\n')) {
            await pty.write('\n')
          }
          this.emit('injected', { id: item.id })
        } catch (e) {
          if (item.retries < 3) {
            item.retries++
            const backoff = Math.min(2000 * item.retries, 5000) + Math.floor(Math.random() * 250)
            await new Promise(r => setTimeout(r, backoff))
            this.queue.unshift(item)
          } else {
            this.emit('inject-failed', { id: item.id, error: e })
          }
        }
      }
    } finally {
      this.processing = false
    }
  }

  private async humanType(pty: PTYManager, text: string, cpm: number) {
    const base = 60_000 / Math.max(1, cpm)
    for (let i = 0; i < text.length; i++) {
      await pty.write(text[i])
      if (i < text.length - 1) {
        const v = 0.3
        const delay = base * (1 - v + Math.random() * 2 * v)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
}

