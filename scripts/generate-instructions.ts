#!/usr/bin/env tsx
/**
 * Template-based documentation generator
 * Maintains static content in template, only generates dynamic tool sections
 */

import * as fs from 'node:fs/promises'
import { glob } from 'glob'

interface ParsedMetadata {
  name: string
  title: string
  category: string
  description: string
  docs: any
}

/**
 * Parse tool metadata from file (simplified version)
 */
async function parseToolFile(filePath: string): Promise<ParsedMetadata | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const metadataMatch = content.match(/export\s+const\s+metadata(?::\s*ToolMetadata)?\s*=\s*({[\s\S]*?^})\s*$/m)

    if (!metadataMatch)
      return null

    // Use Function constructor for simple parsing
    // eslint-disable-next-line no-new-func
    const parseFunc = new Function(`return ${metadataMatch[1].replace(/as\s+const/g, '')}`)
    return parseFunc() as ParsedMetadata
  }
  catch (error) {
    console.error(`Error parsing ${filePath}:`, error)
    return null
  }
}

/**
 * Generate tool documentation section
 */
function generateToolDocs(tool: ParsedMetadata): string {
  const sections: string[] = []

  sections.push(`#### \`${tool.name}\``)

  if (tool.docs?.brief) {
    sections.push(`**${tool.docs.brief}**\n`)
  }

  sections.push(tool.description)

  // Add example
  if (tool.docs?.examples?.[0]) {
    sections.push('\n**Example:**')
    sections.push('```javascript')
    sections.push(tool.docs.examples[0].code)
    sections.push('```')
  }

  // Add tips
  if (tool.docs?.tips?.length > 0) {
    sections.push('\n**Tips:**')
    tool.docs.tips.forEach((tip: string) => {
      sections.push(`- ${tip}`)
    })
  }

  // Add performance info
  if (tool.docs?.performance) {
    const perf = tool.docs.performance
    if (perf.speed || perf.tokenSavings) {
      sections.push('\n**Performance:**')
      if (perf.speed)
        sections.push(`- Speed: ${perf.speed}`)
      if (perf.tokenSavings)
        sections.push(`- Token Savings: ${perf.tokenSavings}`)
    }
  }

  // For helper tools
  if (tool.docs?.testsAutomatically) {
    sections.push('\n**Tests Automatically:**')
    tool.docs.testsAutomatically.forEach((item: string) => {
      sections.push(`- ${item}`)
    })
  }

  if (tool.docs?.savesTimeVsManual) {
    sections.push('\n**Saves Time By:**')
    tool.docs.savesTimeVsManual.forEach((item: string) => {
      sections.push(`- ${item}`)
    })
  }

  // Add a prominent separator after each tool
  sections.push('\n---\n')
  return sections.join('\n')
}

/**
 * Generate category section
 */
function generateCategorySection(category: string, tools: ParsedMetadata[]): string {
  const sections: string[] = []

  const categoryNames: Record<string, string> = {
    lsp: 'Code Navigation (LSP)',
    cdp: 'Browser Control (CDP)',
    helper: 'Browser Testing Helpers',
    system: 'System Tools',
  }

  const categoryDescriptions: Record<string, string> = {
    lsp: 'Tools for navigating and understanding code using Language Server Protocol:',
    cdp: 'Tools for browser automation using Chrome DevTools Protocol:',
    helper: 'High-level testing utilities that combine multiple operations:',
    system: '',
  }

  sections.push(`### ${categoryNames[category]} - ${tools.length} Tools`)

  if (categoryDescriptions[category]) {
    sections.push(`\n${categoryDescriptions[category]}`)
  }

  // Add separator before first tool
  sections.push('\n---\n')

  tools.forEach((tool) => {
    const toolDoc = generateToolDocs(tool)
    sections.push(toolDoc)
  })

  return sections.join('\n')
}

/**
 * Generate decision tree based on available tools
 */
