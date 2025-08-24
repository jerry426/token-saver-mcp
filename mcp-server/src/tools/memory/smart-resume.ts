import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ToolMetadata } from '../types'
import { memoryDb, MemoryScope, type Memory } from '../../db/memory-db'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'smart_resume',
  title: 'Smart Resume',
  category: 'memory' as const,
  description: 'Intelligently restore context from stored memories. Replaces /resume with 90% fewer tokens.',

  docs: {
    brief: 'Smart context restoration from memories',

    parameters: {
      verbose: 'Include detailed memory values (default: false)',
    },

    examples: [
      {
        title: 'Quick resume with summary',
        code: `smart_resume()`,
      },
      {
        title: 'Detailed resume with all values',
        code: `smart_resume({
  verbose: true
})`,
      },
    ],

    workflow: {
      usedWith: ['write_memory', 'read_memory'],
      followedBy: ['Continue work with restored context'],
      description: 'Start new session with precise context instead of conversation dump',
    },

    tips: [
      'Use at the start of each session instead of /resume',
      'Provides focused briefing with only relevant context',
      'Shows current task, project info, and recent discoveries',
      'Typically uses 200-500 tokens vs 5000+ for /resume',
      'Builds on memories from previous sessions',
    ],

    meta: {
      isCore: true,
      replacesResume: true,
    },
  },
}

// Tool handler
export async function handler(params: {
  verbose?: boolean
} = {}): Promise<any> {
  try {
    const projectPath = process.cwd()
    
    // Fetch different categories of memories
    const projectMemories = memoryDb.read({
      pattern: 'project.*',
      scope: MemoryScope.PROJECT,
      project_path: projectPath,
    }) as Memory[] || []

    const currentMemories = memoryDb.read({
      pattern: 'current.*',
      scope: MemoryScope.PROJECT,
      project_path: projectPath,
    }) as Memory[] || []

    const discoveredMemories = memoryDb.read({
      pattern: 'discovered.*',
      scope: MemoryScope.PROJECT,
      project_path: projectPath,
    }) as Memory[] || []

    const nextMemories = memoryDb.read({
      pattern: 'next.*',
      scope: MemoryScope.PROJECT,
      project_path: projectPath,
    }) as Memory[] || []

    // Get database stats
    const stats = memoryDb.getStats()

    // Helper to parse memory values
    const parseMemory = (memory: Memory) => {
      try {
        return JSON.parse(memory.value)
      } catch {
        return memory.value
      }
    }

    // Build context summary
    const contextSummary: any = {
      project_context: {},
      current_work: {},
      discoveries: {},
      next_steps: {},
    }

    // Process project memories
    projectMemories.forEach(m => {
      const key = m.key.replace('project.', '')
      contextSummary.project_context[key] = parseMemory(m)
    })

    // Process current work
    currentMemories.forEach(m => {
      const key = m.key.replace('current.', '')
      contextSummary.current_work[key] = parseMemory(m)
    })

    // Process discoveries
    discoveredMemories.forEach(m => {
      const key = m.key.replace('discovered.', '')
      contextSummary.discoveries[key] = parseMemory(m)
    })

    // Process next steps
    nextMemories.forEach(m => {
      const key = m.key.replace('next.', '')
      contextSummary.next_steps[key] = parseMemory(m)
    })

    // Build human-readable briefing
    let briefing = '📚 **Smart Resume - Context Restored**\n\n'

    // Project information
    if (Object.keys(contextSummary.project_context).length > 0) {
      briefing += '**🏗️ Project Context:**\n'
      for (const [key, value] of Object.entries(contextSummary.project_context)) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
        briefing += `• ${key}: ${displayValue}\n`
      }
      briefing += '\n'
    }

    // Current work
    if (Object.keys(contextSummary.current_work).length > 0) {
      briefing += '**💻 Current Work:**\n'
      for (const [key, value] of Object.entries(contextSummary.current_work)) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
        briefing += `• ${key}: ${displayValue}\n`
      }
      briefing += '\n'
    }

    // Discoveries
    if (Object.keys(contextSummary.discoveries).length > 0) {
      briefing += '**🔍 Discoveries & Issues:**\n'
      for (const [key, value] of Object.entries(contextSummary.discoveries)) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
        briefing += `• ${key}: ${displayValue}\n`
      }
      briefing += '\n'
    }

    // Next steps
    if (Object.keys(contextSummary.next_steps).length > 0) {
      briefing += '**📋 Next Steps:**\n'
      for (const [key, value] of Object.entries(contextSummary.next_steps)) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
        briefing += `• ${key}: ${displayValue}\n`
      }
      briefing += '\n'
    }

    // Add stats
    briefing += `**📊 Memory Stats:**\n`
    briefing += `• Total memories: ${stats.total_memories}\n`
    briefing += `• Project memories: ${stats.by_scope.project || 0}\n`
    briefing += `• Database size: ${(stats.database_size / 1024).toFixed(1)} KB\n\n`

    // Estimate token usage
    const estimatedTokens = Math.ceil(briefing.length / 4)
    briefing += `**🎯 Context Efficiency:**\n`
    briefing += `• Estimated tokens: ~${estimatedTokens} (vs ~5000+ with /resume)\n`
    briefing += `• Token savings: ~${Math.round((1 - estimatedTokens/5000) * 100)}%\n`

    // Add verbose details if requested
    if (params.verbose) {
      briefing += '\n**📝 Detailed Memory Values:**\n'
      briefing += '```json\n'
      briefing += JSON.stringify(contextSummary, null, 2)
      briefing += '\n```'
    }

    return {
      content: [{
        type: 'text',
        text: briefing,
      }],
    }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error during smart resume: ${error.message}`,
      }],
    }
  }
}

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {
        verbose: z.boolean().optional().describe('Include detailed memory values'),
      },
    },
    handler,
  )
}