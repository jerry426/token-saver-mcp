#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Find all tool files
const toolDirs = [
  'src/tools/lsp',
  'src/tools/cdp',
  'src/tools/helper',
  'src/tools/system'
]

let updated = 0
let skipped = 0

for (const dir of toolDirs) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'))
  
  for (const file of files) {
    const filePath = path.join(dir, file)
    let content = fs.readFileSync(filePath, 'utf-8')
    
    // Skip if already has handler export
    if (content.includes('export async function handler')) {
      console.log(`✓ Already updated: ${filePath}`)
      skipped++
      continue
    }
    
    // Find the registration function and extract the handler
    const registerMatch = content.match(/export function register\(server: McpServer\) \{[\s\S]*?server\.registerTool\([\s\S]*?,[\s\S]*?,[\s\S]*?(async \([^)]*\)[^{]*\{[\s\S]*?\n\s*\}\s*),?\s*\)\s*\}/m)
    
    if (!registerMatch) {
      console.log(`⚠ No register function found: ${filePath}`)
      continue
    }
    
    const handlerCode = registerMatch[1]
    
    // Extract the handler and create a named export
    const handlerExport = `// Tool handler - single source of truth for execution
export async function handler(args: any): Promise<any> {
  const handlerImpl = ${handlerCode}
  return handlerImpl(args)
}

`
    
    // Insert handler before register function
    content = content.replace(
      /\/\/ Tool registration function\nexport function register/,
      handlerExport + '// Tool registration function\nexport function register'
    )
    
    // Update register function to use the handler
    content = content.replace(
      registerMatch[0],
      registerMatch[0].replace(handlerCode, 'handler')
    )
    
    // Remove any default export
    content = content.replace(/\n\/\/ Default export[\s\S]*?export default[\s\S]*?\n}\n?/, '')
    
    fs.writeFileSync(filePath, content)
    console.log(`✅ Updated: ${filePath}`)
    updated++
  }
}

console.log(`\nSummary: ${updated} files updated, ${skipped} files skipped`)