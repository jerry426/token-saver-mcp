import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Memory } from '../../db/memory-db'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { memoryDb, MemoryScope } from '../../db/memory-db'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'search_memories',
  title: 'Search Memories',
  category: 'memory' as const,
  description: 'Full-text search across all memory keys and values to find relevant context.',

  docs: {
    brief: 'Search memories using natural language queries',

    parameters: {
      query: 'Natural language search query (supports phrases, wildcards, boolean operators)',
      scope: 'Filter by scope: global, project, session, or shared (optional)',
      minImportance: 'Only return memories at or above this importance 1-5 (optional)',
      maxVerbosity: 'Only return memories at or below this verbosity 1-4 (optional)',
      limit: 'Maximum number of results to return (optional, default: 50)',
    },

    examples: [
      {
        title: 'Search for concept',
        code: `search_memories({
  query: "token reduction 86%"
})`,
      },
      {
        title: 'Search for technical terms',
        code: `search_memories({
  query: "SQLite WAL mode"
})`,
      },
      {
        title: 'Search with importance filter',
        code: `search_memories({
  query: "architecture decisions",
  minImportance: 4
})`,
      },
      {
        title: 'Phrase search',
        code: `search_memories({
  query: '"memory isolation"'  // Exact phrase
})`,
      },
      {
        title: 'Boolean search',
        code: `search_memories({
  query: "Gemini AND sharing"  // Both terms required
})`,
      },
    ],

    workflow: {
      usedWith: ['read_memory', 'smart_resume'],
      followedBy: ['Read specific memories for full details'],
      description: 'Discover memories by content, not just by key',
    },

    tips: [
      'Results are ranked by relevance',
      'Use quotes for exact phrase matching',
      'Supports AND, OR, NOT operators',
      'Falls back to LIKE search if FTS5 unavailable',
      'Searches both keys and values',
    ],

    meta: {
      isCore: true,
    },
  },
}

// Tool handler
export async function handler(params: {
  query: string
  scope?: 'global' | 'project' | 'session' | 'shared'
  minImportance?: number
  maxVerbosity?: number
  limit?: number
}): Promise<any> {
  try {
    if (!params.query || !params.query.trim()) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Search query cannot be empty',
        }],
      }
    }

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

    // Search memories
    const memories = memoryDb.searchMemories({
      query: params.query,
      scope,
      project_path: (!scope || scope === MemoryScope.PROJECT) ? projectPath : undefined,
      minImportance: params.minImportance,
      maxVerbosity: params.maxVerbosity,
      limit: params.limit,
    })

    if (memories.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No memories found matching: "${params.query}"`,
        }],
      }
    }

    // Format the response with relevance ranking
    const formatted = memories.map((memory: Memory & { rank?: number }, index: number) => {
      let value = memory.value
      try {
        value = JSON.parse(memory.value)
        // Truncate long values for listing
        if (typeof value === 'object') {
          value = `${JSON.stringify(value).substring(0, 150)}...`
        }
        else if (typeof value === 'string' && value.length > 150) {
          value = `${value.substring(0, 150)}...`
        }
      }
      catch {}

      return {
        rank: index + 1,
        key: memory.key,
        value,
        scope: memory.scope,
        importance: memory.importance,
        verbosity: memory.verbosity,
        updated_at: memory.updated_at,
      }
    })

    // Add summary
    const summary = `Found ${memories.length} memories matching "${params.query}"${params.scope ? ` in ${params.scope} scope` : ''} (ranked by relevance)`

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
        text: `Error searching memories: ${error.message}`,
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
        query: z.string().describe('Search query (natural language, phrases, or boolean)'),
        scope: z.enum(['global', 'project', 'session', 'shared']).optional().describe('Filter by memory scope'),
        minImportance: z.number().min(1).max(5).optional().describe('Minimum importance level'),
        maxVerbosity: z.number().min(1).max(4).optional().describe('Maximum verbosity level'),
        limit: z.number().optional().describe('Maximum results to return'),
      },
    },
    handler,
  )
}
