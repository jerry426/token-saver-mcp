import * as vscode from 'vscode'
import { logger } from '../utils'
import { withErrorHandling } from './errors'

/**
 * Find all implementations of an interface or abstract class
 *
 * @param uri - Document URI in file:// format
 * @param line - Line number (0-based)
 * @param character - Character position in line (0-based)
 * @returns Array of implementation locations with URI and range information
 */
export async function getImplementations(
  uri: string,
  line: number,
  character: number,
): Promise<any> {
  const position = new vscode.Position(line, character)

  return withErrorHandling(
    'get implementations',
    async () => {
      logger.info(`Getting implementations: ${uri} line:${line} char:${character}`)

      // Parse URI directly without requiring document to be open
      const parsedUri = vscode.Uri.parse(uri)

      // Call VSCode API to get implementation locations
      const implementations = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeImplementationProvider',
        parsedUri,
        position,
      )

      if (!implementations || implementations.length === 0) {
        return []
      }

      // Format implementations consistently with other tools
      return implementations.map(impl => ({
        uri: impl.uri.toString(),
        range: {
          start: { line: impl.range.start.line, character: impl.range.start.character },
          end: { line: impl.range.end.line, character: impl.range.end.character },
        },
      }))
    },
    { uri, position },
  )
}
