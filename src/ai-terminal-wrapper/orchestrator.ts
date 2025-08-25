import { EventEmitter } from 'events'
import { PTYManager, PTYConfig, PTYState } from './pty-manager'
import { StateDetector } from './state-detector'
import { InputInjector } from './input-injector'
import { AIReadinessDetector } from './ai-readiness-detector'
// SafeTerminal not needed - xterm.js handles all terminal sequences

export interface AgentConfig {
  id: string
  name: string
  type: 'claude' | 'gemini' | 'gpt4' | 'chatgpt' | 'openai' | 'custom'
  command: string
  args?: string[]
  env?: Record<string, string>
  tags?: string[]
}

export interface AgentInfo {
  id: string
  name: string
  type: string
  state: PTYState | string
  ready: boolean  // AI readiness state
  metrics: Record<string, any>
  lastPrompt?: string
  lastResponse?: string
}

export interface WorkflowStep {
  id: string
  name: string
  agent?: string
  prompt: string
  requirements?: string[]
  timeout?: number
  dependsOn?: string[]
  outputKey?: string
  retryOnError?: boolean
  maxRetries?: number
}

export interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
  context?: Map<string, any>
}

export class Orchestrator extends EventEmitter {
  private agents = new Map<string, {
    config: AgentConfig
    pty: PTYManager
    detector: StateDetector
    readinessDetector: AIReadinessDetector
    // SafeTerminal removed - not needed with xterm.js
    status: 'idle' | 'busy' | 'error' | 'offline'
    metrics: {
      tasksCompleted: number
      tasksFailed: number
      averageResponseTime: number
      lastActivity: number
      uptime: number
    }
    lastPrompt?: string
    lastResponse?: string
  }>()

  private injector = new InputInjector()
  private memory = new Map<string, any>()

  constructor() {
    super()
  }

  async spawnAgent(cfg: AgentConfig): Promise<AgentInfo> {
    if (this.agents.has(cfg.id)) throw new Error(`Agent exists: ${cfg.id}`)
    const ptyCfg: PTYConfig = { command: cfg.command, args: cfg.args, env: cfg.env }
    const pty = new PTYManager(ptyCfg)
    await pty.spawn()

    const detector = new StateDetector({ defaultState: 'initializing' })
    
    // Create readiness detector for AI-specific prompts
    const readinessDetector = new AIReadinessDetector(cfg.type, 1000)
    
    pty.on('output', (data) => {
      detector.process(data)
      readinessDetector.process(data)  // Check for AI readiness patterns
      
      // Pass through raw output to xterm.js - it handles all terminal sequences
      // No buffering needed here since xterm.js maintains its own scrollback
      this.emit('agent-output', { agentId: cfg.id, data: data, timestamp: Date.now() })
    })
    
    // Listen for readiness changes
    readinessDetector.on('ready', (result) => {
      this.emit('agent-ready', { agentId: cfg.id, ...result })
    })
    
    readinessDetector.on('not-ready', (result) => {
      this.emit('agent-busy', { agentId: cfg.id, ...result })
    })
    
    // Connect StateDetector state changes to orchestrator events
    detector.on('state-changed', (result) => {
      this.emit('state-change', { agentId: cfg.id, newState: result.current, confidence: result.confidence })
    })
    
    pty.on('state-change', (s) => {
      // Still emit PTY state changes for terminal-level events (error, terminated)
      if (s === 'error' || s === 'terminated') {
        this.emit('state-change', { agentId: cfg.id, newState: s })
      }
    })
    pty.on('error', (e) => {
      this.emit('agent-error', { agentId: cfg.id, error: (e as Error).message })
    })

    this.injector.registerAgent(cfg.name, pty)

    this.agents.set(cfg.id, {
      config: cfg,
      pty,
      detector,
      readinessDetector,
      // safe removed - not needed
      status: 'idle',
      metrics: { tasksCompleted: 0, tasksFailed: 0, averageResponseTime: 0, lastActivity: Date.now(), uptime: Date.now() },
    })

    const info = this.getAgentInfo(cfg.id)
    this.emit('agent-spawned', { agent: info })
    return info
  }

