import * as vscode from 'vscode'
import { withErrorHandling } from './errors'

/**
 * Get all symbols in a document (classes, methods, functions, variables, etc.)
 *
 * @param uri - Document URI in file:// format
 * @returns Array of document symbols with hierarchical structure
 */
export async function getDocumentSymbols(
  uri: string,
): Promise<any> {
  return withErrorHandling('getDocumentSymbols', async () => {
    // Parse URI directly without requiring document to be open
    const parsedUri = vscode.Uri.parse(uri)

    // Execute the document symbol provider command
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      parsedUri,
    )

    if (!symbols || symbols.length === 0) {
      return []
    }

    // Convert VSCode DocumentSymbol to a simpler format
    return symbols.map(symbolToJSON)
  })
}

/**
 * Convert a VSCode DocumentSymbol to a JSON-serializable format
 */
function symbolToJSON(symbol: vscode.DocumentSymbol): any {
  const result: any = {
    name: symbol.name,
    kind: vscode.SymbolKind[symbol.kind], // Convert enum to string
    range: {
      start: { line: symbol.range.start.line, character: symbol.range.start.character },
      end: { line: symbol.range.end.line, character: symbol.range.end.character },
    },
    selectionRange: {
      start: { line: symbol.selectionRange.start.line, character: symbol.selectionRange.start.character },
      end: { line: symbol.selectionRange.end.line, character: symbol.selectionRange.end.character },
    },
  }

  // Add detail if available
  if (symbol.detail) {
    result.detail = symbol.detail
  }

  // Add tags if available (e.g., deprecated)
  if (symbol.tags && symbol.tags.length > 0) {
    result.tags = symbol.tags.map(tag => vscode.SymbolTag[tag])
  }

  // Recursively convert children
  if (symbol.children && symbol.children.length > 0) {
    result.children = symbol.children.map(symbolToJSON)
  }

  return result
}
