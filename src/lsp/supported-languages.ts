import * as vscode from 'vscode'
import { withErrorHandling } from './errors'

/**
 * Get all languages registered in VSCode and check which ones have LSP support
 */
export async function getSupportedLanguages(): Promise<any> {
  return withErrorHandling('getSupportedLanguages', async () => {
    // Get all registered languages
    const allLanguages = await vscode.languages.getLanguages()

    // Get currently open documents to check active languages
    const activeLanguages = new Set<string>()
    vscode.workspace.textDocuments.forEach((doc) => {
      activeLanguages.add(doc.languageId)
    })

    // Categorize languages
    const result = {
      total: allLanguages.length,
      languages: allLanguages.sort(),
      activeInWorkspace: Array.from(activeLanguages).sort(),
      commonLanguages: {
        programming: allLanguages.filter(lang =>
          ['typescript', 'javascript', 'python', 'java', 'csharp', 'cpp', 'c', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'dart', 'r', 'julia', 'haskell', 'erlang', 'elixir', 'clojure', 'fsharp', 'objective-c', 'perl', 'lua', 'groovy', 'coffeescript'].includes(lang),
        ).sort(),
        web: allLanguages.filter(lang =>
          ['html', 'css', 'scss', 'sass', 'less', 'stylus', 'vue', 'jsx', 'tsx', 'jade', 'pug', 'handlebars', 'ejs', 'twig'].includes(lang),
        ).sort(),
        data: allLanguages.filter(lang =>
          ['json', 'xml', 'yaml', 'toml', 'ini', 'properties', 'csv', 'jsonc', 'json5', 'jsonl'].includes(lang),
        ).sort(),
        documentation: allLanguages.filter(lang =>
          ['markdown', 'mdx', 'restructuredtext', 'asciidoc', 'latex', 'tex', 'bibtex'].includes(lang),
        ).sort(),
        scripting: allLanguages.filter(lang =>
          ['shellscript', 'powershell', 'batch', 'makefile', 'dockerfile', 'dockercompose', 'terraform', 'ansible', 'puppet'].includes(lang),
        ).sort(),
        database: allLanguages.filter(lang =>
          ['sql', 'plsql', 'tsql', 'mysql', 'postgresql', 'sqlite', 'mongodb', 'redis', 'graphql', 'prisma'].includes(lang),
        ).sort(),
      },
    }

    return result
  })
}