  terminateAgent(id: string) {
    const a = this.agents.get(id)
    if (!a) return
    a.pty.kill()
    this.injector.unregisterAgent(a.config.name)
    this.agents.delete(id)
    this.emit('agent-terminated', { agentId: id })
  }

  listAgents(): AgentInfo[] { return [...this.agents.keys()].map((id) => this.getAgentInfo(id)) }
  
  resetAgentState(id: string, newState: string = 'ready') {
    const a = this.agents.get(id)
    if (!a) throw new Error(`Agent not found: ${id}`)
    a.detector.setState(newState)
    a.status = newState === 'error' ? 'error' : 'idle'
    this.emit('state-change', { agentId: id, newState })
  }
  
  resizeAgent(id: string, cols: number, rows: number) {
    const a = this.agents.get(id)
    if (!a) throw new Error(`Agent not found: ${id}`)
    a.pty.resize(cols, rows)
  }
  
  isAgentReady(id: string): boolean {
    const a = this.agents.get(id)
    if (!a) throw new Error(`Agent not found: ${id}`)
    return a.readinessDetector.isReady()
  }
  
  async waitForReady(id: string, timeout: number = 30000): Promise<boolean> {
    const a = this.agents.get(id)
    if (!a) throw new Error(`Agent not found: ${id}`)
    
    if (a.readinessDetector.isReady()) return true
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        a.readinessDetector.off('ready', onReady)
        resolve(false)
      }, timeout)
      
      const onReady = () => {
        clearTimeout(timer)
        resolve(true)
      }
      
      a.readinessDetector.once('ready', onReady)
    })
  }

  getAgentInfo(id: string): AgentInfo {
    const a = this.agents.get(id)
    if (!a) throw new Error(`Agent not found: ${id}`)
    return {
      id,
      name: a.config.name,
      type: a.config.type,
      state: a.detector.getCurrent(),
      ready: a.readinessDetector.isReady(),
      metrics: a.metrics,
      lastPrompt: a.lastPrompt,
      lastResponse: a.lastResponse,
    }
  }

  async injectToAgent(id: string, prompt: string, opts: { waitForResponse?: boolean; raw?: boolean } = {}) {
    const a = this.agents.get(id)
    if (!a) throw new Error(`Agent not found: ${id}`)
    a.status = 'busy'
    a.lastPrompt = prompt
    const start = Date.now()
    try {
      await this.injector.inject(a.config.name, prompt, { 
        confirmWithEnter: !opts.raw,
        raw: opts.raw 
      })
      a.metrics.tasksCompleted++
      const dt = Date.now() - start
      a.metrics.averageResponseTime = (a.metrics.averageResponseTime * (a.metrics.tasksCompleted - 1) + dt) / a.metrics.tasksCompleted
      a.status = 'idle'
      return { success: true }
    } catch (e) {
      a.metrics.tasksFailed++
      a.status = 'error'
      this.emit('agent-error', { agentId: id, error: (e as Error).message })
      throw e
    }
  }

  // Simple sequential workflow implementation
  async executeWorkflow(workflow: Workflow): Promise<Map<string, any>> {
    const results = new Map<string, any>()
    for (const step of workflow.steps) {
      const agentId = step.agent ?? this.pickAgent(step)
      if (!agentId) throw new Error(`No suitable agent for step ${step.name}`)
      await this.injectToAgent(agentId, step.prompt)
      if (step.outputKey) this.memory.set(step.outputKey, '[response-streamed]')
      results.set(step.id, { ok: true })
    }
    return results
  }

  private pickAgent(step: WorkflowStep): string | null {
    // Very simple: first idle agent
    for (const [id, a] of this.agents) {
      if (a.status === 'idle') return id
    }
    return null
  }

  saveToMemory(key: string, value: any) { this.memory.set(key, value) }
  loadFromMemory(key: string) { return this.memory.get(key) }
}

