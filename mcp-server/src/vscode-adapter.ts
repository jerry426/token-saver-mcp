/**
 * Adapter layer that provides VSCode-like API using the gateway
 * This allows the tool files to work with minimal changes
 */

import { getGatewayClient } from './vscode-gateway-client'

// Create vscode namespace replacement
export const vscode = {
  commands: {
    executeCommand: async (command: string, ...args: any[]) => {
      const client = getGatewayClient()
      return client.executeCommand(command, ...args)
    },
  },

  languages: {
    getDiagnostics: async (uri?: string) => {
      const client = getGatewayClient()
      return client.languagesApi('getDiagnostics', uri)
    },

    getLanguages: async () => {
      const client = getGatewayClient()
      return client.languagesApi('getLanguages')
    },
  },

  workspace: {
    findFiles: async (include: string, exclude?: string, maxResults?: number) => {
      const client = getGatewayClient()
      return client.workspaceApi('findFiles', include, exclude, maxResults)
    },

    openTextDocument: async (uri: string) => {
      const client = getGatewayClient()
      return client.workspaceApi('openTextDocument', uri)
    },

    getConfiguration: async (section?: string, key?: string) => {
      const client = getGatewayClient()
      return client.workspaceApi('getConfiguration', section, key)
    },

    workspaceFolders: undefined as any, // Will be set on initialization
  },

  window: {
    showInformationMessage: async (message: string, ...items: string[]) => {
      const client = getGatewayClient()
      return client.windowApi('showInformationMessage', message, ...items)
    },

    showErrorMessage: async (message: string, ...items: string[]) => {
      const client = getGatewayClient()
      return client.windowApi('showErrorMessage', message, ...items)
    },

    activeTextEditor: undefined as any, // Will be set on initialization
  },

  extensions: {
    getExtension: async (extensionId: string) => {
      const client = getGatewayClient()
      return client.extensionApi('getExtension', extensionId)
    },

    all: [] as any, // Will be set on initialization
  },

  Uri: {
    parse: (uri: string) => {
      // Simple URI parser for compatibility
      return {
        scheme: uri.split(':')[0],
        path: uri.replace(/^[^:]+:\/\//, ''),
        fsPath: uri.replace(/^file:\/\//, ''),
        toString: () => uri,
        external: uri,
      }
    },

    file: (path: string) => {
      return {
        scheme: 'file',
        path,
        fsPath: path,
        toString: () => `file://${path}`,
        external: `file://${path}`,
      }
    },

    joinPath: (base: any, ...paths: string[]) => {
      const basePath = typeof base === 'string' ? base : base.fsPath
      const joined = [basePath, ...paths].join('/')
      return vscode.Uri.file(joined)
    },
  },

  Position: class {
    constructor(public line: number, public character: number) {}
  },

  Range: class {
    constructor(public start: any, public end: any) {}
  },

  Location: class {
    constructor(public uri: any, public range: any) {}
  },
}

// Helper to initialize cached values
export async function initializeVSCodeAdapter() {
  const client = getGatewayClient()

  try {
    // Get workspace folders
    const folders = await client.workspaceApi('getWorkspaceFolders')
    if (folders) {
      vscode.workspace.workspaceFolders = folders
    }

    // Get active editor
    const editor = await client.windowApi('getActiveTextEditor')
    if (editor) {
      vscode.window.activeTextEditor = editor
    }

    // Get all extensions
    const extensions = await client.extensionApi('getAllExtensions')
    if (extensions) {
      vscode.extensions.all = extensions
    }
  }
  catch (error) {
    console.warn('Could not initialize all VSCode adapter values:', error)
  }
}

// Re-export common types for compatibility
export type Uri = ReturnType<typeof vscode.Uri.parse>
export type Position = InstanceType<typeof vscode.Position>
export type Range = InstanceType<typeof vscode.Range>
export type Location = InstanceType<typeof vscode.Location>
