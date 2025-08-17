import * as vscode from 'vscode'
import { logger } from '../utils'
import { ensureLspActivated } from './ensure-lsp-activated'
import { withErrorHandling } from './errors'

/**
 * Get available code actions (quick fixes, refactorings) at a given position
 *
 * @param uri - Document URI in file:// format
 * @param line - Line number (0-based)
 * @param character - Character position in line (0-based)
 * @returns Array of available code actions with title and kind
 */
export async function getCodeActions(
  uri: string,
  line: number,
  character: number,
): Promise<any> {
  const position = new vscode.Position(line, character)
  const range = new vscode.Range(position, position)

  return withErrorHandling(
    'get code actions',
    async () => {
      logger.info(`Getting code actions: ${uri} line:${line} char:${character}`)

      // Ensure LSP is activated for this file type
      await ensureLspActivated(uri)

      // Parse URI directly
      const parsedUri = vscode.Uri.parse(uri)

      // Open the document to ensure it's available for code actions
      const document = await vscode.workspace.openTextDocument(parsedUri)
      
      // Store the currently active editor before opening new one
      const previousActiveEditor = vscode.window.activeTextEditor
      
      // Show the document briefly to ensure it's active
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: true,
        viewColumn: vscode.ViewColumn.Beside,
      })

      // Notify user that we're temporarily opening the file
      vscode.window.showInformationMessage(`Token Saver MCP: Opening ${parsedUri.path.split('/').pop()} to get code actions...`)

      try {
        // Call VSCode API to get available code actions with the document open
        const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          parsedUri,
          range,
        )

        // Log raw result for debugging
        logger.info(`Code actions raw result: ${JSON.stringify(actions)?.substring(0, 500)}`)

        if (!actions || actions.length === 0) {
          return []
        }

        // Format code actions for return
        const results = actions.map((action) => {
        const result: any = {
          title: action.title,
        }

        // Add kind if available
        if (action.kind) {
          result.kind = action.kind.value
        }

        // Add description if available
        if (action.command) {
          result.command = {
            title: action.command.title,
            command: action.command.command,
          }
        }

        // Add diagnostics that this action addresses
        if (action.diagnostics && action.diagnostics.length > 0) {
          result.diagnostics = action.diagnostics.map(d => ({
            message: d.message,
            severity: d.severity,
            range: {
              start: { line: d.range.start.line, character: d.range.start.character },
              end: { line: d.range.end.line, character: d.range.end.character },
            },
          }))
        }

        // Note if this action is preferred
        if (action.isPreferred) {
          result.isPreferred = true
        }

          return result
        })

        return results
      } finally {
        // Close the editor we opened by closing the tab in the side column
        // First, make the opened editor active
        await vscode.window.showTextDocument(editor.document, {
          viewColumn: editor.viewColumn,
          preview: false,
        })
        // Then close it
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
        
        // Notify user that we're closing the file
        vscode.window.showInformationMessage(`Token Saver MCP: Closed ${parsedUri.path.split('/').pop()}`)
        
        // Restore focus to previous editor if there was one
        if (previousActiveEditor) {
          await vscode.window.showTextDocument(previousActiveEditor.document, {
            viewColumn: previousActiveEditor.viewColumn,
            preview: false,
          })
        }
      }
    },
    { uri, position },
  )
}
