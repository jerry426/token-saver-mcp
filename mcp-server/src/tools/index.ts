/**
 * Tool Registry - Imports and registers all tools
 * This replaces the monolithic tools.ts file
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import * as clickElement from './cdp/click-element'
// Import all CDP tools
import * as executeInBrowser from './cdp/execute-in-browser'
import * as getBrowserConsole from './cdp/get-browser-console'
import * as getDomSnapshot from './cdp/get-dom-snapshot'
import * as navigateBrowser from './cdp/navigate-browser'
import * as takeScreenshot from './cdp/take-screenshot'
import * as typeInBrowser from './cdp/type-in-browser'
import * as waitForElement from './cdp/wait-for-element'
import * as checkPagePerformance from './helper/check-page-performance'
import * as debugJavascriptError from './helper/debug-javascript-error'
import * as testApiEndpoint from './helper/test-api-endpoint'
import * as testFormValidation from './helper/test-form-validation'
// Import all Helper tools
import * as testReactComponent from './helper/test-react-component'

import * as findImplementations from './lsp/find-implementations'
import * as getCallHierarchy from './lsp/get-call-hierarchy'
import * as getCodeActions from './lsp/get-code-actions'
// Import all LSP tools
import * as getCompletions from './lsp/get-completions'

import * as getDefinition from './lsp/get-definition'
import * as getDiagnostics from './lsp/get-diagnostics'
import * as getDocumentSymbols from './lsp/get-document-symbols'
import * as getHover from './lsp/get-hover'
import * as getReferences from './lsp/get-references'
import * as getSemanticTokens from './lsp/get-semantic-tokens'
import * as getTypeDefinition from './lsp/get-type-definition'
import * as renameSymbol from './lsp/rename-symbol'
import * as findSymbols from './lsp/find-symbols'
import * as findText from './lsp/find-text'
import * as getBufferStats from './system/get-buffer-stats'
import * as getInstructions from './system/get-instructions'
import * as getSupportedLanguages from './system/get-supported-languages'
// Import all System tools
import * as retrieveBuffer from './system/retrieve-buffer'
// For STDIO server, all logging must go to stderr to avoid corrupting the JSON-RPC protocol
const logger = { info: console.error, error: console.error, warn: console.error }

// Store tool handlers for direct access (needed for HTTP endpoint)
export const toolHandlers = new Map<string, (args: any) => Promise<any>>()

export interface ToolModule {
  metadata: {
    name: string
    title: string
    category: string
    description: string
    docs?: any
  }
  register: (server: McpServer) => void
}

// Collect all tool modules
const toolModules: ToolModule[] = [
  // LSP tools (14 - was 13, now split search into two)
  getCompletions,
  getDefinition,
  getTypeDefinition,
  getCodeActions,
  getDiagnostics,
  getSemanticTokens,
  getHover,
  getReferences,
  getDocumentSymbols,
  getCallHierarchy,
  findImplementations,
  renameSymbol,
  findSymbols,
  findText,

  // System tools (4)
  retrieveBuffer,
  getBufferStats,
  getSupportedLanguages,
  getInstructions,

  // CDP tools (8)
  executeInBrowser,
  getBrowserConsole,
  navigateBrowser,
  getDomSnapshot,
  clickElement,
  typeInBrowser,
  takeScreenshot,
  waitForElement,

  // Helper tools (5)
  testReactComponent,
  testApiEndpoint,
  testFormValidation,
  checkPagePerformance,
  debugJavascriptError,
]

// Populate tool handlers map for HTTP endpoint access
for (const module of toolModules) {
  if (module.metadata && (module as any).handler) {
    toolHandlers.set(module.metadata.name, (module as any).handler)
  }
}

/**
 * Registers all tools from the modular structure
 */
export async function registerAllTools(server: McpServer) {
  logger.info('[Token Saver MCP] Registering tools from modular structure...')

  const categories = new Map<string, number>()
  let registeredCount = 0
  let failedCount = 0

  for (const module of toolModules) {
    try {
      if (module.register && module.metadata) {
        // Register the tool
        module.register(server)

        // Track categories
        const category = module.metadata.category
        categories.set(category, (categories.get(category) || 0) + 1)

        registeredCount++
        logger.info(`  ✓ Registered: ${module.metadata.name} (${category})`)
      }
      else {
        logger.warn(`  ⚠ Skipping module: Missing register or metadata`)
        failedCount++
      }
    }
    catch (error) {
      logger.error(`  ✗ Failed to register ${module.metadata?.name || 'unknown'}:`, error)
      failedCount++
    }
  }

  // Summary
  logger.info('[Token Saver MCP] Registration complete:')
  logger.info(`  Total: ${registeredCount} tools registered successfully`)

  for (const [category, count] of categories) {
    logger.info(`  - ${category}: ${count} tools`)
  }

  if (failedCount > 0) {
    logger.warn(`  ⚠ Failed to register ${failedCount} tools`)
  }

  return {
    total: registeredCount,
    failed: failedCount,
    categories: Object.fromEntries(categories),
  }
}

/**
 * Get metadata for all registered tools (for documentation generation)
 */
export function getAllToolMetadata(): any[] {
  return toolModules
    .filter(module => module.metadata)
    .map(module => ({
      ...module.metadata,
      // Add any additional metadata
    }))
}

/**
 * Get a tool handler by name (for HTTP endpoint execution)
 */
export function getToolHandler(name: string): ((args: any) => Promise<any>) | null {
  return toolHandlers.get(name) || null
}
