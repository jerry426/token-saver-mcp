/**
 * Text-based search implementation
 * This provides an alternative to workspace symbols that works more reliably
 */

import * as vscode from 'vscode'
import { logger } from '../utils'
import { searchWithFallback } from './search-fallback'

export interface SearchResult {
  uri: string
  ranges: Array<{
    start: { line: number, character: number }
    end: { line: number, character: number }
  }>
  preview: string
}

/**
 * Search for text across the workspace
 *
 * @param query - Search query string or regular expression pattern
 * @param options - Search options
 * @param options.useRegExp - Whether to treat query as regex pattern (default: false)
 * @param options.isCaseSensitive - Case sensitive search (default: false)
 * @param options.matchWholeWord - Match whole words only (default: false)
 * @param options.maxResults - Maximum number of results to return (default: 100)
 * @param options.includes - Array of glob patterns to include
 * @param options.excludes - Array of glob patterns to exclude
 * @returns Array of search results with file URIs, match ranges, and previews
 */
export async function searchText(
  query: string,
  options: {
    useRegExp?: boolean
    isCaseSensitive?: boolean
    matchWholeWord?: boolean
    maxResults?: number
    includes?: string[]
    excludes?: string[]
  } = {},
): Promise<SearchResult[]> {
  try {
    logger.info(`Searching workspace for text: "${query}"`)

    // First try the search with multiple fallback approaches
    const fallbackResults = await searchWithFallback(query, options)
    if (fallbackResults.length > 0) {
      logger.info(`Fallback search found ${fallbackResults.length} results`)
      return fallbackResults
    }

    logger.info('Falling back to original search implementation')

    const _results: SearchResult[] = []

    // Get workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.info('No workspace folders found')
      return []
    }

    // Build search options
    // @ts-ignore - FindTextInFilesOptions may not be available in all VSCode versions
    const searchOptions: any = {
      include: options.includes && options.includes.length > 0
        ? new vscode.RelativePattern(workspaceFolders[0], `{${options.includes.join(',')}}`)
        : new vscode.RelativePattern(workspaceFolders[0], '**/*'),
      exclude: options.excludes && options.excludes.length > 0
        ? `{${options.excludes.join(',')}}`
        : '**/node_modules/**',
      maxResults: options.maxResults ?? 100,
      previewOptions: {
        matchLines: 1,
        charsPerLine: 200,
      },
      isRegex: options.useRegExp ?? false,
      isCaseSensitive: options.isCaseSensitive ?? false,
      isWordMatch: options.matchWholeWord ?? false,
    }

    // Create search query
    // @ts-ignore - TextSearchQuery may not be available in all VSCode versions
    const searchQuery = new (vscode as any).TextSearchQuery(query, searchOptions)

    // Perform the search using findTextInFiles
    const searchPromise = new Promise<SearchResult[]>((resolve) => {
      const tempResults: SearchResult[] = []

      // @ts-ignore - findTextInFiles may not be available in all VSCode versions
      const searchOperation = (vscode.workspace as any).findTextInFiles(
        searchQuery,
        (result: any) => {
          // Check if this is a text search match (not a complete event)
          if ('uri' in result && 'ranges' in result) {
            const ranges = result.ranges.map((range: any) => ({
              start: { line: range.start.line, character: range.start.character },
              end: { line: range.end.line, character: range.end.character },
            }))

            // Get preview text
            const preview = result.preview?.text?.trim() || ''

            tempResults.push({
              uri: result.uri.toString(),
              ranges,
              preview,
            })
          }
        },
        // Token for cancellation (undefined means no cancellation)
        undefined,
      )

      if (searchOperation && searchOperation.then) {
        searchOperation.then(
          (_complete: any) => {
            logger.info(`Search complete. Found ${tempResults.length} results`)
            resolve(tempResults)
          },
          (error: any) => {
            logger.error('Search failed:', error)
            resolve([])
          },
        )
      }
      else {
        // If findTextInFiles doesn't return a promise, resolve immediately
        setTimeout(() => resolve(tempResults), 100)
      }
    })

    const searchResults = await searchPromise
    logger.info(`Returning ${searchResults.length} search results`)
    return searchResults
  }
  catch (error) {
    logger.error('Text search failed', error)
    return []
  }
}
