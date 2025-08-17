import * as vscode from 'vscode'

/**
 * Language file extensions and their common entry points
 */
const LANGUAGE_PATTERNS: Record<string, string[]> = {
  typescript: ['**/*.ts', '**/*.tsx'],
  javascript: ['**/*.js', '**/*.jsx'],
  python: ['**/*.py'],
  java: ['**/*.java'],
  go: ['**/*.go'],
  rust: ['**/*.rs'],
  cpp: ['**/*.cpp', '**/*.cc', '**/*.cxx', '**/*.h', '**/*.hpp'],
  csharp: ['**/*.cs'],
  ruby: ['**/*.rb'],
  php: ['**/*.php'],
  swift: ['**/*.swift'],
  kotlin: ['**/*.kt'],
  scala: ['**/*.scala'],
  vue: ['**/*.vue'],
  svelte: ['**/*.svelte'],
  json: ['**/*.json'],
  yaml: ['**/*.yaml', '**/*.yml'],
  markdown: ['**/*.md'],
  html: ['**/*.html'],
  css: ['**/*.css', '**/*.scss', '**/*.sass'],
}

/**
 * Cache of already activated language servers
 */
const activatedLanguages = new Set<string>()

/**
 * Detect the language from a file URI
 */
function detectLanguage(uri: string): string | undefined {
  const lowerUri = uri.toLowerCase()

  for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of patterns) {
      // Convert glob pattern to simple extension check
      const ext = pattern.replace('**/*', '')
      if (lowerUri.endsWith(ext)) {
        return language
      }
    }
  }

  return undefined
}

/**
 * Ensure the Language Server for a given URI is activated
 * by opening a document of that type if needed
 */
export async function ensureLspActivated(uri: string): Promise<void> {
  const language = detectLanguage(uri)

  if (!language) {
    // Unknown language, try to open the specific file
    try {
      const parsedUri = vscode.Uri.parse(uri)
      await vscode.workspace.openTextDocument(parsedUri)
    }
    catch {
      // File might not exist, that's ok
    }
    return
  }

  // If we've already activated this language, skip
  if (activatedLanguages.has(language)) {
    return
  }

  // Check if the language is even registered in VSCode
  const registeredLanguages = await vscode.languages.getLanguages()
  if (!registeredLanguages.includes(language)) {
    return
  }

  // Check if any document of this language is already open
  const openDocsOfLanguage = vscode.workspace.textDocuments.filter((doc) => {
    const docLanguage = detectLanguage(doc.uri.toString())
    return docLanguage === language || doc.languageId === language
  })

  if (openDocsOfLanguage.length > 0) {
    activatedLanguages.add(language)
    return
  }

  // Try to open the requested file first
  try {
    const parsedUri = vscode.Uri.parse(uri)
    const doc = await vscode.workspace.openTextDocument(parsedUri)
    activatedLanguages.add(language)

    // Check if this document is already open in a tab
    const isAlreadyOpen = vscode.workspace.textDocuments.some(d => d.uri.toString() === parsedUri.toString())

    if (isAlreadyOpen) {
      activatedLanguages.add(language)
      return
    }

    // Show the document briefly to ensure LSP activation
    await vscode.window.showTextDocument(doc, {
      preview: false,
      preserveFocus: true,
      viewColumn: vscode.ViewColumn.Beside,
    })

    // Add a small delay to ensure LSP has time to activate
    await new Promise(resolve => setTimeout(resolve, 200))

    // Close it immediately since it wasn't already open
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')

    return
  }
  catch {
    // File doesn't exist, try to find any file of this type
  }

  // Fallback: Find any file of this language type in the workspace
  const patterns = LANGUAGE_PATTERNS[language]
  if (!patterns || patterns.length === 0) {
    return
  }

  for (const pattern of patterns) {
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1)

    if (files.length > 0) {
      try {
        const doc = await vscode.workspace.openTextDocument(files[0])
        activatedLanguages.add(language)

        // Brief show and close to activate LSP
        await vscode.window.showTextDocument(doc, {
          preview: false,
          preserveFocus: true,
          viewColumn: vscode.ViewColumn.Beside,
        })

        await new Promise(resolve => setTimeout(resolve, 200))
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor')

        return
      }
      catch {
        // Continue to next pattern
      }
    }
  }
}

/**
 * Initialize Language Servers for common file types in the workspace
 * This can be called on extension activation to pre-warm LSPs
 */
export async function initializeWorkspaceLsps(): Promise<void> {
  const languagesFound = new Set<string>()

  // Find which languages are present in the workspace
  for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of patterns) {
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1)
      if (files.length > 0) {
        languagesFound.add(language)
        break
      }
    }
  }

  // Activate LSP for each language found
  for (const language of languagesFound) {
    if (activatedLanguages.has(language)) {
      continue
    }

    const patterns = LANGUAGE_PATTERNS[language]
    for (const pattern of patterns) {
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1)

      if (files.length > 0) {
        try {
          const doc = await vscode.workspace.openTextDocument(files[0])
          activatedLanguages.add(language)

          // Show briefly in background to activate LSP
          await vscode.window.showTextDocument(doc, {
            preview: false,
            preserveFocus: true,
            viewColumn: vscode.ViewColumn.Beside,
          })

          await vscode.commands.executeCommand('workbench.action.closeActiveEditor')

          break
        }
        catch {
          // Continue to next file
        }
      }
    }
  }
}

/**
 * Clear the activation cache (useful when workspace changes)
 */
export function clearActivationCache(): void {
  activatedLanguages.clear()
}
