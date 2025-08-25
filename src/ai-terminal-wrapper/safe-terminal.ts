export interface SafeTerminalConfig {
  maxOutputBuffer?: number
  maxLineLength?: number
  stripAnsiCodes?: boolean
  escapeControlChars?: boolean
}

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g
const CONTROL_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const CURSOR_CONTROL = /\x1b\[[0-9;]*[HfABCDEFGJKSTsu]/g
const CLEAR_SCREEN = /\x1b\[(2J|[0-9]*K)/g
// iTerm2 and Terminal.app integration sequences - match all OSC sequences
const ITERM_INTEGRATION = /\x1b\]1337;[^\x07]*\x07/g
const OSC_SEQUENCES = /\x1b\][0-9]+;[^\x07]*\x07/g  // Matches all OSC sequences
const SHELL_INTEGRATION = /\x1b\[\?2004[hl]/g  // Bracketed paste mode
const PERCENT_PROMPT = /\x1b\[1m\x1b\[7m%\x1b\[27m\x1b\[1m\x1b\[0m\s*/g  // zsh percent prompt
const BACKSPACE_SEQUENCES = /.\x08/g  // Character followed by backspace

export class SafeTerminal {
  private readonly cfg: Required<SafeTerminalConfig>
  private buf: string[] = []

  constructor(cfg: SafeTerminalConfig = {}) {
    this.cfg = {
      maxOutputBuffer: cfg.maxOutputBuffer ?? 100_000,
      maxLineLength: cfg.maxLineLength ?? 500,
      stripAnsiCodes: cfg.stripAnsiCodes ?? false,
      escapeControlChars: cfg.escapeControlChars ?? false,  // Default to false - we're removing them instead
    }
  }

  sanitize(text: string): string {
    let t = text
    
    // Check for clear screen command BEFORE removing it
    const hasClearScreen = CLEAR_SCREEN.test(t)
    
    // Remove backspace sequences (char followed by backspace)
    t = t.replace(BACKSPACE_SEQUENCES, '')
    
    // Remove cursor control sequences
    t = t.replace(CURSOR_CONTROL, '')
    
    // Handle clear screen specially - emit an event or marker
    if (hasClearScreen) {
      // Insert a special marker that the UI can detect
      t = t.replace(CLEAR_SCREEN, '\x1b[CLEAR_SCREEN]')
    }
    
    // Remove iTerm2 and Terminal.app integration sequences
    t = t.replace(ITERM_INTEGRATION, '')
    t = t.replace(OSC_SEQUENCES, '')
    t = t.replace(SHELL_INTEGRATION, '')
    t = t.replace(PERCENT_PROMPT, '')  // Remove zsh percent prompt
    
    // Optionally strip all ANSI codes
    if (this.cfg.stripAnsiCodes) t = t.replace(ANSI_REGEX, '')
    
    // Escape remaining control characters
    if (this.cfg.escapeControlChars) {
      t = t.replace(CONTROL_REGEX, (ch) => {
        const code = ch.charCodeAt(0)
        if (code === 0x0a || code === 0x0d || code === 0x09) return ch
        return `\\x${code.toString(16).padStart(2, '0')}`
      })
    }
    
    // Apply line length limit
    t = t.split('\n').map(l => l.length > this.cfg.maxLineLength ? l.slice(0, this.cfg.maxLineLength) + '…' : l).join('\n')
    this.add(t)
    return t
  }

  private add(t: string) {
    this.buf.push(t)
    let total = this.buf.reduce((s, c) => s + c.length, 0)
    while (total > this.cfg.maxOutputBuffer && this.buf.length > 0) {
      const r = this.buf.shift()!
      total -= r.length
    }
  }

  getSafeCopy(stripColors = true): string {
    let all = this.buf.join('')
    
    // Remove iTerm2 and Terminal.app integration sequences
    all = all.replace(ITERM_INTEGRATION, '')
    all = all.replace(OSC_SEQUENCES, '')
    all = all.replace(SHELL_INTEGRATION, '')
    
    // Optionally strip ANSI codes
    if (stripColors) all = all.replace(ANSI_REGEX, '')
    
    // Escape control characters
    all = all.replace(CONTROL_REGEX, (ch) => {
      const code = ch.charCodeAt(0)
      if (code === 0x0a || code === 0x0d || code === 0x09) return ch
      return `\\x${code.toString(16).padStart(2, '0')}`
    })
    
    // Truncate if too long
    if (all.length > 50_000) all = all.slice(0, 50_000) + '\n[truncated]'
    return all
  }
}

