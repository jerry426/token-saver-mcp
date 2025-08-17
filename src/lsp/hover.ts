import * as vscode from 'vscode'
import { logger } from '../utils'
import { ensureLspActivated } from './ensure-lsp-activated'
import { withErrorHandling } from './errors'

/**
 * Get hover information at the specified position
 *
 * @param uri Document URI
 * @param line Line number (0-based)
 * @param character Character position (0-based)
 * @returns Hover information array
 */
export async function getHover(
  uri: string,
  line: number,
  character: number,
): Promise<any> {
  const position = new vscode.Position(line, character)

  return withErrorHandling(
    'get hover information',
    async () => {
      logger.info(`Getting hover info: ${uri} line:${line} char:${character}`)

      // Ensure LSP is activated for this file type
      await ensureLspActivated(uri)

      // Parse URI directly without requiring document to be open
      const parsedUri = vscode.Uri.parse(uri)

      // Call VSCode API to get hover information
      const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        parsedUri,
        position,
      )

      if (!hoverResults || hoverResults.length === 0) {
        return []
      }

      // Format hover results similar to alternate_idea_2.md
      return hoverResults.map(h => ({
        range: h.range
          ? {
              start: { line: h.range.start.line, character: h.range.start.character },
              end: { line: h.range.end.line, character: h.range.end.character },
            }
          : undefined,
        contents: h.contents.map((c) => {
          if (typeof (c as any).value === 'string') {
            return { kind: 'markdown', value: (c as any).value }
          }
          if (typeof c === 'string') {
            return { kind: 'text', value: c }
          }
          // Handle MarkedString: { language, value }
          const ms = c as any
          if (ms.value) {
            return {
              kind: ms.language ? 'code' : 'text',
              language: ms.language,
              value: ms.value,
            }
          }
          return { kind: 'text', value: String(c) }
        }),
      }))
    },
    { uri, position },
  )
}
