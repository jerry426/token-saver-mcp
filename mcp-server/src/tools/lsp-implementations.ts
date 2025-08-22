/**
 * LSP tool implementations using the VSCode gateway
 */

import { vscode } from '../vscode-adapter'

export async function getDefinition(uri: string, line: number, character: number) {
  return vscode.commands.executeCommand(
    'vscode.executeDefinitionProvider',
    uri,
    { line, character },
  )
}

export async function getReferences(uri: string, line: number, character: number) {
  return vscode.commands.executeCommand(
    'vscode.executeReferenceProvider',
    uri,
    { line, character },
    { includeDeclaration: true },
  )
}

export async function getHover(uri: string, line: number, character: number) {
  return vscode.commands.executeCommand(
    'vscode.executeHoverProvider',
    uri,
    { line, character },
  )
}

export async function getCompletions(uri: string, line: number, character: number) {
  return vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    uri,
    { line, character },
  )
}

export async function getTypeDefinition(uri: string, line: number, character: number) {
  return vscode.commands.executeCommand(
    'vscode.executeTypeDefinitionProvider',
    uri,
    { line, character },
  )
}

export async function findImplementations(uri: string, line: number, character: number) {
  return vscode.commands.executeCommand(
    'vscode.executeImplementationProvider',
    uri,
    { line, character },
  )
}

export async function getDocumentSymbols(uri: string) {
  return vscode.commands.executeCommand(
    'vscode.executeDocumentSymbolProvider',
    uri,
  )
}

export async function getCallHierarchy(uri: string, line: number, character: number, direction: 'incoming' | 'outgoing' = 'incoming') {
  // First prepare the call hierarchy
  const items = await vscode.commands.executeCommand(
    'vscode.prepareCallHierarchy',
    uri,
    { line, character },
  )

  if (!items || (items as any[]).length === 0) {
    return []
  }

  // Then get incoming or outgoing calls
  const command = direction === 'incoming'
    ? 'vscode.provideIncomingCalls'
    : 'vscode.provideOutgoingCalls'

  return vscode.commands.executeCommand(command, (items as any[])[0])
}

export async function renameSymbol(uri: string, line: number, character: number, newName: string) {
  return vscode.commands.executeCommand(
    'vscode.executeDocumentRenameProvider',
    uri,
    { line, character },
    newName,
  )
}

export async function getCodeActions(uri: string, line: number, character: number) {
  const range = {
    start: { line, character },
    end: { line, character },
  }
  return vscode.commands.executeCommand(
    'vscode.executeCodeActionProvider',
    uri,
    range,
  )
}

export async function getDiagnostics(uri?: string) {
  return vscode.languages.getDiagnostics(uri)
}

export async function getSemanticTokens(uri: string) {
  return vscode.commands.executeCommand(
    'vscode.executeDocumentSemanticTokensProvider',
    uri,
  )
}

export async function searchText(query: string, options: any = {}) {
  // Use the findTextInFiles API through the workspace gateway
  const { getGatewayClient } = await import('../vscode-gateway-client')
  const client = getGatewayClient()

  // Prepare the search query object for VSCode's findTextInFiles
  const searchQuery = {
    pattern: query,
    isRegExp: options.useRegExp || false,
    isCaseSensitive: options.isCaseSensitive || false,
    isWordMatch: options.matchWholeWord || false,
  }

  // Prepare the search options
  const searchOptions: any = {
    maxResults: options.maxResults || 100,
    // Note: includes/excludes need special handling for glob patterns
    // We'll handle these on the gateway side if needed
  }

  // Add include/exclude patterns if provided
  if (options.includes) {
    searchOptions.include = options.includes
  }
  if (options.excludes) {
    searchOptions.exclude = options.excludes
  }

  return client.workspaceApi('findTextInFiles', searchQuery, searchOptions)
}

export async function searchSymbols(query: string) {
  // Use the workspace symbol provider for semantic symbol search
  return vscode.commands.executeCommand(
    'vscode.executeWorkspaceSymbolProvider',
    query,
  )
}
