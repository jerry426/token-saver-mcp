import * as vscode from 'vscode'
import { logger } from '../utils'
import { ensureLspActivated } from './ensure-lsp-activated'
import { withErrorHandling } from './errors'

/**
 * Get semantic tokens (detailed syntax highlighting) for a document
 *
 * @param uri - Document URI in file:// format
 * @returns Decoded semantic tokens with line, character, length, token type and modifiers
 */
export async function getSemanticTokens(uri: string): Promise<any> {
  return withErrorHandling(
    'get semantic tokens',
    async () => {
      logger.info(`Getting semantic tokens: ${uri}`)

      // Ensure LSP is activated for this file type
      await ensureLspActivated(uri)

      // Parse URI directly without requiring document to be open
      const parsedUri = vscode.Uri.parse(uri)

      // Call VSCode API to get semantic tokens
      const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        'vscode.provideDocumentSemanticTokens',
        parsedUri,
      )

      // Log raw result for debugging
      logger.info(`Semantic tokens raw result: ${tokens ? 'received' : 'none'}`)

      if (!tokens || !tokens.data) {
        return {
          uri,
          tokens: [],
        }
      }

      // Get the legend to decode token types and modifiers
      const legend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
        'vscode.provideDocumentSemanticTokensLegend',
        parsedUri,
      )

      if (!legend) {
        logger.warn('No semantic tokens legend available')
        return {
          uri,
          tokens: [],
        }
      }

      // Decode the tokens
      const decodedTokens = decodeSemanticTokens(tokens.data, legend)

      return {
        uri,
        legend: {
          tokenTypes: legend.tokenTypes,
          tokenModifiers: legend.tokenModifiers,
        },
        tokens: decodedTokens,
      }
    },
    { uri },
  )
}

/**
 * Decode semantic tokens from the encoded format
 * VSCode encodes tokens as [deltaLine, deltaStartChar, length, tokenType, tokenModifiers]
 */
function decodeSemanticTokens(
  data: Uint32Array,
  legend: vscode.SemanticTokensLegend,
): any[] {
  const tokens: any[] = []
  let prevLine = 0
  let prevChar = 0

  // Tokens are encoded as groups of 5 values
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i]
    const deltaStartChar = data[i + 1]
    const length = data[i + 2]
    const tokenType = data[i + 3]
    const tokenModifiers = data[i + 4]

    // Calculate absolute positions
    const line = prevLine + deltaLine
    const startChar = deltaLine === 0 ? prevChar + deltaStartChar : deltaStartChar

    // Decode token type
    const type = legend.tokenTypes[tokenType] || 'unknown'

    // Decode modifiers (bitfield)
    const modifiers: string[] = []
    for (let j = 0; j < legend.tokenModifiers.length; j++) {
      if (tokenModifiers & (1 << j)) {
        modifiers.push(legend.tokenModifiers[j])
      }
    }

    tokens.push({
      line,
      startCharacter: startChar,
      length,
      tokenType: type,
      tokenModifiers: modifiers,
    })

    prevLine = line
    prevChar = startChar
  }

  return tokens
}
