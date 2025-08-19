#!/usr/bin/env tsx
/**
 * Counts tools in the new modular structure
 */

import { glob } from 'glob'

async function countTools() {
  const categories = {
    lsp: 0,
    cdp: 0,
    helper: 0,
    system: 0,
  }

  // Count tools in each directory
  const lspFiles = glob.sync('src/mcp/tools/lsp/*.ts')
  const cdpFiles = glob.sync('src/mcp/tools/cdp/*.ts')
  const helperFiles = glob.sync('src/mcp/tools/helper/*.ts')
  const systemFiles = glob.sync('src/mcp/tools/system/*.ts')

  categories.lsp = lspFiles.length
  categories.cdp = cdpFiles.length
  categories.helper = helperFiles.length
  categories.system = systemFiles.length

  const total = categories.lsp + categories.cdp + categories.helper + categories.system

  console.log('📊 Tool Count Summary:')
  console.log(`  - LSP: ${categories.lsp} tools`)
  console.log(`  - CDP: ${categories.cdp} tools`)
  console.log(`  - Helper: ${categories.helper} tools`)
  console.log(`  - System: ${categories.system} tools`)
  console.log(`  Total: ${total} tools`)

  return { categories, total }
}

countTools().catch(console.error)
