/**
 * Utility functions for LSP tools
 */

/**
 * Convert parameters to correct types for VSCode API
 * MCP sometimes passes numbers as strings, but VSCode expects actual numbers
 * Also converts from 1-indexed lines (user-friendly) to 0-indexed (VSCode internal)
 */
export function normalizeParams(params: any): any {
  const normalized = { ...params }

  // Convert line and character to numbers if they're strings
  if (typeof normalized.line === 'string') {
    normalized.line = Number.parseInt(normalized.line, 10)
  }
  if (typeof normalized.character === 'string') {
    normalized.character = Number.parseInt(normalized.character, 10)
  }
  if (typeof normalized.maxResults === 'string') {
    normalized.maxResults = Number.parseInt(normalized.maxResults, 10)
  }
  if (typeof normalized.limit === 'string') {
    normalized.limit = Number.parseInt(normalized.limit, 10)
  }
  if (typeof normalized.offset === 'string') {
    normalized.offset = Number.parseInt(normalized.offset, 10)
  }

  // Convert from 1-indexed to 0-indexed for line numbers
  // Line numbers from users are 1-indexed (line 1 is the first line)
  // VSCode APIs expect 0-indexed (line 0 is the first line)
  if (typeof normalized.line === 'number' && normalized.line > 0) {
    normalized.line = normalized.line - 1
  }

  return normalized
}
