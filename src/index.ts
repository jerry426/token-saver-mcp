import { defineExtension } from 'reactive-vscode'
import { startMcp, stopMcp } from './mcp'

const { activate, deactivate } = defineExtension(async (context) => {
  await startMcp()

  // Clean up on deactivation
  context.subscriptions.push({
    dispose: () => {
      stopMcp()
    },
  })
})

export { activate, deactivate }
