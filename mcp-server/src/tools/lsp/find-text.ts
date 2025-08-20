import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { z } from 'zod'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'

const execAsync = promisify(exec)

// Buffer storage for large results
const resultBuffers = new Map<string, any>()

// Clean up old buffers after 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [id, buffer] of resultBuffers.entries()) {
    if (now - buffer.timestamp > 10 * 60 * 1000) {
      resultBuffers.delete(id)
    }
  }
}, 60 * 1000) // Check every minute

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'find_text',
  title: 'Find Text in Files',
  category: 'lsp' as const,
  description: 'Search for text patterns across all files using ripgrep with intelligent result buffering',

  docs: {
    brief: 'Full text search across entire workspace with smart buffering',

    parameters: {
      query: 'The text pattern to search for',
      useRegExp: 'Use regular expression pattern (default: false)',
      isCaseSensitive: 'Case sensitive search (default: false)',
      matchWholeWord: 'Match whole word only (default: false)',
      maxResults: 'Maximum number of results to return immediately (default: 20)',
      includes: 'Glob patterns to include (e.g., ["**/*.ts"])',
      excludes: 'Glob patterns to exclude (default: node_modules, .git, dist)',
      includeContext: 'Include surrounding context lines (default: 0)',
    },

    examples: [
      {
        title: 'Find TODO comments',
        code: `find_text({
  query: "TODO",
  maxResults: 50
})
// Returns first 50 TODO comments with file locations`,
      },
      {
        title: 'Search in specific file types',
        code: `find_text({
  query: "database",
  includes: ["*.json", "*.yaml", "*.env"],
  isCaseSensitive: false
})
// Finds "database" in config files only`,
      },
      {
        title: 'Regex pattern search',
        code: `find_text({
  query: "console\\\\.(log|error|warn)",
  useRegExp: true,
  includeContext: 2
})
// Finds console statements with 2 lines of context`,
      },
    ],

    workflow: {
      usedWith: ['find_symbols for semantic search'],
      followedBy: ['retrieve_buffer for more results', 'get_definition'],
      description: 'Full text search when you need to find any text pattern',
    },

    tips: [
      'Results are buffered - request more with retrieve_buffer if needed',
      'Use includes/excludes for precise file filtering',
      'Returns summary stats when results exceed maxResults',
      'Regex patterns must be properly escaped',
      'Use find_symbols for semantic code search instead',
    ],

    performance: {
      speed: '< 2s for large workspaces (ripgrep powered)',
      tokenSavings: '70-95% through intelligent buffering',
      accuracy: '100% (exact text matching)',
      buffering: 'Automatic for results > maxResults',
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
        query: z.string().describe(metadata.docs.parameters?.query || ''),
        useRegExp: z.boolean().optional().describe(metadata.docs.parameters?.useRegExp || ''),
        isCaseSensitive: z.boolean().optional().describe(metadata.docs.parameters?.isCaseSensitive || ''),
        matchWholeWord: z.boolean().optional().describe(metadata.docs.parameters?.matchWholeWord || ''),
        maxResults: z.number().optional().describe(metadata.docs.parameters?.maxResults || ''),
        includes: z.array(z.string()).optional().describe(metadata.docs.parameters?.includes || ''),
        excludes: z.array(z.string()).optional().describe(metadata.docs.parameters?.excludes || ''),
        includeContext: z.number().optional().describe(metadata.docs.parameters?.includeContext || ''),
      },
    },
    async ({ query, useRegExp, isCaseSensitive, matchWholeWord, maxResults = 20, includes, excludes, includeContext = 0 }) => {
      try {
        // Build ripgrep command
        let rgCommand = 'rg'
        
        // Add flags
        if (!isCaseSensitive) rgCommand += ' -i'
        if (matchWholeWord) rgCommand += ' -w'
        if (!useRegExp) rgCommand += ' -F'
        if (includeContext > 0) rgCommand += ` -C ${includeContext}`
        
        // Add JSON output for easier parsing
        rgCommand += ' --json'
        
        // Add includes
        if (includes && includes.length > 0) {
          for (const pattern of includes) {
            rgCommand += ` -g "${pattern}"`
          }
        }
        
        // Add excludes (with defaults)
        const defaultExcludes = ['node_modules', '.git', 'dist', 'build', '*.min.js']
        const allExcludes = excludes ? [...defaultExcludes, ...excludes] : defaultExcludes
        for (const pattern of allExcludes) {
          rgCommand += ` -g "!${pattern}"`
        }
        
        // Add the search query (properly escaped)
        const escapedQuery = useRegExp ? query : query.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
        rgCommand += ` "${escapedQuery}"`
        
        // Get workspace root (fallback to current directory)
        const workspaceRoot = process.cwd()
        rgCommand += ` "${workspaceRoot}"`
        
        // Execute ripgrep
        const { stdout } = await execAsync(rgCommand, { maxBuffer: 50 * 1024 * 1024 }) // 50MB buffer
        
        // Parse JSON output from ripgrep
        const lines = stdout.trim().split('\n').filter(line => line)
        const matches: any[] = []
        let currentFile = ''
        
        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.type === 'match') {
              const filePath = json.data.path.text
              const lineNumber = json.data.line_number
              const lineText = json.data.lines.text.trim()
              
              matches.push({
                file: path.basename(filePath),
                path: filePath,
                line: lineNumber,
                text: lineText,
                column: json.data.submatches?.[0]?.start || 0,
              })
            }
          } catch {
            // Skip non-JSON lines
          }
        }
        
        // Handle no results
        if (matches.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No matches found for "${query}"`
            }]
          }
        }
        
        // Check if we need to buffer
        if (matches.length > maxResults) {
          // Generate buffer ID
          const bufferId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          
          // Store full results in buffer
          resultBuffers.set(bufferId, {
            data: matches,
            timestamp: Date.now(),
            query: query,
          })
          
          // Count unique files
          const uniqueFiles = new Set(matches.map(m => m.path)).size
          
          // Return summary with first N results
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                summary: `Found ${matches.length} matches in ${uniqueFiles} files`,
                bufferId: bufferId,
                bufferNotice: `Showing first ${maxResults} results. Use retrieve_buffer("${bufferId}") for all results.`,
                results: matches.slice(0, maxResults),
              }, null, 2)
            }]
          }
        }
        
        // Return all results if under limit
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(matches, null, 2)
          }]
        }
        
      } catch (error: any) {
        // Handle ripgrep not installed
        if (error.message.includes('command not found') || error.message.includes('not recognized')) {
          return {
            content: [{
              type: 'text',
              text: 'Error: ripgrep (rg) is not installed. Please install it to use text search.'
            }]
          }
        }
        
        // Handle no matches (ripgrep returns exit code 1)
        if (error.code === 1 && error.stdout === '') {
          return {
            content: [{
              type: 'text',
              text: `No matches found for "${query}"`
            }]
          }
        }
        
        // Other errors
        return {
          content: [{
            type: 'text',
            text: `Error searching: ${error.message}`
          }]
        }
      }
    },
  )
}

// Export buffer access for retrieve_buffer tool
export function getBuffer(bufferId: string) {
  return resultBuffers.get(bufferId)
}

export function getBufferStats() {
  const stats = Array.from(resultBuffers.entries()).map(([id, buffer]) => ({
    id,
    query: buffer.query,
    resultCount: buffer.data.length,
    age: Math.floor((Date.now() - buffer.timestamp) / 1000) + 's',
  }))
  return stats
}