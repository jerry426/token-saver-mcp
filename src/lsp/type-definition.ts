import * as vscode from 'vscode'
import { logger } from '../utils'
import { ensureLspActivated } from './ensure-lsp-activated'
import { withErrorHandling } from './errors'

/**
 * Get type definition location
 *
 * @param uri - Document URI in file:// format
 * @param line - Line number (0-based)
 * @param character - Character position in line (0-based)
 * @returns Array of type definition locations with URI and range information
 */
export async function getTypeDefinition(
  uri: string,
  line: number,
  character: number,
): Promise<any> {
  const position = new vscode.Position(line, character)

  return withErrorHandling(
    'get type definition',
    async () => {
      logger.info(`Getting type definition: ${uri} line:${line} char:${character}`)

      // Ensure LSP is activated for this file type
      await ensureLspActivated(uri)

      // Parse URI directly without requiring document to be open
      const parsedUri = vscode.Uri.parse(uri)

      // Call VSCode API to get type definition location
      const definitions = await vscode.commands.executeCommand<any>(
        'vscode.executeTypeDefinitionProvider',
        parsedUri,
        position,
      )

      // Log raw result for debugging
      logger.info(`Type definition raw result: ${JSON.stringify(definitions)?.substring(0, 500)}`)

      if (!definitions) {
        return []
      }

      // Handle different possible return types
      let defsArray: any[] = []

      if (Array.isArray(definitions)) {
        defsArray = definitions
      }
      else if (definitions && typeof definitions === 'object') {
        // Might be a single Location or LocationLink
        defsArray = [definitions]
      }

      if (defsArray.length === 0) {
        return []
      }

      // Format definitions consistently
      const results: any[] = []

      for (const def of defsArray) {
        if (!def)
          continue

        // Check if it's a Location (has uri and range directly)
        if (def.uri && def.range) {
          results.push({
            uri: def.uri.toString(),
            range: {
              start: { line: def.range.start.line, character: def.range.start.character },
              end: { line: def.range.end.line, character: def.range.end.character },
            },
          })
        }
        // Check if it's a LocationLink (has targetUri and targetRange)
        else if (def.targetUri && def.targetRange) {
          results.push({
            uri: def.targetUri.toString(),
            range: {
              start: { line: def.targetRange.start.line, character: def.targetRange.start.character },
              end: { line: def.targetRange.end.line, character: def.targetRange.end.character },
            },
          })
        }
        // Skip anything else
      }

      return results
    },
    { uri, position },
  )
}
