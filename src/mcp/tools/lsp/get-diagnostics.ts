import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { getDiagnostics } from '../../../lsp'
import { logger } from '../../../utils'
import { bufferResponse } from '../../buffer-manager'

/**
 * Tool metadata for documentation generation
 * This is parsed by generate-instructions.ts
 */
export const metadata: ToolMetadata = {
  name: 'get_diagnostics',
  title: 'Get Diagnostics',
  category: 'lsp' as const,
  description: 'Get diagnostics (errors, warnings, info, hints) for a file or all files.',

  // Documentation sections
  docs: {
    brief: 'Get all errors, warnings, and suggestions from language servers',

    parameters: {
      uri: 'Optional file URI. If not provided, gets diagnostics for all files in workspace',
    },

    examples: [
      {
        title: 'Get diagnostics for specific file',
        code: `get_diagnostics({
  uri: "file:///src/api/users.ts"
})
// Returns: TypeScript errors, ESLint warnings, etc. for that file`,
      },
      {
        title: 'Get all workspace diagnostics',
        code: `get_diagnostics({})
// Returns: All errors/warnings across entire project`,
      },
      {
        title: 'Check build status before deployment',
        code: `// First get all diagnostics
const diagnostics = get_diagnostics({})

// Then check for blocking errors
const errors = diagnostics.filter(d => d.severity === 1)
if (errors.length > 0) {
  // Handle errors before proceeding
}`,
      },
    ],

    workflow: {
      usedWith: ['get_code_actions', 'search_text'],
      followedBy: ['get_code_actions', 'get_definition'],
      description: 'First step in error fixing workflow - identify issues before applying fixes',
    },

    tips: [
      'Omit uri parameter to get workspace-wide diagnostics',
      'Severity levels: 1=Error, 2=Warning, 3=Information, 4=Hint',
      'Use with get_code_actions to see available auto-fixes',
      'Large workspaces auto-buffer results to save tokens',
    ],

    performance: {
      speed: '< 200ms for single file, < 1s for workspace',
      tokenSavings: '80-95% vs reading all error output manually',
      accuracy: '100% (real VSCode diagnostic system)',
      buffering: 'Auto-buffers when >50 diagnostics or >20KB data',
    },
  },
}

// Tool registration function
export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {
        uri: z.string().optional().describe(metadata.docs.parameters?.uri || 'Optional file URI to get diagnostics for. If not provided, gets diagnostics for all files.'),
      },
    },
    async ({ uri }) => {
      const result = await getDiagnostics(uri)

      // Apply buffering if needed (diagnostics for all files can be large)
      const bufferedResponse = bufferResponse('get_diagnostics', result)

      if (bufferedResponse.metadata) {
        logger.info(`Diagnostics returned buffered response: ${bufferedResponse.metadata.totalTokens} tokens`)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'buffered_response',
              ...bufferedResponse,
            }, null, 2),
          }],
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )
}
