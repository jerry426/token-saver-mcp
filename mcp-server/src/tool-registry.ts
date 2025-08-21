/**
 * Complete tool registry with all 30 Token Saver tools
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { vscode } from './vscode-adapter'
import { getGatewayClient } from './vscode-gateway-client'

// Browser control placeholder (will be implemented later)
// const _browserConnection: any = null

// ============= LSP TOOLS (13) =============

const lspTools = [
  {
    name: 'get_definition',
    description: 'Get the definition location of a symbol.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        args.uri,
        { line: args.line, character: args.character },
      )
    },
  },
  {
    name: 'get_references',
    description: 'Find all references to a symbol.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeReferenceProvider',
        args.uri,
        { line: args.line, character: args.character },
        { includeDeclaration: true },
      )
    },
  },
  {
    name: 'get_hover',
    description: 'Get hover information for a symbol at a given position.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        args.uri,
        { line: args.line, character: args.character },
      )
    },
  },
  {
    name: 'get_completions',
    description: 'Get code completion suggestions for a given position in a document.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeCompletionItemProvider',
        args.uri,
        { line: args.line, character: args.character },
      )
    },
  },
  {
    name: 'get_type_definition',
    description: 'Get the type definition location of a symbol.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeTypeDefinitionProvider',
        args.uri,
        { line: args.line, character: args.character },
      )
    },
  },
  {
    name: 'find_implementations',
    description: 'Find all implementations of an interface or abstract class.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeImplementationProvider',
        args.uri,
        { line: args.line, character: args.character },
      )
    },
  },
  {
    name: 'get_document_symbols',
    description: 'Get all symbols (classes, methods, functions, variables, etc.) in a document with hierarchical structure.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeDocumentSymbolProvider',
        args.uri,
      )
    },
  },
  {
    name: 'get_call_hierarchy',
    description: 'Trace function calls - find who calls a function (incoming) or what a function calls (outgoing).',
    handler: async (args: any) => {
      // First prepare the call hierarchy
      const items = await vscode.commands.executeCommand(
        'vscode.prepareCallHierarchy',
        args.uri,
        { line: args.line, character: args.character },
      )

      if (!items || (items as any[]).length === 0) {
        return []
      }

      // Then get incoming or outgoing calls
      const direction = args.direction || 'incoming'
      const command = direction === 'incoming'
        ? 'vscode.provideIncomingCalls'
        : 'vscode.provideOutgoingCalls'

      return vscode.commands.executeCommand(command, (items as any[])[0])
    },
  },
  {
    name: 'rename_symbol',
    description: 'Rename a symbol across the workspace.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeDocumentRenameProvider',
        args.uri,
        { line: args.line, character: args.character },
        args.newName,
      )
    },
  },
  {
    name: 'get_code_actions',
    description: 'Get available code actions (quick fixes, refactorings) at a given position.',
    handler: async (args: any) => {
      const range = {
        start: { line: args.line, character: args.character },
        end: { line: args.line, character: args.character },
      }
      return vscode.commands.executeCommand(
        'vscode.executeCodeActionProvider',
        args.uri,
        range,
      )
    },
  },
  {
    name: 'get_diagnostics',
    description: 'Get diagnostics (errors, warnings, info, hints) for a file or all files.',
    handler: async (args: any) => {
      return vscode.languages.getDiagnostics(args.uri)
    },
  },
  {
    name: 'get_semantic_tokens',
    description: 'Get semantic tokens (detailed syntax highlighting) for a document.',
    handler: async (args: any) => {
      return vscode.commands.executeCommand(
        'vscode.executeDocumentSemanticTokensProvider',
        args.uri,
      )
    },
  },
  {
    name: 'search_text',
    description: 'Search for text across all files in the workspace. Returns file locations and positions that can be used with other tools like get_definition or get_references.',
    handler: async (args: any) => {
      // Use workspace symbol provider for basic search
      if (!args.useRegExp && !args.matchWholeWord) {
        return vscode.commands.executeCommand(
          'vscode.executeWorkspaceSymbolProvider',
          args.query,
        )
      }

      // For advanced search, use findFiles and grep-like functionality
      const _includes = args.includes || ['**/*']
      const _excludes = args.excludes || ['**/node_modules/**', '**/.git/**']

      // This is a simplified implementation
      // In production, would use ripgrep or similar
      return {
        message: 'Advanced text search requires ripgrep integration',
        basicResults: await vscode.commands.executeCommand(
          'vscode.executeWorkspaceSymbolProvider',
          args.query,
        ),
      }
    },
  },
]

