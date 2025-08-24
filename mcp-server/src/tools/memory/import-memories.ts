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
  name: 'import_memories',
  title: 'Import Memories',
  category: 'memory' as const,
  description: 'Import memories from a JSON backup file with smart conflict resolution.',

  docs: {
    brief: 'Restore memories from JSON backup',

    parameters: {
      file: 'Path to JSON file to import',
      mode: 'Import mode: merge (update existing), replace (overwrite all), or skip (only new)',
      onConflict: 'Conflict resolution: newer, older, higher_importance, or skip',
      scope: 'Override scope for all imported memories (optional)',
      minImportance: 'Only import memories at or above this importance (optional)',
      keyPrefix: 'Prefix to add to all imported keys (optional)',
      dryRun: 'Preview changes without importing (default: false)',
      backup: 'Create backup before importing (default: true)',
    },

    examples: [
      {
        title: 'Import from backup with smart merge',
        code: `import_memories({
  file: "~/Dropbox/token-saver-backups/memories-2025-01-24.json",
  mode: "merge",
  onConflict: "newer"
})`,
      },
      {
        title: 'Preview import without changes',
        code: `import_memories({
  file: "~/exports/shared-context.json",
  dryRun: true
})`,
      },
      {
        title: 'Import with namespace prefix',
        code: `import_memories({
  file: "~/colleague-memories.json",
  keyPrefix: "imported.",
  mode: "skip"  // Only add new keys
})`,
      },
    ],

    workflow: {
      usedWith: ['export_memories', 'list_memories'],
      followedBy: ['Verify imported memories with list_memories'],
      description: 'Restore memory state from backups',
    },

    tips: [
      'Always preview with dryRun: true first',
      'Automatic backup created before import by default',
      'Use keyPrefix to namespace imported memories',
      'Conflict resolution compares timestamps and importance',
    ],

    meta: {
      isUtility: true,
    },
  },
}

/**
 * Compare memories for conflict resolution
 */
function shouldReplaceMemory(
  existing: any,
  incoming: any,
  strategy: string,
): boolean {
  switch (strategy) {
    case 'newer':
      return new Date(incoming.updated_at || incoming.created_at)
        > new Date(existing.updated_at || existing.created_at)

    case 'older':
      return new Date(incoming.updated_at || incoming.created_at)
        < new Date(existing.updated_at || existing.created_at)

    case 'higher_importance':
      return (incoming.importance || 3) > (existing.importance || 3)

    case 'skip':
    default:
      return false
  }
}

