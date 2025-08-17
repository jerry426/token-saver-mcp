/**
 * VSCode Command Execution Interface
 * Provides direct control over VSCode IDE features
 */

import * as vscode from 'vscode'
import { logger } from '../utils'

/**
 * Execute any VSCode command and attempt to capture its results
 */
export async function executeVSCodeCommand(
  command: string,
  args?: any[],
): Promise<any> {
  try {
    logger.info(`Executing VSCode command: ${command}`, args)

    // Execute the command
    const result = await vscode.commands.executeCommand(command, ...(args || []))

    logger.info(`Command ${command} completed`, result)
    return result
  }
  catch (error) {
    logger.error(`Command ${command} failed:`, error)
    throw error
  }
}

/**
 * Trigger search and try to get results from the search view
 */
export async function searchWithUI(query: string, options: any = {}) {
  try {
    // First, let's try to trigger the search
    await vscode.commands.executeCommand('workbench.action.findInFiles', {
      query,
      isRegex: options.useRegExp ?? false,
      isCaseSensitive: options.isCaseSensitive ?? false,
      matchWholeWord: options.matchWholeWord ?? false,
      filesToInclude: options.includes?.join(', ') ?? '',
      filesToExclude: options.excludes?.join(', ') ?? '**/node_modules/**',
    })

    // Give the search time to complete
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Try to access the search results through the search view API
    // This is where we'd need to find a way to read the results

    // Option 1: Try to get the search model (this might not be exposed)
    const _searchView = vscode.window.activeTextEditor

    // Option 2: Try to use internal/proposed APIs if available
    // Note: This would require enabling proposed APIs in package.json

    // Option 3: Try to trigger a command that exports search results
    // Some extensions add this capability

    // For now, return a message indicating the search was triggered
    return {
      message: 'Search triggered in VSCode UI',
      query,
      note: 'Results are visible in the Search panel but cannot be programmatically captured yet',
    }
  }
  catch (error) {
    logger.error('Search with UI failed:', error)
    throw error
  }
}

/**
 * Get all available VSCode commands
 */
export async function getAllCommands(): Promise<string[]> {
  try {
    const commands = await vscode.commands.getCommands()
    return commands
  }
  catch (error) {
    logger.error('Failed to get commands:', error)
    return []
  }
}

/**
 * Open a file and navigate to a specific position
 */
export async function navigateToPosition(
  uri: string,
  line: number,
  character: number,
): Promise<void> {
  try {
    const parsedUri = vscode.Uri.parse(uri)
    const document = await vscode.workspace.openTextDocument(parsedUri)
    const editor = await vscode.window.showTextDocument(document)

    const position = new vscode.Position(line, character)
    editor.selection = new vscode.Selection(position, position)
    editor.revealRange(new vscode.Range(position, position))

    logger.info(`Navigated to ${uri}:${line}:${character}`)
  }
  catch (error) {
    logger.error('Navigation failed:', error)
    throw error
  }
}

/**
 * Trigger hover and try to capture the tooltip content
 */
export async function getHoverWithUI(
  uri: string,
  line: number,
  character: number,
): Promise<any> {
  try {
    // First navigate to the position
    await navigateToPosition(uri, line, character)

    // Trigger the hover command
    await vscode.commands.executeCommand('editor.action.showHover')

    // The hover is now visible in the UI, but we need to capture its content
    // This is challenging because the hover widget content isn't easily accessible

    // We could try:
    // 1. Using the vscode.executeHoverProvider command instead (which we already do)
    // 2. Accessing the hover widget through internal APIs
    // 3. Using accessibility APIs to read the screen content

    return {
      message: 'Hover triggered in VSCode UI',
      uri,
      position: { line, character },
      note: 'Hover tooltip is visible but content cannot be captured programmatically yet',
    }
  }
  catch (error) {
    logger.error('Hover with UI failed:', error)
    throw error
  }
}

