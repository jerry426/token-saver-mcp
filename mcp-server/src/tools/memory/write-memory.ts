import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { memoryDb, MemoryScope } from '../../db/memory-db'
import { loadConfig } from './configure-memory'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'write_memory',
  title: 'Write Memory',
  category: 'memory' as const,
  description: 'Store a memory for persistent context across sessions. Replaces inefficient /resume with targeted knowledge storage.',

  docs: {
    brief: 'Write persistent memory for context preservation',

    parameters: {
      key: 'Hierarchical key (e.g., "project.architecture", "current.task")',
      value: 'Any JSON-serializable value to store',
      scope: 'Memory scope: global, project, session, or shared (default: project)',
      importance: 'Importance level 1-5: 1=trivial, 2=low, 3=standard (default), 4=high, 5=critical',
      verbosity: 'Verbosity level 1-4: 1=minimal, 2=standard (default), 3=detailed, 4=comprehensive',
      ttl: 'Time-to-live in seconds (optional)',
      tags: 'Array of tags for categorization (optional)',
    },

    examples: [
      {
        title: 'Store critical project architecture',
        code: `write_memory({
  key: "project.architecture",
  value: "Next.js with Prisma and PostgreSQL",
  importance: 5,  // Critical - must never be lost
  verbosity: 2    // Standard - include in normal context
})`,
      },
      {
        title: 'Track current task with metadata',
        code: `write_memory({
  key: "current.task",
  value: {
    description: "Refactoring authentication",
    progress: 70,
    blockers: ["Missing OAuth config"]
  },
  importance: 3,  // Standard importance
  verbosity: 2,   // Standard verbosity
  tags: ["auth", "refactoring"]
})`,
      },
      {
        title: 'Store detailed discussion for future reference',
        code: `write_memory({
  key: "discussion.database_philosophy",
  value: "User shared Oracle pain points with rigid schemas",
  importance: 2,  // Low - interesting but not critical
  verbosity: 4,   // Comprehensive - only pull when needed
  ttl: 86400 * 30 // Keep for 30 days
})`,
      },
    ],

    workflow: {
      usedWith: ['read_memory', 'list_memories', 'smart_resume'],
      followedBy: ['Continue work in next session'],
      description: 'Build persistent knowledge about projects',
    },

    tips: [
      'Use hierarchical keys for organization (project.*, current.*, discovered.*)',
      'Store only essential context, not conversation history',
      'Project scope is default and most common',
      'TTL is useful for temporary findings',
      'Overwrites existing memory with same key and scope',
    ],

    meta: {
      isCore: true,
      replacesResume: true,
    },
  },
}

// Tool handler
export async function handler(params: {
  key: string
  value: any
  scope?: 'global' | 'project' | 'session' | 'shared'
  ttl?: number
  tags?: string[]
  importance?: number // 1-5 scale
  verbosity?: number // 1-4 scale
}): Promise<any> {
  try {
    // Validate key is not empty or whitespace
    if (!params.key || !params.key.trim()) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Memory key cannot be empty or whitespace',
        }],
      }
    }

    // Load configuration for defaults
    const config = loadConfig()

    // Check if key matches any pattern prefix for automatic settings
    let autoImportance = params.importance
    let autoVerbosity = params.verbosity

    if (!autoImportance || !autoVerbosity) {
      for (const [prefix, settings] of Object.entries(config.patternPrefixes)) {
        if (params.key.startsWith(prefix)) {
          autoImportance = autoImportance || settings.importance
          autoVerbosity = autoVerbosity || settings.verbosity
          break
        }
      }
    }

    // Get current working directory as project path
    const projectPath = process.cwd()

    const scope = params.scope ? MemoryScope[params.scope.toUpperCase() as keyof typeof MemoryScope] : MemoryScope.PROJECT

    if (params.scope && !scope) {
      return {
        content: [{
          type: 'text',
          text: `Invalid scope: ${params.scope}. Use: global, project, session, or shared`,
        }],
      }
    }

    // Write the memory with config defaults
    const memory = memoryDb.write({
      key: params.key,
      value: params.value,
      scope,
      project_path: scope === MemoryScope.PROJECT ? projectPath : undefined,
      created_by: 'claude', // TODO: Get from session
      ttl: params.ttl || config.ttlDefault || undefined,
      tags: params.tags,
      importance: autoImportance || config.defaultImportance,
      verbosity: autoVerbosity || config.defaultVerbosity,
    })

    // Parse value for display
    let valueDisplay = memory.value
    try {
      const parsed = JSON.parse(memory.value)
      valueDisplay = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
    }
    catch {}

    const importanceLabel = ['', 'Trivial', 'Low', 'Standard', 'High', 'Critical'][memory.importance || 3]
    const verbosityLabel = ['', 'Minimal', 'Standard', 'Detailed', 'Comprehensive'][memory.verbosity || 2]

    return {
      content: [{
        type: 'text',
        text: `✅ Memory saved: ${params.key}\nScope: ${scope}\nImportance: ${importanceLabel} (${memory.importance || 3})\nVerbosity: ${verbosityLabel} (${memory.verbosity || 2})\nValue: ${valueDisplay}`,
      }],
    }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error writing memory: ${error.message}`,
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
        key: z.string().describe('Hierarchical key for the memory'),
        value: z.any().describe('Value to store (any JSON-serializable type)'),
        scope: z.enum(['global', 'project', 'session', 'shared']).optional().describe('Memory scope (default: project)'),
        ttl: z.number().optional().describe('Time-to-live in seconds'),
        tags: z.array(z.string()).optional().describe('Tags for categorization'),
        importance: z.number().min(1).max(5).optional().describe('Importance level 1-5 (1=trivial, 3=standard, 5=critical)'),
        verbosity: z.number().min(1).max(4).optional().describe('Verbosity level 1-4 (1=minimal, 2=standard, 3=detailed, 4=comprehensive)'),
      },
    },
    handler as any, // Type mismatch between zod schema and handler params
  )
}
