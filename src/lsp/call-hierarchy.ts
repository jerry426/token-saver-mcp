import * as vscode from 'vscode'
import { logger } from '../utils'
import { ensureLspActivated } from './ensure-lsp-activated'
import { withErrorHandling } from './errors'

/**
 * Get call hierarchy for a symbol (incoming and outgoing calls)
 *
 * @param uri - Document URI in file:// format
 * @param line - Line number (0-based)
 * @param character - Character position in line (0-based)
 * @param direction - 'incoming' for callers, 'outgoing' for callees
 * @returns Array of call hierarchy items with location information
 */
export async function getCallHierarchy(
  uri: string,
  line: number,
  character: number,
  direction: 'incoming' | 'outgoing' = 'incoming',
): Promise<any> {
  return withErrorHandling('getCallHierarchy', async () => {
    // Ensure LSP is activated for this file type
    await ensureLspActivated(uri)

    const parsedUri = vscode.Uri.parse(uri)
    const position = new vscode.Position(line, character)

    // First, prepare the call hierarchy (get the item at position)
    const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      'vscode.prepareCallHierarchy',
      parsedUri,
      position,
    )

    if (!items || items.length === 0) {
      // No call hierarchy available at this position
      return {
        error: 'No call hierarchy available at this position',
        uri,
        position: { line, character },
      }
    }

    // Get the first item (the symbol at the given position)
    const targetItem = items[0]

    // If we got a module/workspace item instead of a function, it might mean wrong position
    if (targetItem.kind === vscode.SymbolKind.Module || targetItem.name === 'workspace') {
      // Try to return what we got anyway, but indicate it might not be the expected target
      logger.warn(`Got module-level item instead of function at ${uri}:${line}:${character}`)
    }

    // Get incoming or outgoing calls based on direction
    let calls: vscode.CallHierarchyIncomingCall[] | vscode.CallHierarchyOutgoingCall[]

    if (direction === 'incoming') {
      // Get incoming calls (who calls this function)
      calls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
        'vscode.provideIncomingCalls',
        targetItem,
      )
    }
    else {
      // Get outgoing calls (what this function calls)
      calls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
        'vscode.provideOutgoingCalls',
        targetItem,
      )
    }

    if (!calls || calls.length === 0) {
      return {
        target: itemToJSON(targetItem),
        calls: [],
      }
    }

    // Convert to JSON-serializable format
    return {
      target: itemToJSON(targetItem),
      direction,
      calls: calls.map(callToJSON),
    }
  })
}

/**
 * Convert a CallHierarchyItem to JSON format
 */
function itemToJSON(item: vscode.CallHierarchyItem): any {
  return {
    name: item.name,
    kind: vscode.SymbolKind[item.kind],
    detail: item.detail,
    uri: item.uri.toString(),
    range: {
      start: { line: item.range.start.line, character: item.range.start.character },
      end: { line: item.range.end.line, character: item.range.end.character },
    },
    selectionRange: {
      start: { line: item.selectionRange.start.line, character: item.selectionRange.start.character },
      end: { line: item.selectionRange.end.line, character: item.selectionRange.end.character },
    },
    tags: item.tags ? item.tags.map(tag => vscode.SymbolTag[tag]) : undefined,
  }
}

/**
 * Convert a CallHierarchyCall to JSON format
 */
function callToJSON(call: vscode.CallHierarchyIncomingCall | vscode.CallHierarchyOutgoingCall): any {
  const result: any = {}

  // Handle incoming vs outgoing calls
  if ('from' in call) {
    result.from = itemToJSON(call.from)
  }
  else if ('to' in call) {
    result.to = itemToJSON(call.to)
  }

  // Add call ranges (locations where the call happens)
  if (call.fromRanges && call.fromRanges.length > 0) {
    result.fromRanges = call.fromRanges.map(range => ({
      start: { line: range.start.line, character: range.start.character },
      end: { line: range.end.line, character: range.end.character },
    }))
  }

  return result
}