function generateDecisionTree(tools: ParsedMetadata[]): string {
  const hasLsp = tools.some(t => t.category === 'lsp')
  const hasCdp = tools.some(t => t.category === 'cdp')
  const hasHelper = tools.some(t => t.category === 'helper')

  const lines: string[] = []

  if (hasLsp) {
    lines.push('Finding code?           → search_text → get_definition → get_references')
    lines.push('Understanding code?     → get_hover → get_document_symbols')
    lines.push('Refactoring?           → rename_symbol (after get_references)')
    lines.push('Finding errors?        → get_diagnostics')
  }

  if (hasHelper) {
    lines.push('Testing UI?            → test_react_component, test_form_validation')
    lines.push('Testing API?           → test_api_endpoint')
    lines.push('Debugging browser?     → debug_javascript_error → get_browser_console')
  }

  if (hasCdp) {
    lines.push('Need interaction?      → click_element, type_in_browser')
    lines.push('Performance issues?    → check_page_performance')
  }

  return lines.join('\n')
}

/**
 * Process template with replacements
 */
async function processTemplate(templatePath: string, replacements: Record<string, string>): Promise<string> {
  let content = await fs.readFile(templatePath, 'utf-8')

  // Replace all placeholders
  for (const [placeholder, value] of Object.entries(replacements)) {
    const regex = new RegExp(`{{${placeholder}}}`, 'g')
    content = content.replace(regex, value)
  }

  return content
}

/**
 * Main function
 */
async function main() {
  console.log('📄 Template-Based Documentation Generator')
  console.log('🎯 Preserving static content, generating dynamic sections\n')

  try {
    // Load package.json for version
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
    const version = packageJson.version

    // Find and parse all tool files
    const toolFiles = await glob('mcp-server/src/tools/**/*.ts', {
      ignore: ['**/*.test.ts', '**/index.ts', '**/types.ts', '**/tool-manager.ts', '**/lsp-implementations.ts'],
    })

    const tools: ParsedMetadata[] = []
    for (const file of toolFiles) {
      const metadata = await parseToolFile(file)
      if (metadata) {
        tools.push(metadata)
        console.log(`  ✓ Parsed: ${metadata.name} (${metadata.category})`)
      }
    }

    // Categorize tools
    const toolsByCategory: Record<string, ParsedMetadata[]> = {}
    tools.forEach((tool) => {
      if (!toolsByCategory[tool.category]) {
        toolsByCategory[tool.category] = []
      }
      toolsByCategory[tool.category].push(tool)
    })

    // Generate category summaries
    const categorySummary: string[] = []
    const categoryOrder = ['lsp', 'cdp', 'helper', 'system']

    categoryOrder.forEach((cat) => {
      if (toolsByCategory[cat]) {
        const count = toolsByCategory[cat].length
        const name = {
          lsp: 'LSP tools',
          cdp: 'CDP tools',
          helper: 'Helper tools',
          system: 'System tools',
        }[cat]
        const desc = {
          lsp: 'Code navigation and intelligence',
          cdp: 'Browser automation and control',
          helper: 'High-level testing utilities',
          system: 'Utilities and meta functions',
        }[cat]
        categorySummary.push(`- **${count} ${name}** - ${desc}`)
      }
    })

    // Generate tool sections
    const toolSections: string[] = []
    categoryOrder.forEach((cat) => {
      if (toolsByCategory[cat]) {
        toolSections.push(generateCategorySection(cat, toolsByCategory[cat]))
      }
    })

    // Prepare replacements
    const replacements: Record<string, string> = {
      GENERATION_DATE: new Date().toISOString(),
      VERSION: version,
      TOTAL_TOOLS: tools.length.toString(),
      TOOL_CATEGORIES_SUMMARY: categorySummary.join('\n'),
      TOOL_SECTIONS: toolSections.join('\n\n'),
      DECISION_TREE: generateDecisionTree(tools),
      CATEGORY_COUNT: Object.keys(toolsByCategory).length.toString(),
    }

    // Process template
    const output = await processTemplate('README_USAGE_GUIDE.template.md', replacements)

    // Write output
    await fs.writeFile('README_USAGE_GUIDE.md', output)

    console.log(`\n✅ Generated documentation from template`)
    console.log(`📈 Processed ${tools.length} tools in ${Object.keys(toolsByCategory).length} categories`)
    console.log(`📝 Static content preserved, dynamic sections updated`)
    console.log('\n💡 Benefits of template approach:')
    console.log('   - Developers maintain human-written content')
    console.log('   - Tool documentation stays auto-generated')
    console.log('   - Best of both worlds: quality + accuracy')
  }
  catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { generateToolDocs, processTemplate }
