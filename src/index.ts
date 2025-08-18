import { defineExtension } from 'reactive-vscode'
import * as vscode from 'vscode'
import { startMcp, stopMcp } from './mcp'
import { UpdateChecker } from './utils/update-checker'

const { activate, deactivate } = defineExtension(async (context) => {
  await startMcp()

  // Register commands
  const checkUpdateCommand = vscode.commands.registerCommand('token-saver-mcp.checkForUpdates', () => {
    UpdateChecker.checkForUpdates(context, false) // false = not silent
  })
  context.subscriptions.push(checkUpdateCommand)

  // Check for updates on activation (silently)
  setTimeout(() => {
    UpdateChecker.checkForUpdates(context, true)
  }, 5000) // Check 5 seconds after activation

  // Clean up on deactivation
  context.subscriptions.push({
    dispose: () => {
      stopMcp()
    },
  })
})

export { activate, deactivate }
