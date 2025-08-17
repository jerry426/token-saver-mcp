import * as vscode from 'vscode'
import { logger } from '../utils'
import { withErrorHandling } from './errors'

/**
 * Execute symbol rename
 * @param uri Document URI
 * @param line Line number (0-based)
 * @param character Character position (0-based)
 * @param newName New name
 * @returns Returns rename edit information
 */
export async function rename(
  uri: string,
  line: number,
  character: number,
  newName: string,
): Promise<any> {
  const position = new vscode.Position(line, character)

  return withErrorHandling(
    'rename symbol',
    async () => {
      logger.info(`Executing rename: ${uri} line:${line} char:${character} newName:${newName}`)

      // Parse URI directly without requiring document to be open
      const parsedUri = vscode.Uri.parse(uri)

      // Execute rename operation
      const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
        'vscode.executeDocumentRenameProvider',
        parsedUri,
        position,
        newName,
      )

      if (!edit) {
        return { applied: false, changes: [] }
      }

      // Serialize the WorkspaceEdit for consistent format
      const changes: Array<{ uri: string, edits: Array<{ range: any, newText: string }> }> = []
      for (const [u, textEdits] of edit.entries()) {
        changes.push({
          uri: u.toString(),
          edits: textEdits.map(e => ({
            range: {
              start: { line: e.range.start.line, character: e.range.start.character },
              end: { line: e.range.end.line, character: e.range.end.character },
            },
            newText: e.newText,
          })),
        })
      }

      // Return the serialized changes without applying
      // The MCP client can decide whether to apply
      return { applied: false, changes }
    },
    { uri, position },
  )
}
