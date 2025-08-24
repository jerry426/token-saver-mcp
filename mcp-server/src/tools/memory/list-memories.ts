import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ToolMetadata } from '../types'
import { memoryDb, MemoryScope, type Memory } from '../../db/memory-db'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'list_memories',
  title: 'List Memories',
  category: 'memory' as const,
  description: 'List all stored memories with optional filtering by scope or project.',

  docs: {
    brief: 'List and browse stored memories',

    parameters: {
      scope: 'Filter by scope: global, project, session, or shared (optional)',
      limit: 'Maximum number of memories to return (optional)',
      tags: 'Filter by tags (optional)',
    },

    examples: [
      {
        title: 'List all project memories',
        code: `list_memories({
  scope: "project"
})`,
      },
      {
        title: 'List recent memories',
        code: `list_memories({
  limit: 10
})`,
      },
      {
        title: 'List tagged memories',
        code: `list_memories({
  tags: ["important", "bug"]
})`,
      },
    ],

    workflow: {
      usedWith: ['write_memory', 'read_memory', 'delete_memory'],
      followedBy: ['Read specific memories for details'],
      description: 'Browse and discover stored context',
    },

    tips: [
      'Ordered by most recently accessed first',
      'Shows memory keys, scopes, and access counts',
      'Useful for discovering what context is available',
      'Default shows all memories for current project',
    ],

    meta: {
      isUtility: true,
    },
  },
}

// Tool handler
export async function handler(params: {
  scope?: 'global' | 'project' | 'session' | 'shared'
  limit?: number
  tags?: string[]
} = {}): Promise<any> {
  try {
    // Get current working directory as project path
    const projectPath = process.cwd()
    
    const scope = params.scope ? MemoryScope[params.scope.toUpperCase() as keyof typeof MemoryScope] : undefined

    if (params.scope && !scope) {
      return {
        content: [{
          type: 'text',
          text: `Invalid scope: ${params.scope}. Use: global, project, session, or shared`,
        }],
      }
    }

    // List memories
    const memories = memoryDb.list({
      scope,
      project_path: (!scope || scope === MemoryScope.PROJECT) ? projectPath : undefined,
      tags: params.tags,
      limit: params.limit || 50,
    })

    if (memories.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No memories found',
        }],
      }
    }

    // Format the response
    const formatted = memories.map((memory: Memory) => {
      let value = memory.value
      try {
        value = JSON.parse(memory.value)
        // Truncate long values for listing
        if (typeof value === 'object') {
          value = JSON.stringify(value).substring(0, 100) + '...'
        } else if (typeof value === 'string' && value.length > 100) {
          value = value.substring(0, 100) + '...'
        }
      } catch {}

      return {
        key: memory.key,
        value,
        scope: memory.scope,
        access_count: memory.access_count,
        updated_at: memory.updated_at,
        tags: memory.tags ? JSON.parse(memory.tags) : undefined,
      }
    })

    // Add summary
    const summary = `Found ${memories.length} memories${params.scope ? ` in ${params.scope} scope` : ''}`

    return {
      content: [{
        type: 'text',
        text: `${summary}\n\n${JSON.stringify(formatted, null, 2)}`,
      }],
    }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error listing memories: ${error.message}`,
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
        scope: z.enum(['global', 'project', 'session', 'shared']).optional().describe('Filter by memory scope'),
        limit: z.number().optional().describe('Maximum number of memories to return'),
        tags: z.array(z.string()).optional().describe('Filter by tags'),
      },
    },
    handler,
  )
}