// ============= CDP BROWSER TOOLS (8) =============

const cdpTools = [
  {
    name: 'execute_in_browser',
    description: 'Execute JavaScript code in the browser context via Chrome DevTools Protocol. Requires Chrome to be running or will launch it automatically.',
    handler: async (args: any) => {
      // Placeholder - would integrate with CDP
      return {
        error: 'CDP browser tools require additional setup. Please install puppeteer or playwright.',
        hint: 'Run: npm install puppeteer',
      }
    },
  },
  {
    name: 'get_browser_console',
    description: 'Get console messages from the browser (log, error, warning, info, debug). Captures all console output since connection.',
    handler: async (args: any) => {
      return {
        error: 'CDP browser tools require additional setup',
        messages: [],
      }
    },
  },
  {
    name: 'navigate_browser',
    description: 'Navigate the browser to a specific URL and wait for page load.',
    handler: async (args: any) => {
      return {
        error: 'CDP browser tools require additional setup',
        url: args.url,
      }
    },
  },
  {
    name: 'get_dom_snapshot',
    description: 'Get a snapshot of the current DOM including forms, links, and images.',
    handler: async (args: any) => {
      return {
        error: 'CDP browser tools require additional setup',
        dom: null,
      }
    },
  },
  {
    name: 'click_element',
    description: 'Click an element in the browser using a CSS selector.',
    handler: async (args: any) => {
      return {
        error: 'CDP browser tools require additional setup',
        selector: args.selector,
      }
    },
  },
  {
    name: 'type_in_browser',
    description: 'Type text into an input field in the browser using a CSS selector.',
    handler: async (args: any) => {
      return {
        error: 'CDP browser tools require additional setup',
        selector: args.selector,
        text: args.text,
      }
    },
  },
  {
    name: 'take_screenshot',
    description: 'Take a screenshot of the current browser page.',
    handler: async (args: any) => {
      return {
        error: 'CDP browser tools require additional setup',
        screenshot: null,
      }
    },
  },
  {
    name: 'wait_for_element',
    description: 'Wait for an element to appear in the DOM.',
    handler: async (args: any) => {
      return {
        error: 'CDP browser tools require additional setup',
        selector: args.selector,
        timeout: args.timeout || 5000,
      }
    },
  },
]

// ============= HELPER/TESTING TOOLS (5) =============

const helperTools = [
  {
    name: 'test_react_component',
    description: 'Test if a React component is properly rendered with correct props and state',
    handler: async (args: any) => {
      // Would use execute_in_browser internally
      return {
        component: args.componentName,
        url: args.url,
        message: 'React testing requires browser automation setup',
      }
    },
  },
  {
    name: 'test_api_endpoint',
    description: 'Test an API endpoint from the browser context, checking response and CORS',
    handler: async (args: any) => {
      // Simple fetch test
      try {
        const url = new URL(args.endpoint, args.url).toString()
        const response = await fetch(url, {
          method: args.method || 'GET',
          headers: args.headers || {},
          body: args.body ? JSON.stringify(args.body) : undefined,
        })

        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: await response.text(),
        }
      }
      catch (error: any) {
        return {
          error: error.message,
          endpoint: args.endpoint,
        }
      }
    },
  },
  {
    name: 'test_form_validation',
    description: 'Test form validation by filling fields and attempting submission',
    handler: async (args: any) => {
      return {
        form: args.formSelector,
        fields: args.fields,
        message: 'Form testing requires browser automation setup',
      }
    },
  },
  {
    name: 'check_page_performance',
    description: 'Analyze page load performance and get optimization recommendations',
    handler: async (args: any) => {
      return {
        url: args.url,
        message: 'Performance testing requires browser automation setup',
      }
    },
  },
  {
    name: 'debug_javascript_error',
    description: 'Capture and analyze JavaScript errors on a page with detailed debugging info',
    handler: async (args: any) => {
      return {
        url: args.url,
        message: 'Error debugging requires browser automation setup',
      }
    },
  },
]

// ============= SYSTEM TOOLS (4) =============

