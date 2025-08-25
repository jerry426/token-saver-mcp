import { EventEmitter } from 'events'

export interface StreamHandlerOptions {
  throttleMs?: number
}

export class StreamHandler extends EventEmitter {
  private queue: string[] = []
  private timer: NodeJS.Timeout | null = null
  private readonly throttle: number

  constructor(opts: StreamHandlerOptions = {}) {
    super()
    this.throttle = opts.throttleMs ?? 50
  }

  push(data: string) {
    this.queue.push(data)
    if (!this.timer) this.schedule()
  }

  private schedule() {
    this.timer = setTimeout(() => {
      const chunk = this.queue.join('')
      this.queue = []
      this.timer = null
      this.emit('batch', chunk)
      if (this.queue.length) this.schedule()
    }, this.throttle)
  }
}

