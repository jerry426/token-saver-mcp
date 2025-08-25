/**
 * Converts JSON data to human-readable Markdown format
 */

export function jsonToMarkdown(data: any, title?: string): string {
  const lines: string[] = []
  
  if (title) {
    lines.push(`# ${title}`)
    lines.push('')
  }

  function formatValue(value: any, depth: number = 0): string[] {
    const result: string[] = []
    const indent = '  '.repeat(depth)

    if (value === null) {
      result.push(`${indent}*null*`)
    } else if (value === undefined) {
      result.push(`${indent}*undefined*`)
    } else if (typeof value === 'boolean') {
      result.push(`${indent}**${value}**`)
    } else if (typeof value === 'number') {
      result.push(`${indent}\`${value}\``)
    } else if (typeof value === 'string') {
      // Handle multi-line strings
      if (value.includes('\n')) {
        result.push(`${indent}Text:`)
        result.push('```')
        result.push(value)
        result.push('```')
      } else if (value.length > 80) {
        // Long strings - wrap them
        result.push(`${indent}${value.substring(0, 80)}...`)
        result.push(`${indent}...(${value.length} characters total)`)
      } else {
        result.push(`${indent}${value}`)
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        result.push(`${indent}*(empty array)*`)
      } else {
        value.forEach((item, index) => {
          result.push(`${indent}- **[${index}]**:`)
          result.push(...formatValue(item, depth + 1))
        })
      }
    } else if (typeof value === 'object') {
      const entries = Object.entries(value)
      if (entries.length === 0) {
        result.push(`${indent}*(empty object)*`)
      } else {
        entries.forEach(([key, val]) => {
          // Use appropriate heading level based on depth
          if (depth === 0) {
            result.push('')
            result.push(`## ${key}`)
          } else if (depth === 1) {
            result.push('')
            result.push(`${indent}### ${key}`)
          } else {
            result.push(`${indent}**${key}**:`)
          }
          result.push(...formatValue(val, depth + 1))
        })
      }
    } else {
      // Fallback for any other type
      result.push(`${indent}${String(value)}`)
    }

    return result
  }

  // Special handling for common memory patterns
  if (typeof data === 'object' && data !== null) {
    // Check if it's a structured memory object with known patterns
    if ('task' in data || 'workflow' in data || 'context' in data) {
      // Task/workflow memory
      if (data.task) {
        lines.push('## Task Information')
        lines.push(...formatValue(data.task, 1))
      }
      if (data.workflow) {
        lines.push('')
        lines.push('## Workflow')
        lines.push(...formatValue(data.workflow, 1))
      }
      if (data.context) {
        lines.push('')
        lines.push('## Context')
        lines.push(...formatValue(data.context, 1))
      }
      // Handle any remaining fields
      Object.entries(data).forEach(([key, value]) => {
        if (!['task', 'workflow', 'context'].includes(key)) {
          lines.push('')
          lines.push(`## ${key}`)
          lines.push(...formatValue(value, 1))
        }
      })
    } else if ('files' in data || 'codebase' in data) {
      // Codebase memory
      if (data.codebase) {
        lines.push('## Codebase Information')
        lines.push(...formatValue(data.codebase, 1))
      }
      if (data.files) {
        lines.push('')
        lines.push('## Files')
        if (Array.isArray(data.files)) {
          data.files.forEach((file: any) => {
            lines.push('')
            lines.push(`### 📄 ${file.path || file.name || file}`)
            if (typeof file === 'object') {
              lines.push(...formatValue(file, 2))
            }
          })
        } else {
          lines.push(...formatValue(data.files, 1))
        }
      }
      // Handle any remaining fields
      Object.entries(data).forEach(([key, value]) => {
        if (!['files', 'codebase'].includes(key)) {
          lines.push('')
          lines.push(`## ${key}`)
          lines.push(...formatValue(value, 1))
        }
      })
    } else if ('error' in data || 'stack' in data) {
      // Error memory
      lines.push('## ⚠️ Error Information')
      if (data.error) {
        lines.push('')
        lines.push('### Error Message')
        lines.push(...formatValue(data.error, 1))
      }
      if (data.stack) {
        lines.push('')
        lines.push('### Stack Trace')
        lines.push('```')
        lines.push(data.stack)
        lines.push('```')
      }
      // Handle any remaining fields
      Object.entries(data).forEach(([key, value]) => {
        if (!['error', 'stack'].includes(key)) {
          lines.push('')
          lines.push(`## ${key}`)
          lines.push(...formatValue(value, 1))
        }
      })
    } else {
      // Generic object formatting
      lines.push(...formatValue(data, 0))
    }
  } else {
    // Simple value
    lines.push(...formatValue(data, 0))
  }

  return lines.join('\n')
}

/**
 * Create a summary for large JSON objects
 */
export function createJsonSummary(data: any): string {
  const summary: string[] = []

  function summarizeValue(value: any, maxDepth: number = 2, currentDepth: number = 0): string {
    if (currentDepth >= maxDepth) {
      if (Array.isArray(value)) return `[Array: ${value.length} items]`
      if (typeof value === 'object' && value !== null) {
        return `{Object: ${Object.keys(value).length} keys}`
      }
      return '...'
    }

    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'boolean' || typeof value === 'number') return String(value)
    if (typeof value === 'string') {
      return value.length > 50 ? `"${value.substring(0, 47)}..."` : `"${value}"`
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]'
      if (value.length === 1) return `[${summarizeValue(value[0], maxDepth, currentDepth + 1)}]`
      return `[${value.length} items]`
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value)
      if (keys.length === 0) return '{}'
      if (keys.length <= 3) {
        const parts = keys.map(k => `${k}: ${summarizeValue(value[k], maxDepth, currentDepth + 1)}`)
        return `{${parts.join(', ')}}`
      }
      return `{${keys.slice(0, 3).join(', ')}, ... (${keys.length} keys total)}`
    }
    return String(value)
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    Object.entries(data).forEach(([key, value]) => {
      summary.push(`**${key}**: ${summarizeValue(value)}`)
    })
  } else {
    summary.push(summarizeValue(data))
  }

  return summary.join(' | ')
}