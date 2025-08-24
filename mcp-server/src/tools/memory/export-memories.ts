import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { z } from 'zod'
import { memoryDb, MemoryScope } from '../../db/memory-db'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'export_memories',
  title: 'Export Memories',
  category: 'memory' as const,
  description: 'Export memories to a portable JSON file for backup, sharing, or migration.',

  docs: {
    brief: 'Export memories to JSON for backup or sharing',

    parameters: {
      output: 'Output path: "auto" for automatic, or specify full path',
      scope: 'Filter by scope: global, project, session, or shared (optional)',
      pattern: 'Filter by key pattern with wildcards (optional)',
      minImportance: 'Only export memories at or above this importance 1-5 (optional)',
      maxVerbosity: 'Only export memories at or below this verbosity 1-4 (optional)',
      daysAgo: 'Only export memories updated in last N days (optional)',
      since: 'ISO date string - only export memories updated after this date (optional)',
      until: 'ISO date string - only export memories updated before this date (optional)',
      pretty: 'Format JSON for human readability (default: true)',
      includeMetadata: 'Include timestamps and access counts (default: true)',
    },

    examples: [
      {
        title: 'Auto-export everything to cloud storage',
        code: `export_memories({
  output: "auto"  // Automatically finds Dropbox/iCloud/etc
})`,
      },
      {
        title: 'Export project memories for sharing',
        code: `export_memories({
  scope: "project",
  minImportance: 3,
  output: "~/Desktop/project-context.json"
})`,
      },
      {
        title: 'Backup recent critical memories',
        code: `export_memories({
  minImportance: 4,
  daysAgo: 7,
  output: "auto"
})`,
      },
    ],

    workflow: {
      usedWith: ['import_memories', 'list_memories'],
      followedBy: ['Share or backup the exported file'],
      description: 'Create portable backups of memory state',
    },

    tips: [
      'Use "auto" output to automatically save to cloud storage if available',
      'Export creates timestamped files to avoid overwrites',
      'JSON format preserves all metadata for perfect restoration',
      'Filter exports to share only relevant context',
    ],

    meta: {
      isUtility: true,
    },
  },
}

/**
 * Get smart default export path
 */
function getDefaultExportPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.'

  // Check for cloud storage folders in order of preference
  const cloudPaths = [
    `${home}/Dropbox/token-saver-backups`,
    `${home}/Library/CloudStorage/Dropbox/token-saver-backups`,
    `${home}/Documents/Dropbox/token-saver-backups`,
    `${home}/iCloud Drive/token-saver-backups`,
    `${home}/Google Drive/token-saver-backups`,
    `${home}/OneDrive/token-saver-backups`,
  ]

  for (const cloudPath of cloudPaths) {
    const parentDir = path.dirname(cloudPath)
    if (fs.existsSync(parentDir)) {
      // Parent exists (e.g., Dropbox exists)
      if (!fs.existsSync(cloudPath)) {
        try {
          fs.mkdirSync(cloudPath, { recursive: true })
        }
        catch {
          continue // Try next option if can't create
        }
      }
      return cloudPath
    }
  }

  // Fallback to local exports folder
  const localPath = path.join(home, '.token-saver-mcp', 'exports')
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true })
  }
  return localPath
}

/**
 * Generate timestamped filename
 */
function generateFilename(): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/:/g, '-')
    .replace(/\./g, '-')
    .substring(0, 19)
  return `memories-${timestamp}.json`
}

// Tool handler
export async function handler(params: {
  output?: string
  scope?: 'global' | 'project' | 'session' | 'shared'
  pattern?: string
  minImportance?: number
  maxVerbosity?: number
  daysAgo?: number
  since?: string
  until?: string
  pretty?: boolean
  includeMetadata?: boolean
} = {}): Promise<any> {
  try {
    const projectPath = process.cwd()

    // Determine output path
    let outputPath: string
    if (!params.output || params.output === 'auto') {
      const exportDir = getDefaultExportPath()
      outputPath = path.join(exportDir, generateFilename())
    }
    else {
      // Expand ~ to home directory
      outputPath = params.output.replace(/^~/, process.env.HOME || '')

      // If it's a directory, add filename
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
        outputPath = path.join(outputPath, generateFilename())
      }
    }

    // Convert scope if provided
    const scope = params.scope
      ? MemoryScope[params.scope.toUpperCase() as keyof typeof MemoryScope]
      : undefined

    // Fetch memories with filters
    const memories = memoryDb.readFiltered({
      pattern: params.pattern,
      scope,
      project_path: (!scope || scope === MemoryScope.PROJECT) ? projectPath : undefined,
      minImportance: params.minImportance,
      minVerbosity: params.maxVerbosity,
      daysAgo: params.daysAgo,
      since: params.since,
      until: params.until,
    })

    // Build export structure
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: {
        project_path: projectPath,
        total_memories: memoryDb.getStats().total_memories,
        exported_count: memories.length,
      },
      memories: memories.map((memory) => {
        const baseMemory: any = {
          key: memory.key,
          value: JSON.parse(memory.value),
          scope: memory.scope,
          importance: memory.importance,
          verbosity: memory.verbosity,
        }

        // Include metadata if requested (default: true)
        if (params.includeMetadata !== false) {
          baseMemory.created_at = memory.created_at
          baseMemory.updated_at = memory.updated_at
          baseMemory.accessed_at = memory.accessed_at
          baseMemory.access_count = memory.access_count
          if (memory.tags) {
            baseMemory.tags = JSON.parse(memory.tags)
          }
          if (memory.ttl) {
            baseMemory.ttl = memory.ttl
          }
          if (memory.created_by) {
            baseMemory.created_by = memory.created_by
          }
        }

        return baseMemory
      }),
    }

    // Write to file
    const jsonContent = params.pretty !== false
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData)

    fs.writeFileSync(outputPath, jsonContent, 'utf-8')

    // Get file size
    const stats = fs.statSync(outputPath)
    const sizeKB = (stats.size / 1024).toFixed(1)

    // Detect if we saved to cloud storage
    const savedToCloud = outputPath.includes('Dropbox')
      || outputPath.includes('iCloud')
      || outputPath.includes('Google Drive')
      || outputPath.includes('OneDrive')

    return {
      content: [{
        type: 'text',
        text: `✅ **Memories Exported Successfully**

📁 **File**: ${outputPath}
📊 **Stats**: ${memories.length} memories exported (${sizeKB} KB)
☁️ **Cloud**: ${savedToCloud ? 'Yes - automatically backed up!' : 'No - local storage only'}

${savedToCloud ? '💡 Your memories are now safely backed up to cloud storage!' : '💡 Consider moving to Dropbox/iCloud for automatic backup'}`,
      }],
    }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error exporting memories: ${error.message}`,
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
        output: z.string().optional().describe('Output path: "auto" or full path'),
        scope: z.enum(['global', 'project', 'session', 'shared']).optional().describe('Filter by scope'),
        pattern: z.string().optional().describe('Filter by key pattern'),
        minImportance: z.number().min(1).max(5).optional().describe('Minimum importance level'),
        maxVerbosity: z.number().min(1).max(4).optional().describe('Maximum verbosity level'),
        daysAgo: z.number().optional().describe('Export memories from last N days'),
        since: z.string().optional().describe('Export memories after this date'),
        until: z.string().optional().describe('Export memories before this date'),
        pretty: z.boolean().optional().describe('Format JSON for readability'),
        includeMetadata: z.boolean().optional().describe('Include timestamps and metadata'),
      },
    },
    handler,
  )
}
