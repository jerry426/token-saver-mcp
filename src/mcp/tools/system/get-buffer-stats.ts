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

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {},
    },
    async () => {
      const stats = getBufferStats()
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] }
    },
  )
}
