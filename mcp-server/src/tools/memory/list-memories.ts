import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Memory } from '../../db/memory-db'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { memoryDb, MemoryScope } from '../../db/memory-db'

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
      minImportance: 'Only show memories at or above this importance 1-5 (optional)',
      maxVerbosity: 'Only show memories at or below this verbosity 1-4 (optional)',
      daysAgo: 'Only return memories updated in last N days (optional)',
      since: 'ISO date string - only return memories updated after this date (optional)',
      until: 'ISO date string - only return memories updated before this date (optional)',
    },

    examples: [
      {
        title: 'List all project memories',
        code: `list_memories({
  scope: "project"
})`,
      },
      {
        title: 'List only critical memories',
        code: `list_memories({
  minImportance: 4,  // High and Critical only
  limit: 10
})`,
      },
      {
        title: 'List concise memories only',
        code: `list_memories({
  maxVerbosity: 2,   // Minimal and Standard only
  scope: "project"
})`,
      },
      {
        title: 'List recent memories from last week',
        code: `list_memories({
  daysAgo: 7,
  scope: "project"
})`,
      },
      {
        title: 'List memories in date range',
        code: `list_memories({
  since: "2025-01-15T00:00:00Z",
  until: "2025-01-20T23:59:59Z"
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
  minImportance?: number // 1-5: Only show memories at or above this importance
  maxVerbosity?: number // 1-4: Only show memories at or below this verbosity
  daysAgo?: number // Only return memories updated in last N days
  since?: string // ISO date string - only return memories updated after this date
  until?: string // ISO date string - only return memories updated before this date
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

    // List memories with filtering
    const memories = memoryDb.readFiltered({
      scope,
      project_path: (!scope || scope === MemoryScope.PROJECT) ? projectPath : undefined,
      minImportance: params.minImportance,
      minVerbosity: params.maxVerbosity, // Note: maxVerbosity maps to minVerbosity in readFiltered
      daysAgo: params.daysAgo,
      since: params.since,
      until: params.until,
    }).slice(0, params.limit || 50) // Apply limit after filtering

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
          value = `${JSON.stringify(value).substring(0, 100)}...`
        }
        else if (typeof value === 'string' && value.length > 100) {
          value = `${value.substring(0, 100)}...`
        }
      }
      catch {}

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
        minImportance: z.number().min(1).max(5).optional().describe('Only show memories at or above this importance'),
        maxVerbosity: z.number().min(1).max(4).optional().describe('Only show memories at or below this verbosity'),
        daysAgo: z.number().optional().describe('Only return memories updated in last N days'),
        since: z.string().optional().describe('ISO date string - only return memories updated after this date'),
        until: z.string().optional().describe('ISO date string - only return memories updated before this date'),
      },
    },
    handler,
  )
}
