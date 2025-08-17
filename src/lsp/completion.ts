import * as vscode from 'vscode'
import { logger } from '../utils'
import { withErrorHandling } from './errors'

/**
 * Get code completion suggestions
 *
 * @param uri Document URI
 * @param line Line number (0-based)
 * @param character Character position (0-based)
 * @param triggerCharacter Optional trigger character
 * @returns Completion list or empty list
 */
export async function getCompletions(
  uri: string,
  line: number,
  character: number,
  triggerCharacter?: string,
): Promise<any> {
  const position = new vscode.Position(line, character)

  return withErrorHandling(
    'get completions',
    async () => {
      logger.info(`Getting completions: ${uri} line:${line} char:${character}`)

      // Parse URI directly without requiring document to be open
      const parsedUri = vscode.Uri.parse(uri)

      // Call VSCode API to get completions
      // The API can return either CompletionList or CompletionItem[]
      const result = await vscode.commands.executeCommand<
        vscode.CompletionList | vscode.CompletionItem[]
      >(
        'vscode.executeCompletionItemProvider',
        parsedUri,
        position,
        triggerCharacter,
      )

      // Handle null/undefined result
      if (!result) {
        return []
      }

      // Get items array
      const items = Array.isArray(result) ? result : result.items || []

      // Format like alternate_idea_2.md
      return items.map(ci => ({
        label: typeof ci.label === 'string' ? ci.label : ci.label.label,
        kind: ci.kind,
        detail: ci.detail,
        documentation: typeof ci.documentation === 'string'
          ? ci.documentation
          : (ci.documentation as vscode.MarkdownString | undefined)?.value,
        insertText: typeof ci.insertText === 'string'
          ? ci.insertText
          : (ci.insertText as vscode.SnippetString | undefined)?.value,
        sortText: ci.sortText,
        filterText: ci.filterText,
        commitCharacters: ci.commitCharacters,
      }))
    },
    { uri, position },
  )
}
