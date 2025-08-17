import * as vscode from 'vscode'
import { logger } from '../utils'
import { withErrorHandling } from './errors'

/**
 * Get diagnostics (errors, warnings, info, hints) for a file or all files
 *
 * @param uri - Optional document URI in file:// format. If not provided, gets diagnostics for all files.
 * @returns Array of diagnostics with severity, message, and location
 */
export async function getDiagnostics(uri?: string): Promise<any> {
  return withErrorHandling(
    'get diagnostics',
    async () => {
      logger.info(`Getting diagnostics: ${uri || 'all files'}`)

      let diagnostics: [vscode.Uri, vscode.Diagnostic[]][]

      if (uri) {
        // Get diagnostics for specific file
        const parsedUri = vscode.Uri.parse(uri)
        const fileDiagnostics = vscode.languages.getDiagnostics(parsedUri)
        diagnostics = [[parsedUri, fileDiagnostics]]
      }
      else {
        // Get all diagnostics
        diagnostics = vscode.languages.getDiagnostics()
      }

      // Format diagnostics for return
      const results: any[] = []

      for (const [fileUri, fileDiagnostics] of diagnostics) {
        if (fileDiagnostics.length === 0)
          continue

        const formattedDiagnostics = fileDiagnostics.map((diagnostic) => {
          const result: any = {
            message: diagnostic.message,
            severity: getSeverityString(diagnostic.severity),
            range: {
              start: {
                line: diagnostic.range.start.line,
                character: diagnostic.range.start.character,
              },
              end: {
                line: diagnostic.range.end.line,
                character: diagnostic.range.end.character,
              },
            },
          }

          // Add source if available (e.g., 'eslint', 'typescript')
          if (diagnostic.source) {
            result.source = diagnostic.source
          }

          // Add code if available (error code)
          if (diagnostic.code) {
            result.code = diagnostic.code
          }

          // Add related information if available
          if (diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0) {
            result.relatedInformation = diagnostic.relatedInformation.map(info => ({
              message: info.message,
              location: {
                uri: info.location.uri.toString(),
                range: {
                  start: {
                    line: info.location.range.start.line,
                    character: info.location.range.start.character,
                  },
                  end: {
                    line: info.location.range.end.line,
                    character: info.location.range.end.character,
                  },
                },
              },
            }))
          }

          // Add tags if available (e.g., deprecated, unnecessary)
          if (diagnostic.tags && diagnostic.tags.length > 0) {
            result.tags = diagnostic.tags.map(tag =>
              tag === vscode.DiagnosticTag.Deprecated ? 'deprecated' : 'unnecessary',
            )
          }

          return result
        })

        results.push({
          uri: fileUri.toString(),
          diagnostics: formattedDiagnostics,
        })
      }

      logger.info(`Found diagnostics in ${results.length} file(s)`)
      return results
    },
    { uri },
  )
}

function getSeverityString(severity: vscode.DiagnosticSeverity | undefined): string {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return 'error'
    case vscode.DiagnosticSeverity.Warning:
      return 'warning'
    case vscode.DiagnosticSeverity.Information:
      return 'information'
    case vscode.DiagnosticSeverity.Hint:
      return 'hint'
    default:
      return 'unknown'
  }
}
