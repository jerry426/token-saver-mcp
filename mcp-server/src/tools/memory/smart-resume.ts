import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Memory } from '../../db/memory-db'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { memoryDb, MemoryScope } from '../../db/memory-db'
import { loadConfig } from './configure-memory'

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
      verbosity: 'Filter by verbosity level 1-4: 1=minimal, 2=standard (default), 3=detailed, 4=comprehensive',
      minImportance: 'Only include memories at or above this importance 1-5: 1=trivial, 2=low (default), 3=standard, 4=high, 5=critical',
      daysAgo: 'Only return memories updated in last N days (optional)',
      since: 'ISO date string - only return memories updated after this date (optional)',
      until: 'ISO date string - only return memories updated before this date (optional)',
    },

    examples: [
      {
        title: 'Standard resume for new session',
        code: `smart_resume()  // Gets standard verbosity, low+ importance`,
      },
      {
        title: 'Minimal context for quick check-in',
        code: `smart_resume({
  verbosity: 1,      // Minimal verbosity
  minImportance: 4   // High+ importance only
})`,
      },
      {
        title: 'Comprehensive context with discussions',
        code: `smart_resume({
  verbosity: 4,      // Include all details and discussions
  minImportance: 1,  // Include everything, even trivial
  verbose: true      // Show raw memory values too
})`,
      },
      {
        title: 'Resume recent work from last 3 days',
        code: `smart_resume({
  daysAgo: 3,
  verbosity: 2
})`,
      },
      {
        title: 'Resume specific date range',
        code: `smart_resume({
  since: "2025-01-15T00:00:00Z",
  until: "2025-01-20T23:59:59Z",
  minImportance: 3
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
      'Adjust verbosity based on needs: 1=critical only, 4=everything',
      'Filter by importance to focus on what matters now',
      'Standard settings (verbosity=2, minImportance=2) ideal for most sessions',
      'Typically uses 200-500 tokens vs 5000+ for /resume',
      'Progressive disclosure: start minimal, increase if needed',
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
  verbosity?: number // 1-4: Filter memories by verbosity level
  minImportance?: number // 1-5: Only include memories at or above this importance
  daysAgo?: number // Only return memories updated in last N days
  since?: string // ISO date string - only return memories updated after this date
  until?: string // ISO date string - only return memories updated before this date
} = {}): Promise<any> {
  try {
    const projectPath = process.cwd()
    const config = loadConfig()

    // Use configuration defaults if not specified
    const verbosityFilter = params.verbosity ?? config.smartResumeMaxVerbosity
    const importanceFilter = params.minImportance ?? config.smartResumeMinImportance

    // Fetch different categories of memories with filtering
    const projectMemories = memoryDb.readFiltered({
      pattern: 'project.*',
      scope: MemoryScope.PROJECT,
      project_path: projectPath,
      minVerbosity: verbosityFilter,
      minImportance: importanceFilter,
      daysAgo: params.daysAgo,
      since: params.since,
      until: params.until,
    }) || []

    const currentMemories = memoryDb.readFiltered({
      pattern: 'current.*',
      scope: MemoryScope.PROJECT,
      project_path: projectPath,
      minVerbosity: verbosityFilter,
      minImportance: importanceFilter,
      daysAgo: params.daysAgo,
      since: params.since,
      until: params.until,
    }) || []

    const discoveredMemories = memoryDb.readFiltered({
      pattern: 'discovered.*',
      scope: MemoryScope.PROJECT,
      project_path: projectPath,
      minVerbosity: verbosityFilter,
      minImportance: importanceFilter,
      daysAgo: params.daysAgo,
      since: params.since,
      until: params.until,
    }) || []

    const nextMemories = memoryDb.readFiltered({
      pattern: 'next.*',
      scope: MemoryScope.PROJECT,
      project_path: projectPath,
      minVerbosity: verbosityFilter,
      minImportance: importanceFilter,
      daysAgo: params.daysAgo,
      since: params.since,
      until: params.until,
    }) || []

    // Get database stats
    const stats = memoryDb.getStats()

    // Helper to parse memory values
    const parseMemory = (memory: Memory) => {
      try {
        return JSON.parse(memory.value)
      }
      catch {
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
    projectMemories.forEach((m) => {
      const key = m.key.replace('project.', '')
      contextSummary.project_context[key] = parseMemory(m)
    })

    // Process current work
    currentMemories.forEach((m) => {
      const key = m.key.replace('current.', '')
      contextSummary.current_work[key] = parseMemory(m)
    })

    // Process discoveries
    discoveredMemories.forEach((m) => {
      const key = m.key.replace('discovered.', '')
      contextSummary.discoveries[key] = parseMemory(m)
    })

    // Process next steps
    nextMemories.forEach((m) => {
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
    briefing += `• Database size: ${(stats.database_size / 1024).toFixed(1)} KB\n`

    // Show filtering info if applied
    const verbosityLabel = ['', 'Minimal', 'Standard', 'Detailed', 'Comprehensive'][verbosityFilter]
    const importanceLabel = ['', 'Trivial', 'Low', 'Standard', 'High', 'Critical'][importanceFilter]
    briefing += `• Filter: ${verbosityLabel} verbosity, ${importanceLabel}+ importance\n\n`

    // Estimate token usage
    const estimatedTokens = Math.ceil(briefing.length / 4)
    briefing += `**🎯 Context Efficiency:**\n`
    briefing += `• Estimated tokens: ~${estimatedTokens} (vs ~5000+ with /resume)\n`
    briefing += `• Token savings: ~${Math.round((1 - estimatedTokens / 5000) * 100)}%\n`

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
        verbosity: z.number().min(1).max(4).optional().describe('Filter by verbosity level 1-4 (1=minimal, 2=standard, 3=detailed, 4=comprehensive)'),
        minImportance: z.number().min(1).max(5).optional().describe('Only include memories at or above this importance (1=trivial, 5=critical)'),
        daysAgo: z.number().optional().describe('Only return memories updated in last N days'),
        since: z.string().optional().describe('ISO date string - only return memories updated after this date'),
        until: z.string().optional().describe('ISO date string - only return memories updated before this date'),
      },
    },
    handler,
  )
}
