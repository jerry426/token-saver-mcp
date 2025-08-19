#!/usr/bin/env tsx
/**
 * Add ToolMetadata type import to all tool files
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { glob } from 'glob'

async function addTypeToToolFile(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')

    // Skip if already has the type import
    if (content.includes('import type { ToolMetadata }')) {
      console.log(`  ✓ Already typed: ${path.basename(filePath)}`)
      return false
    }

    // Skip index.ts and types.ts
    if (filePath.endsWith('index.ts') || filePath.endsWith('types.ts')) {
      console.log(`  - Skipping: ${path.basename(filePath)}`)
      return false
    }

    // Find the first import line
    const lines = content.split('\n')
    let insertIndex = -1

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import')) {
        // Insert after the first import
        insertIndex = i + 1
        break
      }
    }

    if (insertIndex === -1) {
      console.log(`  ⚠ No imports found in ${path.basename(filePath)}`)
      return false
    }

    // Add the type import
    lines.splice(insertIndex, 0, 'import type { ToolMetadata } from \'../types\'')

    // Find the metadata export and add type
    const updatedContent = lines.join('\n').replace(
      /export const metadata = \{/,
      'export const metadata: ToolMetadata = {',
    )

    await fs.writeFile(filePath, updatedContent)
    console.log(`  ✅ Added type to: ${path.basename(filePath)}`)
    return true
  }
  catch (error) {
    console.error(`  ✗ Error processing ${filePath}:`, error)
    return false
  }
}

async function main() {
  console.log('🔧 Adding ToolMetadata type to all tool files...\n')

  const toolFiles = await glob('src/mcp/tools/**/*.ts', {
    ignore: ['**/*.test.ts', '**/index.ts', '**/types.ts'],
  })

  console.log(`Found ${toolFiles.length} tool files\n`)

  let updated = 0
  let skipped = 0

  for (const file of toolFiles) {
    const wasUpdated = await addTypeToToolFile(file)
    if (wasUpdated)
      updated++
    else skipped++
  }

  console.log(`\n✅ Complete!`)
  console.log(`  - Updated: ${updated} files`)
  console.log(`  - Skipped: ${skipped} files`)
  console.log('\n💡 Now run "pnpm run build" to check for type errors')
}

main().catch(console.error)
