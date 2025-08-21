import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { getBufferStats } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'get_buffer_stats',
  title: 'Get Buffer Statistics',
  category: 'system' as const,
  description: 'Get statistics about currently buffered responses',

  docs: {
    brief: 'Monitor buffer system status and available buffers',

    parameters: {},

    examples: [
      {
        title: 'Check buffer system status',
        code: `get_buffer_stats()`,
      },
    ],

    workflow: {
      usedWith: ['retrieve_buffer'],
      followedBy: ['retrieve_buffer for specific buffers'],
      description: 'Check what buffered data is available before retrieval',
    },

    tips: [
      'Shows all currently available buffer IDs',
      'Displays buffer sizes, creation times, and expiry info',
      'Useful for debugging when buffered responses are not found',
      'Helps understand memory usage of the buffer system',
    ],

    meta: {
      isUtility: true,
      supportsTool: 'Buffer management system',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler(): Promise<any> {
  const stats = getBufferStats()
  
  if (stats.activeBuffers === 0) {
    return { 
      content: [{ 
        type: 'text', 
        text: 'No active buffers. Buffers are created when tools return large responses exceeding 2500 tokens.' 
      }] 
    }
  }
  
  const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2)
  
  return { 
    content: [{ 
      type: 'text', 
      text: JSON.stringify({
        activeBuffers: stats.activeBuffers,
        totalSizeMB: totalSizeMB,
        oldestBufferAge: stats.oldestBuffer ? `${Math.floor(stats.oldestBuffer / 1000)}s` : null,
        buffers: stats.buffers,
        note: 'Buffers expire automatically after 60 seconds'
      }, null, 2) 
    }] 
  }
}

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {},
    },
    handler  // Use the exported handler
  )
}
