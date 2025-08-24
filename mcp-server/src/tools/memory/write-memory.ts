import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ToolMetadata } from '../types'
import { memoryDb, MemoryScope } from '../../db/memory-db'

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
      ttl: 'Time-to-live in seconds (optional)',
      tags: 'Array of tags for categorization (optional)',
    },

    examples: [
      {
        title: 'Store project architecture',
        code: `write_memory({
  key: "project.architecture",
  value: "Next.js with Prisma and PostgreSQL"
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
  tags: ["auth", "refactoring"]
})`,
      },
      {
        title: 'Store discovered issue',
        code: `write_memory({
  key: "discovered.memory_leak",
  value: "WebSocket handler not cleaning up connections",
  ttl: 86400  // Expires in 24 hours
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
}): Promise<any> {
  try {
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

    // Write the memory
    const memory = memoryDb.write({
      key: params.key,
      value: params.value,
      scope,
      project_path: scope === MemoryScope.PROJECT ? projectPath : undefined,
      created_by: 'claude', // TODO: Get from session
      ttl: params.ttl,
      tags: params.tags,
    })

    // Parse value for display
    let valueDisplay = memory.value
    try {
      const parsed = JSON.parse(memory.value)
      valueDisplay = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
    } catch {}

    return {
      content: [{
        type: 'text',
        text: `✅ Memory saved: ${params.key}\nScope: ${scope}\nValue: ${valueDisplay}`,
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
      },
    },
    handler as any, // Type mismatch between zod schema and handler params
  )
}