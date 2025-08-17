/**
 * Experimental search implementation using various VSCode APIs
 */

import * as vscode from 'vscode'
import { logger } from '../utils'

export interface SearchResult {
  uri: string
  ranges: Array<{
    start: { line: number, character: number }
    end: { line: number, character: number }
  }>
  preview: string
}

/**
 * Try different search approaches to find one that works
 */
export async function searchWithFallback(
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
  logger.info(`Experimental search for: "${query}"`)

  // Approach 1: Try using vscode.workspace.findTextInFiles (if it exists in this version)
  try {
    const results = await searchUsingFindTextInFiles(query, options)
    if (results.length > 0) {
      logger.info(`findTextInFiles returned ${results.length} results`)
      return results
    }
  }
  catch (error) {
    logger.info('findTextInFiles approach failed:', error)
  }

  // Approach 2: Try using file search with content matching
  try {
    const results = await searchUsingFileSearch(query, options)
    if (results.length > 0) {
      logger.info(`File search returned ${results.length} results`)
      return results
    }
  }
  catch (error) {
    logger.info('File search approach failed:', error)
  }

  // Approach 3: Try using ripgrep if available
  try {
    const results = await searchUsingRipgrep(query, options)
    if (results.length > 0) {
      logger.info(`Ripgrep search returned ${results.length} results`)
      return results
    }
  }
  catch (error) {
    logger.info('Ripgrep approach failed:', error)
  }

  logger.warn('All search approaches failed')
  return []
}

async function searchUsingFindTextInFiles(query: string, options: any): Promise<SearchResult[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return []
  }

  // Build the search query
  // @ts-ignore - TextSearchQuery may not be available in all VSCode versions
  const searchQuery = new (vscode as any).TextSearchQuery(query, {
    isRegexp: options.useRegExp ?? false,
    isCaseSensitive: options.isCaseSensitive ?? false,
    isWordMatch: options.matchWholeWord ?? false,
  })

  // Build search options
  // @ts-ignore - TextSearchOptions may not be available in all VSCode versions
  const searchOptions: any = {
    folder: workspaceFolders[0].uri,
    include: options.includes && options.includes.length > 0
      ? new vscode.RelativePattern(workspaceFolders[0], `{${options.includes.join(',')}}`)
      : undefined,
    exclude: options.excludes && options.excludes.length > 0
      ? `{${options.excludes.join(',')}}`
      : '**/node_modules/**',
    maxResults: options.maxResults ?? 100,
    previewOptions: {
      matchLines: 1,
      charsPerLine: 200,
    },
  }

  // Create a promise to collect results
  return new Promise((resolve) => {
    const tempResults: SearchResult[] = []
    let searchComplete = false

    // Use the search API
    // @ts-ignore - findTextInFiles may not be available in all VSCode versions
    const search = (vscode.workspace as any).findTextInFiles(
      searchQuery,
      searchOptions,
      (result: any) => {
        if ('uri' in result && 'ranges' in result) {
          const ranges = result.ranges.map((range: any) => ({
            start: { line: range.start.line, character: range.start.character },
            end: { line: range.end.line, character: range.end.character },
          }))

          const preview = result.preview?.text?.trim() || ''

          tempResults.push({
            uri: result.uri.toString(),
            ranges,
            preview,
          })
        }
      },
      undefined, // cancellation token
    )

    // Handle the promise completion
    search.then(
      (_complete: any) => {
        logger.info(`Search completed with ${tempResults.length} results`)
        searchComplete = true
        resolve(tempResults)
      },
      (error: any) => {
        logger.error('Search error:', error)
        resolve(tempResults) // Return what we have
      },
    )

    // Timeout fallback
    setTimeout(() => {
      if (!searchComplete) {
        logger.warn('Search timed out, returning partial results')
        resolve(tempResults)
      }
    }, 5000)
  })
}

async function searchUsingFileSearch(query: string, options: any): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  // Get all text files in workspace
  const includePattern = options.includes && options.includes.length > 0
    ? `{${options.includes.join(',')}}`
    : '**/*.{ts,tsx,js,jsx,json,md,txt,py,java,cpp,c,h,hpp,cs,go,rs,rb,php,swift,kt,scala,r,m,mm,yaml,yml,xml,html,css,scss,less,sql,sh,bash,zsh,fish,ps1,psm1,psd1,bat,cmd}'

  const excludePattern = options.excludes && options.excludes.length > 0
    ? `{${options.excludes.join(',')}}`
    : '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/*.min.js,**/*.map}'

  const files = await vscode.workspace.findFiles(includePattern, excludePattern, 500)

  logger.info(`Found ${files.length} files to search`)

  // Build search pattern
  let searchRegex: RegExp
  if (options.useRegExp) {
    searchRegex = new RegExp(query, options.isCaseSensitive ? 'gm' : 'gim')
  }
  else {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const wordBoundary = options.matchWholeWord ? '\\b' : ''
    searchRegex = new RegExp(
      `${wordBoundary}${escaped}${wordBoundary}`,
      options.isCaseSensitive ? 'gm' : 'gim',
    )
  }

  // Search through files
  for (const file of files) {
    if (results.length >= (options.maxResults ?? 100)) {
      break
    }

    try {
      const document = await vscode.workspace.openTextDocument(file)
      const text = document.getText()

      // Skip very large files
      if (text.length > 500000) {
        continue
      }

      const matches: any[] = []
      let match: RegExpExecArray | null

      searchRegex.lastIndex = 0 // Reset regex
      // eslint-disable-next-line no-cond-assign
      while ((match = searchRegex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index)
        const endPos = document.positionAt(match.index + match[0].length)

        matches.push({
          start: { line: startPos.line, character: startPos.character },
          end: { line: endPos.line, character: endPos.character },
        })

        if (matches.length >= 10)
          break // Limit per file
      }

      if (matches.length > 0) {
        const firstMatch = matches[0]
        const line = document.lineAt(firstMatch.start.line)

        results.push({
          uri: file.toString(),
          ranges: matches,
          preview: line.text.trim(),
        })
      }
    }
    catch {
      // Skip files that can't be opened
      continue
    }
  }

  return results
}

async function searchUsingRipgrep(_query: string, _options: any): Promise<SearchResult[]> {
  // This would require executing ripgrep as a child process
  // For now, return empty as this is just a placeholder
  return []
}
