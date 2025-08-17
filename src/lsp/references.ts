import * as vscode from 'vscode'
import { logger } from '../utils'
import { ensureLspActivated } from './ensure-lsp-activated'
import { withErrorHandling } from './errors'

/**
 * Get all references to a symbol
 *
 * @param uri Document URI
 * @param line Line number (0-based)
 * @param character Character position (0-based)
 * @returns List of reference locations
 */
export async function getReferences(
  uri: string,
  line: number,
  character: number,
): Promise<any> {
  const position = new vscode.Position(line, character)

  return withErrorHandling(
    'get references',
    async () => {
      logger.info(`Getting references: ${uri} line:${line} char:${character}`)

      // Ensure LSP is activated for this file type
      await ensureLspActivated(uri)

      // Parse URI directly without requiring document to be open
      const parsedUri = vscode.Uri.parse(uri)

      // Call VSCode API to get reference locations
      const references = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        parsedUri,
        position,
      )

      if (!references || references.length === 0) {
        return []
      }

      // Format references consistently
      return references.map(ref => ({
        uri: ref.uri.toString(),
        range: {
          start: { line: ref.range.start.line, character: ref.range.start.character },
          end: { line: ref.range.end.line, character: ref.range.end.character },
        },
      }))
    },
    { uri, position },
  )
}
