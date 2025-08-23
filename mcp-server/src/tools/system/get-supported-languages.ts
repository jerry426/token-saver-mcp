import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import { vscode } from '../../vscode-adapter'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'get_supported_languages',
  title: 'Get Supported Languages',
  category: 'system' as const,
  description: 'Get a list of all languages registered in VSCode, organized by category (programming, web, data, etc.). Also shows which languages are currently active in the workspace.',

  docs: {
    brief: 'List all VSCode language registrations and workspace activity',

    parameters: {},

    examples: [
      {
        title: 'Check language support',
        code: `get_supported_languages()`,
      },
    ],

    workflow: {
      usedWith: ['All LSP tools'],
      followedBy: ['Use LSP tools with confidence on supported languages'],
      description: 'Verify language support before using LSP features',
    },

    tips: [
      'Shows all registered languages (~150+ including extensions)',
      'Categorizes languages: programming, web, data, config, etc.',
      'Lists which languages are active in current workspace',
      'Useful for understanding LSP feature availability',
      'Programming languages get full LSP support (completions, navigation, etc.)',
      'Other file types may have limited features',
    ],

    meta: {
      isUtility: true,
      supportsTool: 'All LSP tools - helps understand feature availability',
    },
  },
}

// Tool handler - single source of truth for execution
export async function handler(): Promise<any> {
  try {
    // Get all languages from VSCode
    const languages = await vscode.languages.getLanguages()

    // Categorize languages
    const categories: Record<string, string[]> = {
      programming: [],
      web: [],
      data: [],
      config: [],
      documentation: [],
      other: [],
    }

    // Common language patterns for categorization
    const patterns = {
      programming: /^(typescript|javascript|python|java|csharp|cpp|c|go|rust|swift|kotlin|ruby|php|perl|lua|r|scala|clojure|haskell|erlang|elixir|fsharp|vb|dart|julia|nim|crystal|zig)$/i,
      web: /^(html|css|scss|sass|less|stylus|vue|jsx|tsx|astro|svelte|handlebars)$/i,
      data: /^(json|xml|yaml|toml|csv|sql|graphql|prisma)$/i,
      config: /^(dockerfile|makefile|cmake|gradle|maven|npm|yarn|pip|cargo|git|terraform|ansible|kubernetes|helm)$/i,
      documentation: /^(markdown|restructuredtext|asciidoc|latex|tex|org)$/i,
    }

    // Categorize each language
    for (const lang of languages) {
      let categorized = false
      for (const [category, pattern] of Object.entries(patterns)) {
        if (pattern.test(lang)) {
          categories[category].push(lang)
          categorized = true
          break
        }
      }
      if (!categorized) {
        categories.other.push(lang)
      }
    }

    // Get current workspace file extensions to show active languages
    const workspaceFolders = vscode.workspace.workspaceFolders
    const activeLanguages = new Set<string>()

    if (workspaceFolders && workspaceFolders.length > 0) {
      // Find files in workspace to determine active languages
      const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 100)

      for (const file of files) {
        const filePath = file.fsPath || file.path || file.toString()
        const ext = filePath.split('.').pop()
        if (ext) {
          // Map common extensions to language IDs
          const extToLang: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            py: 'python',
            java: 'java',
            cs: 'csharp',
            cpp: 'cpp',
            c: 'c',
            go: 'go',
            rs: 'rust',
            rb: 'ruby',
            php: 'php',
            html: 'html',
            css: 'css',
            json: 'json',
            md: 'markdown',
            yml: 'yaml',
            yaml: 'yaml',
            xml: 'xml',
            sql: 'sql',
            sh: 'shellscript',
            bash: 'shellscript',
          }

          const lang = extToLang[ext] || ext
          if (languages.includes(lang)) {
            activeLanguages.add(lang)
          }
        }
      }
    }

    const result = {
      totalLanguages: languages.length,
      activeInWorkspace: Array.from(activeLanguages).sort(),
      categories: {
        programming: categories.programming.sort(),
        web: categories.web.sort(),
        data: categories.data.sort(),
        config: categories.config.sort(),
        documentation: categories.documentation.sort(),
        other: categories.other.sort(),
      },
      all: languages.sort(),
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error getting languages: ${error.message}`,
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
      inputSchema: {},
    },
    handler, // Use the exported handler
  )
}