// Tool handler
export async function handler(params: {
  file: string
  mode?: 'merge' | 'replace' | 'skip'
  onConflict?: 'newer' | 'older' | 'higher_importance' | 'skip'
  scope?: 'global' | 'project' | 'session' | 'shared'
  minImportance?: number
  keyPrefix?: string
  dryRun?: boolean
  backup?: boolean
} = { file: '' }): Promise<any> {
  try {
    if (!params.file) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: file parameter is required',
        }],
      }
    }

    // Expand ~ to home directory
    const filePath = params.file.replace(/^~/, process.env.HOME || '')

    // Check file exists
    if (!fs.existsSync(filePath)) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error: File not found: ${filePath}`,
        }],
      }
    }

    // Read and parse JSON file
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    let importData: any
    try {
      importData = JSON.parse(fileContent)
    }
    catch (e) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: Invalid JSON file format',
        }],
      }
    }

    // Validate structure
    if (!importData.memories || !Array.isArray(importData.memories)) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: Invalid export file structure (missing memories array)',
        }],
      }
    }

    const projectPath = process.cwd()
    const mode = params.mode || 'merge'
    const onConflict = params.onConflict || 'newer'
    const isDryRun = params.dryRun === true
    const shouldBackup = params.backup !== false

    // Create backup if not dry run and backup requested
    if (!isDryRun && shouldBackup) {
      // Use export tool to create backup
      const exportModule = await import('./export-memories')
      await exportModule.handler({ output: 'auto' })
    }

    // Convert scope if provided
    const overrideScope = params.scope
      ? MemoryScope[params.scope.toUpperCase() as keyof typeof MemoryScope]
      : undefined

    // Track import statistics
    const stats = {
      total: importData.memories.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    }

    const changes: string[] = []

    // Process each memory
    for (const memory of importData.memories) {
      // Filter by importance if specified
      if (params.minImportance && (memory.importance || 3) < params.minImportance) {
        stats.skipped++
        continue
      }

      // Apply key prefix if specified
      const key = params.keyPrefix ? `${params.keyPrefix}${memory.key}` : memory.key

      // Determine scope
      const scope = overrideScope
        || (memory.scope ? MemoryScope[memory.scope.toUpperCase() as keyof typeof MemoryScope] : MemoryScope.PROJECT)

      // Check if memory exists
      const existing = memoryDb.read({
        key,
        scope,
        project_path: scope === MemoryScope.PROJECT ? projectPath : undefined,
      })

      let shouldImport = false
      let action = ''

      if (!existing) {
        // New memory
        if (mode !== 'replace' || mode === 'replace') {
          shouldImport = true
          action = '➕ NEW'
          stats.imported++
        }
        else {
          stats.skipped++
        }
      }
      else if (mode === 'skip') {
        // Skip existing
        stats.skipped++
      }
      else if (mode === 'replace') {
        // Always replace
        shouldImport = true
        action = '🔄 REPLACE'
        stats.updated++
      }
      else if (mode === 'merge') {
        // Check conflict resolution
        if (shouldReplaceMemory(existing, memory, onConflict)) {
          shouldImport = true
          action = `🔄 UPDATE (${onConflict})`
          stats.updated++
        }
        else {
          stats.skipped++
        }
      }

      if (shouldImport) {
        changes.push(`${action}: ${key}`)

        if (!isDryRun) {
          try {
            memoryDb.write({
              key,
              value: memory.value,
              scope,
              project_path: scope === MemoryScope.PROJECT ? projectPath : undefined,
              importance: memory.importance,
              verbosity: memory.verbosity,
              ttl: memory.ttl,
              tags: memory.tags,
              created_by: memory.created_by || 'import',
            })
          }
          catch (e: any) {
            stats.errors++
            changes.push(`❌ ERROR: ${key} - ${e.message}`)
          }
        }
      }
    }

    // Build result message
    let result = isDryRun
      ? '🔍 **Import Preview (Dry Run)**\n\n'
      : '✅ **Memories Imported Successfully**\n\n'

    result += `📊 **Statistics**:\n`
    result += `• Total in file: ${stats.total}\n`
    result += `• New imports: ${stats.imported}\n`
    result += `• Updates: ${stats.updated}\n`
    result += `• Skipped: ${stats.skipped}\n`
    if (stats.errors > 0) {
      result += `• Errors: ${stats.errors}\n`
    }

    if (importData.source) {
      result += `\n📁 **Source**:\n`
      result += `• File: ${path.basename(filePath)}\n`
      result += `• Exported: ${importData.exported_at}\n`
      result += `• From: ${importData.source.project_path}\n`
    }

    if (changes.length > 0 && changes.length <= 20) {
      result += `\n📝 **Changes**:\n`
      changes.forEach((change) => {
        result += `${change}\n`
      })
    }
    else if (changes.length > 20) {
      result += `\n📝 **Changes**: ${changes.length} items (too many to list)\n`
    }

    if (isDryRun) {
      result += `\n💡 Remove dryRun: true to actually import these memories`
    }

    return {
      content: [{
        type: 'text',
        text: result,
      }],
    }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error importing memories: ${error.message}`,
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
        file: z.string().describe('Path to JSON file to import'),
        mode: z.enum(['merge', 'replace', 'skip']).optional().describe('Import mode'),
        onConflict: z.enum(['newer', 'older', 'higher_importance', 'skip']).optional().describe('Conflict resolution'),
        scope: z.enum(['global', 'project', 'session', 'shared']).optional().describe('Override scope'),
        minImportance: z.number().min(1).max(5).optional().describe('Minimum importance filter'),
        keyPrefix: z.string().optional().describe('Prefix for imported keys'),
        dryRun: z.boolean().optional().describe('Preview without importing'),
        backup: z.boolean().optional().describe('Create backup before import'),
      },
    },
    handler,
  )
}