const systemTools = [
  {
    name: 'get_instructions',
    description: 'Get comprehensive instructions for ALL Token Saver MCP tools (both LSP and CDP). Returns a complete guide with tool descriptions, decision trees, examples, and workflows for both code navigation and browser control.',
    handler: async (args: any): Promise<any> => {
      // Read the instructions file
      const instructionsPath = path.join(__dirname, '..', 'README_USAGE_GUIDE.md')

      try {
        if (fs.existsSync(instructionsPath)) {
          const content = fs.readFileSync(instructionsPath, 'utf-8')
          return {
            instructions: content,
            source: 'README_USAGE_GUIDE.md',
          }
        }
        else {
          return {
            instructions: 'Token Saver MCP provides 30 powerful tools for code navigation and browser control.',
            tools: [...lspTools, ...cdpTools, ...helperTools].map((t: any) => ({
              name: t.name,
              description: t.description,
            })),
          }
        }
      }
      catch (error: any) {
        return {
          error: error.message,
          fallback: 'Use tools/list to see all available tools',
        }
      }
    },
  },
  {
    name: 'get_supported_languages',
    description: 'Get a list of all languages registered in VSCode, organized by category (programming, web, data, etc.). Also shows which languages are currently active in the workspace.',
    handler: async (args: any) => {
      const languages = await vscode.languages.getLanguages()

      // Categorize languages
      const categories = {
        programming: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust', 'swift', 'kotlin'],
        web: ['html', 'css', 'scss', 'less', 'jsx', 'tsx'],
        data: ['json', 'xml', 'yaml', 'toml', 'csv'],
        scripting: ['bash', 'powershell', 'perl', 'ruby', 'lua'],
        database: ['sql', 'mongodb'],
        markup: ['markdown', 'latex', 'restructuredtext'],
        config: ['dockerfile', 'makefile', 'properties', 'ini'],
        other: [],
      }

      const categorized: any = {}
      for (const [category, langList] of Object.entries(categories)) {
        categorized[category] = languages.filter((l: any) => (langList as any).includes(l))
      }

      // Add uncategorized languages
      const allCategorized = Object.values(categories).flat()
      categorized.other = languages.filter((l: any) => !(allCategorized as any).includes(l))

      return {
        totalLanguages: languages.length,
        categorized,
        all: languages,
      }
    },
  },
  {
    name: 'retrieve_buffer',
    description: 'Retrieve the full data from a buffered response using its buffer ID',
    handler: async (args: any) => {
      const _client = getGatewayClient()

      try {
        const response = await fetch(`http://localhost:9600/buffer/${args.bufferId}`)
        const data = await response.json() as any

        if (!data.success) {
          return {
            error: data.error || 'Buffer not found',
            bufferId: args.bufferId,
          }
        }

        return data.result
      }
      catch (error: any) {
        return {
          error: error.message,
          bufferId: args.bufferId,
        }
      }
    },
  },
  {
    name: 'get_buffer_stats',
    description: 'Get statistics about currently buffered responses',
    handler: async (args: any) => {
      try {
        const response = await fetch('http://localhost:9600/admin/buffers')
        const data = await response.json() as any

        return {
          buffers: data.buffers,
          count: data.count,
          totalSize: data.buffers.reduce((sum: number, b: any) => sum + b.size, 0),
        }
      }
      catch (error: any) {
        return {
          error: error.message,
          buffers: [],
          count: 0,
        }
      }
    },
  },
]

// ============= COMBINE ALL TOOLS =============

export const ALL_TOOLS = [
  ...lspTools,
  ...cdpTools,
  ...helperTools,
  ...systemTools,
]

// Create map for quick lookup
export const TOOLS_MAP = new Map()
ALL_TOOLS.forEach((tool) => {
  TOOLS_MAP.set(tool.name, tool)
})

export function getToolByName(name: string) {
  return TOOLS_MAP.get(name)
}

export function listAllTools() {
  return ALL_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }))
}

export function getToolsByCategory() {
  return {
    lsp: lspTools.map(t => ({ name: t.name, description: t.description })),
    cdp: cdpTools.map(t => ({ name: t.name, description: t.description })),
    helper: helperTools.map(t => ({ name: t.name, description: t.description })),
    system: systemTools.map((t: any) => ({ name: t.name, description: t.description })),
  }
}
