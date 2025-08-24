import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Memory } from '../../db/memory-db'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { memoryDb, MemoryScope } from '../../db/memory-db'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'read_memory',
  title: 'Read Memory',
  category: 'memory' as const,
  description: 'Retrieve stored memories by key or pattern. Essential for restoring context without token waste.',

  docs: {
    brief: 'Read persistent memories for context restoration',

    parameters: {
      key: 'Exact key or pattern with wildcards (*)',
      scope: 'Memory scope to search: global, project, session, or shared (optional)',
    },

    examples: [
      {
        title: 'Read specific memory',
        code: `read_memory({
  key: "project.architecture"
})`,
      },
      {
        title: 'Read all project memories',
        code: `read_memory({
  key: "project.*"
})`,
      },
      {
        title: 'Read current task memories',
        code: `read_memory({
  key: "current.*",
  scope: "project"
})`,
      },
    ],

    workflow: {
      usedWith: ['write_memory', 'list_memories', 'smart_resume'],
      followedBy: ['Continue work with restored context'],
      description: 'Restore focused context instead of conversation history',
    },

    tips: [
      'Use wildcards (*) to read multiple related memories',
      'Returns single memory for exact match, array for patterns',
      'Automatically updates access time and count',
      'Much more efficient than /resume command',
      'Values are automatically parsed from JSON',
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
  scope?: 'global' | 'project' | 'session' | 'shared'
}): Promise<any> {
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

    // Determine if this is a pattern search
    const isPattern = params.key.includes('*')

    // Read the memory/memories
    const result = memoryDb.read({
      key: !isPattern ? params.key : undefined,
      pattern: isPattern ? params.key : undefined,
      scope,
      project_path: (!scope || scope === MemoryScope.PROJECT) ? projectPath : undefined,
    })

    if (!result) {
      return {
        content: [{
          type: 'text',
          text: `No memory found for key: ${params.key}`,
        }],
      }
    }

    // Format the response
    const formatMemory = (memory: Memory) => {
      let value = memory.value
      try {
        value = JSON.parse(memory.value)
      }
      catch {}

      return {
        key: memory.key,
        value,
        scope: memory.scope,
        created_at: memory.created_at,
        updated_at: memory.updated_at,
        access_count: memory.access_count,
        tags: memory.tags ? JSON.parse(memory.tags) : undefined,
      }
    }

    if (Array.isArray(result)) {
      const formatted = result.map(formatMemory)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formatted, null, 2),
        }],
      }
    }
    else {
      const formatted = formatMemory(result)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formatted, null, 2),
        }],
      }
    }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error reading memory: ${error.message}`,
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
        key: z.string().describe('Exact key or pattern with wildcards (*)'),
        scope: z.enum(['global', 'project', 'session', 'shared']).optional().describe('Memory scope to search'),
      },
    },
    handler,
  )
}
