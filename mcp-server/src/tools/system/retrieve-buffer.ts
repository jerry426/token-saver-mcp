import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { retrieveBuffer } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'retrieve_buffer',
  title: 'Retrieve Buffered Data',
  category: 'system' as const,
  description: 'Retrieve the full data from a buffered response using its buffer ID',

  docs: {
    brief: 'Retrieve complete data from a buffered response',

    parameters: {
      bufferId: 'The buffer ID returned in a buffered response',
    },

    examples: [
      {
        title: 'Retrieve buffered search results',
        code: `retrieve_buffer({ bufferId: "search_12345" })`,
      },
      {
        title: 'Get full completions data',
        code: `retrieve_buffer({ bufferId: "completions_67890" })`,
      },
    ],

    workflow: {
      usedWith: ['Any tool that returns buffered responses'],
      followedBy: ['Continue with analysis using full data'],
      description: 'Used when a tool returns a buffered response due to size limits',
    },

    tips: [
      'Only needed when tools return buffered responses (large datasets)',
      'Buffer IDs are automatically generated and included in buffered responses',
      'Buffers expire after 60 seconds for memory management',
      'Check buffer_stats to see what buffers are available',
    ],

    meta: {
      isUtility: true,
      supportsTool: 'All tools that use buffering',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler({ bufferId }: any): Promise<any> {
  // Retrieve from central buffer manager
  const data = retrieveBuffer(bufferId)

  if (!data) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Buffer not found or expired',
          bufferId,
          hint: 'Buffers expire after 60 seconds. Use get_buffer_stats to see available buffers.',
        }, null, 2),
      }],
    }
  }

  console.error(`[retrieve_buffer] Retrieved buffer ${bufferId}`)

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2),
    }],
  }
}

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {
        bufferId: z.string().describe(metadata.docs.parameters?.bufferId || 'The buffer ID returned in a buffered response'),
      },
    },
    handler, // Use the exported handler
  )
}