/**
 * Execute Go to Definition and navigate to the result
 */
export async function goToDefinitionWithUI(
  uri: string,
  line: number,
  character: number,
): Promise<any> {
  try {
    // Navigate to the position
    await navigateToPosition(uri, line, character)

    // Execute go to definition
    await vscode.commands.executeCommand('editor.action.revealDefinition')

    // The editor has now navigated to the definition
    // We can get the current position
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor) {
      const currentUri = activeEditor.document.uri.toString()
      const currentPosition = activeEditor.selection.active

      return {
        uri: currentUri,
        line: currentPosition.line,
        character: currentPosition.character,
      }
    }

    return null
  }
  catch (error) {
    logger.error('Go to definition with UI failed:', error)
    throw error
  }
}

/**
 * Show all symbols in workspace using Quick Pick
 */
export async function showAllSymbols(query?: string): Promise<any> {
  try {
    // This opens the symbol picker UI
    if (query) {
      await vscode.commands.executeCommand('workbench.action.showAllSymbols', query)
    }
    else {
      await vscode.commands.executeCommand('workbench.action.showAllSymbols')
    }

    // The symbol picker is now open, but we can't easily get its contents
    // We'd need to hook into the QuickPick API somehow

    return {
      message: 'Symbol picker opened in VSCode UI',
      query,
      note: 'Symbol list is visible but cannot be captured programmatically yet',
    }
  }
  catch (error) {
    logger.error('Show all symbols failed:', error)
    throw error
  }
}

/**
 * Run a task by name
 */
export async function runTask(taskName: string): Promise<void> {
  try {
    const tasks = await vscode.tasks.fetchTasks()
    const task = tasks.find(t => t.name === taskName)

    if (task) {
      await vscode.tasks.executeTask(task)
      logger.info(`Started task: ${taskName}`)
    }
    else {
      throw new Error(`Task not found: ${taskName}`)
    }
  }
  catch (error) {
    logger.error('Run task failed:', error)
    throw error
  }
}

/**
 * Get workspace configuration
 */
export function getConfiguration(section: string): any {
  return vscode.workspace.getConfiguration(section)
}

/**
 * Show a message to the user
 */
export async function showMessage(
  message: string,
  type: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  switch (type) {
    case 'error':
      await vscode.window.showErrorMessage(message)
      break
    case 'warning':
      await vscode.window.showWarningMessage(message)
      break
    default:
      await vscode.window.showInformationMessage(message)
  }
}

/**
 * Create a terminal and run a command
 */
export async function runInTerminal(
  command: string,
  name: string = 'MCP Terminal',
): Promise<void> {
  const terminal = vscode.window.createTerminal(name)
  terminal.show()
  terminal.sendText(command)
}

/**
 * Get diagnostics (errors/warnings) for a file or all files
 */
export function getDiagnostics(uri?: string): any[] {
  if (uri) {
    // Single file diagnostics - returns an array of Diagnostic
    const diagnostics = vscode.languages.getDiagnostics(vscode.Uri.parse(uri))
    return diagnostics.map(d => ({
      severity: d.severity,
      message: d.message,
      source: d.source,
      range: {
        start: { line: d.range.start.line, character: d.range.start.character },
        end: { line: d.range.end.line, character: d.range.end.character },
      },
    }))
  }
  else {
    // All files diagnostics - returns an array of tuples [Uri, Diagnostic[]]
    const diagnostics = vscode.languages.getDiagnostics()
    const allDiagnostics: any[] = []
    diagnostics.forEach(([uri, fileDiagnostics]) => {
      fileDiagnostics.forEach((d) => {
        allDiagnostics.push({
          uri: uri.toString(),
          severity: d.severity,
          message: d.message,
          source: d.source,
          range: {
            start: { line: d.range.start.line, character: d.range.start.character },
            end: { line: d.range.end.line, character: d.range.end.character },
          },
        })
      })
    })
    return allDiagnostics
  }
}
