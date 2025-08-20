/**
 * Client for communicating with the VSCode Internals Gateway extension
 */

interface GatewayResponse<T = any> {
  success: boolean
  result?: T
  error?: string
  buffered?: boolean
  bufferId?: string
  message?: string
  requestId?: number
}

export class VSCodeGatewayClient {
  private baseUrl: string

  constructor(port: number = 9600) {
    this.baseUrl = `http://localhost:${port}`
  }

  /**
   * Check if gateway is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      const data = await response.json() as any
      return data.status === 'healthy'
    }
    catch {
      return false
    }
  }

  /**
   * Execute any VSCode command
   */
  async executeCommand<T = any>(command: string, ...args: any[]): Promise<T> {
    const response = await fetch(`${this.baseUrl}/execute-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args }),
    })

    const data: GatewayResponse<T> = await response.json() as any

    if (!data.success) {
      throw new Error(data.error || 'Command execution failed')
    }

    // Handle buffered responses
    if (data.buffered && data.bufferId) {
      const bufferResponse = await fetch(`${this.baseUrl}/buffer/${data.bufferId}`)
      const bufferData: GatewayResponse<T> = await bufferResponse.json() as any

      if (!bufferData.success) {
        throw new Error(bufferData.error || 'Failed to retrieve buffered response')
      }

      return bufferData.result as T
    }

    return data.result as T
  }

  /**
   * Access VSCode Languages API
   */
  async languagesApi<T = any>(method: string, ...args: any[]): Promise<T> {
    const response = await fetch(`${this.baseUrl}/languages-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args }),
    })

    const data: GatewayResponse<T> = await response.json() as any

    if (!data.success) {
      throw new Error(data.error || 'Languages API call failed')
    }

    return data.result as T
  }

  /**
   * Access VSCode Workspace API
   */
  async workspaceApi<T = any>(method: string, ...args: any[]): Promise<T> {
    const response = await fetch(`${this.baseUrl}/workspace-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args }),
    })

    const data: GatewayResponse<T> = await response.json() as any

    if (!data.success) {
      throw new Error(data.error || 'Workspace API call failed')
    }

    return data.result as T
  }

  /**
   * Access VSCode Window API
   */
  async windowApi<T = any>(method: string, ...args: any[]): Promise<T> {
    const response = await fetch(`${this.baseUrl}/window-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args }),
    })

    const data: GatewayResponse<T> = await response.json() as any

    if (!data.success) {
      throw new Error(data.error || 'Window API call failed')
    }

    return data.result as T
  }

  /**
   * Access VSCode Extension API
   */
  async extensionApi<T = any>(method: string, ...args: any[]): Promise<T> {
    const response = await fetch(`${this.baseUrl}/extension-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args }),
    })

    const data: GatewayResponse<T> = await response.json() as any

    if (!data.success) {
      throw new Error(data.error || 'Extension API call failed')
    }

    return data.result as T
  }
}

// Singleton instance
let gatewayClient: VSCodeGatewayClient | null = null

export function getGatewayClient(port?: number): VSCodeGatewayClient {
  if (!gatewayClient) {
    gatewayClient = new VSCodeGatewayClient(port)
  }
  return gatewayClient
}

// Helper functions that mirror the existing LSP functions
export async function getDefinition(uri: string, line: number, character: number) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeDefinitionProvider',
    uri, // Gateway will parse this automatically
    { line, character },
  )
}

export async function getReferences(uri: string, line: number, character: number) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeReferenceProvider',
    uri,
    { line, character },
    { includeDeclaration: true },
  )
}

export async function getHover(uri: string, line: number, character: number) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeHoverProvider',
    uri,
    { line, character },
  )
}

export async function getCompletions(uri: string, line: number, character: number) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeCompletionItemProvider',
    uri,
    { line, character },
  )
}

export async function getImplementations(uri: string, line: number, character: number) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeImplementationProvider',
    uri,
    { line, character },
  )
}

export async function getTypeDefinition(uri: string, line: number, character: number) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeTypeDefinitionProvider',
    uri,
    { line, character },
  )
}

export async function getDocumentSymbols(uri: string) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeDocumentSymbolProvider',
    uri,
  )
}

export async function getCodeActions(uri: string, line: number, character: number) {
  const client = getGatewayClient()
  const range = {
    start: { line, character },
    end: { line, character },
  }
  return client.executeCommand(
    'vscode.executeCodeActionProvider',
    uri,
    range,
  )
}

export async function getSemanticTokens(uri: string) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeDocumentSemanticTokensProvider',
    uri,
  )
}

export async function getCallHierarchy(uri: string, line: number, character: number, direction: 'incoming' | 'outgoing' = 'incoming') {
  const client = getGatewayClient()

  // First prepare the call hierarchy
  const items = await client.executeCommand(
    'vscode.prepareCallHierarchy',
    uri,
    { line, character },
  )

  if (!items || items.length === 0) {
    return []
  }

  // Then get incoming or outgoing calls
  const command = direction === 'incoming'
    ? 'vscode.provideIncomingCalls'
    : 'vscode.provideOutgoingCalls'

  return client.executeCommand(command, items[0])
}

export async function rename(uri: string, line: number, character: number, newName: string) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeDocumentRenameProvider',
    uri,
    { line, character },
    newName,
  )
}

export async function getDiagnostics(uri?: string) {
  const client = getGatewayClient()
  return client.languagesApi('getDiagnostics', uri)
}

export async function searchText(query: string, options: any = {}) {
  const client = getGatewayClient()
  return client.executeCommand(
    'vscode.executeWorkspaceSymbolProvider',
    query,
  )
}
