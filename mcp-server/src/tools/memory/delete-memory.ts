import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { memoryDb, MemoryScope } from '../../db/memory-db'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'delete_memory',
  title: 'Delete Memory',
  category: 'memory' as const,
  description: 'Delete a stored memory by key.',

  docs: {
    brief: 'Remove a memory from storage',

    parameters: {
      key: 'Key of the memory to delete',
      scope: 'Memory scope: global, project, session, or shared (optional)',
    },

    examples: [
      {
        title: 'Delete a specific memory',
        code: `delete_memory({
  key: "temporary.debug_flag"
})`,
      },
      {
        title: 'Delete from specific scope',
        code: `delete_memory({
  key: "old.config",
  scope: "project"
})`,
      },
    ],

    workflow: {
      usedWith: ['list_memories', 'read_memory'],
      followedBy: ['Write new memory if needed'],
      description: 'Clean up outdated or temporary memories',
    },

    tips: [
      'Use for cleaning up temporary or outdated memories',
      'Cannot be undone - memory is permanently deleted',
      'Returns true if memory was deleted, false if not found',
    ],

    meta: {
      isUtility: true,
    },
  },
}

// Tool handler
export async function handler(params: {
  key: string
  scope?: string
}): Promise<any> {
  try {
    // Get current working directory as project path
    const projectPath = process.cwd()
    
    // Map scope string to enum
    const scopeMap: Record<string, MemoryScope> = {
      global: MemoryScope.GLOBAL,
      project: MemoryScope.PROJECT,
      session: MemoryScope.SESSION,
      shared: MemoryScope.SHARED,
    }

    const scope = params.scope ? scopeMap[params.scope] : undefined

    if (params.scope && !scope) {
      return {
        content: [{
          type: 'text',
          text: `Invalid scope: ${params.scope}. Use: global, project, session, or shared`,
        }],
      }
    }

    // Delete the memory
    const deleted = memoryDb.delete({
      key: params.key,
      scope,
      project_path: (!scope || scope === MemoryScope.PROJECT) ? projectPath : undefined,
    })

    return {
      content: [{
        type: 'text',
        text: deleted 
          ? `✅ Memory deleted: ${params.key}`
          : `❌ Memory not found: ${params.key}`,
      }],
    }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error deleting memory: ${error.message}`,
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
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Key of the memory to delete',
          },
          scope: {
            type: 'string',
            enum: ['global', 'project', 'session', 'shared'],
            description: 'Memory scope',
          },
        },
        required: ['key'],
      },
    },
    handler,
  )
}