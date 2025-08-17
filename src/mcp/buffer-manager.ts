/**
 * MCP Buffer System - Manages response buffering and size detection
 * Phase 1: Basic buffering and size detection
 */

import { logger } from '../utils'

export interface BufferedResponse {
  metadata: {
    totalTokens: number
    totalBytes: number
    itemCount: number
    maxDepth: number
    truncatedAtDepth?: number
    wouldExceedLimit: boolean
  }
  preview?: any // Small sample of actual data
  bufferId?: string // ID to retrieve full results if needed
  suggestions?: string[] // Refinement suggestions
  _instructions?: string // Instructions for AI assistants handling this response
}

export interface BufferConfig {
  maxTokensPerResponse: number // Default: 2500
  enableBuffering: boolean // Default: true
  bufferTTL: number // Buffer expiry in ms, default: 60000
  autoTruncate: boolean // Auto-truncate without asking
  defaultMaxDepth: number // Default max depth for truncation
}

// Default configuration - much more reasonable limits
const DEFAULT_CONFIG: BufferConfig = {
  maxTokensPerResponse: 2500, // ~10KB of JSON - plenty for most responses
  enableBuffering: true,
  bufferTTL: 60000,
  autoTruncate: false,
  defaultMaxDepth: 4, // Reasonable default depth
}

// Tool-specific depth limits for automatic truncation
const TOOL_DEPTH_LIMITS: { [toolName: string]: number } = {
  search_text: 2, // Shallow for search results
  get_document_symbols: 4, // Deeper for code structure
  get_references: 3, // Medium depth
  get_completions: 3, // Medium depth
  get_call_hierarchy: 3, // Medium depth
  get_hover: 3, // Medium depth
  get_definition: 2, // Shallow, usually simple
  get_implementations: 3, // Medium depth
}

// Store for buffered responses
const responseBuffers = new Map<string, {
  data: any
  timestamp: number
  metadata: BufferedResponse['metadata']
}>()

// Cleanup expired buffers periodically
const bufferCleanupInterval = setInterval(() => {
  const now = Date.now()
  let expiredCount = 0

  for (const [id, buffer] of responseBuffers.entries()) {
    if (now - buffer.timestamp > DEFAULT_CONFIG.bufferTTL) {
      responseBuffers.delete(id)
      expiredCount++
      logger.info(`Expired buffer ${id}`)
    }
  }

  // Log cleanup summary if any buffers were removed
  if (expiredCount > 0) {
    logger.info(`Buffer cleanup: removed ${expiredCount} expired buffers, ${responseBuffers.size} remaining`)
  }
}, 30000) // Check every 30 seconds

// Make interval non-blocking for Node.js shutdown
bufferCleanupInterval.unref?.()

// Maximum buffers to keep (prevent unlimited growth)
const MAX_BUFFERS = 100
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB max total buffer size

/**
 * Enforce buffer limits to prevent memory exhaustion
 */
function enforceBufferLimits(newBufferSize: number) {
  // Check total buffer count
  if (responseBuffers.size >= MAX_BUFFERS) {
    // Remove oldest buffer
    const oldestId = findOldestBuffer()
    if (oldestId) {
      responseBuffers.delete(oldestId)
      logger.warn(`Buffer limit reached (${MAX_BUFFERS}), removed oldest buffer: ${oldestId}`)
    }
  }

  // Check total size
  let totalSize = newBufferSize
  for (const buffer of responseBuffers.values()) {
    totalSize += buffer.metadata.totalBytes
  }

  // If exceeding size limit, remove oldest buffers until within limit
  while (totalSize > MAX_TOTAL_SIZE && responseBuffers.size > 0) {
    const oldestId = findOldestBuffer()
    if (oldestId) {
      const removed = responseBuffers.get(oldestId)
      if (removed) {
        totalSize -= removed.metadata.totalBytes
        responseBuffers.delete(oldestId)
        logger.warn(`Total buffer size exceeded (${Math.round(totalSize / 1024 / 1024)}MB), removed buffer: ${oldestId}`)
      }
    }
    else {
      break
    }
  }
}

/**
 * Find the oldest buffer ID
 */
function findOldestBuffer(): string | undefined {
  let oldestId: string | undefined
  let oldestTime = Date.now()

  for (const [id, buffer] of responseBuffers.entries()) {
    if (buffer.timestamp < oldestTime) {
      oldestTime = buffer.timestamp
      oldestId = id
    }
  }

  return oldestId
}

/**
 * Export cleanup function for proper shutdown
 */
export function cleanupBuffers() {
  clearInterval(bufferCleanupInterval)
  responseBuffers.clear()
  logger.info('Buffer manager cleanup completed')
}

/**
 * Estimate token count for any data structure
 * Rule of thumb: ~4 characters per token
 */
export function estimateTokens(data: any): number {
  try {
    const jsonString = JSON.stringify(data)
    return Math.ceil(jsonString.length / 4)
  }
  catch (error) {
    logger.error('Failed to estimate tokens:', error)
    return 0
  }
}

/**
 * Calculate the depth of a data structure
 */
export function calculateDepth(obj: any, currentDepth = 0): number {
  if (obj === null || obj === undefined) {
    return currentDepth
  }

  if (typeof obj !== 'object') {
    return currentDepth
  }

  let maxDepth = currentDepth

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const depth = calculateDepth(item, currentDepth + 1)
      maxDepth = Math.max(maxDepth, depth)
    }
  }
  else {
    for (const value of Object.values(obj)) {
      const depth = calculateDepth(value, currentDepth + 1)
      maxDepth = Math.max(maxDepth, depth)
    }
  }

  return maxDepth
}

/**
 * Count items in a data structure
 */
export function countItems(data: any): number {
  if (Array.isArray(data)) {
    return data.length
  }
  if (typeof data === 'object' && data !== null) {
    return Object.keys(data).length
  }
  return 1
}

/**
 * Truncate data structure to a maximum depth
 * Phase 2: Depth truncation system
 */
export function truncateDepth(obj: any, maxDepth: number, currentDepth = 0): any {
  // If we've reached the max depth, return a summary
  if (currentDepth >= maxDepth) {
    if (Array.isArray(obj)) {
      return `[Array: ${obj.length} items, truncated at depth ${currentDepth}]`
    }
    if (typeof obj === 'object' && obj !== null) {
      const keys = Object.keys(obj)
      return `[Object: ${keys.length} properties (${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}), truncated at depth ${currentDepth}]`
    }
    return obj
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => truncateDepth(item, maxDepth, currentDepth + 1))
  }

  // Handle objects
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = truncateDepth(value, maxDepth, currentDepth + 1)
  }
  return result
}

/**
 * Generate smart preview for different data types
 * Phase 3: Smart preview generation
 */
function generateSmartPreview(
  data: any,
  toolName: string,
  maxItems = 3,
): any {
  // For search results, show diverse samples
  if (toolName === 'search_text' && Array.isArray(data)) {
    if (data.length <= maxItems) {
      return data
    }

    // Get first, middle, and last items for better representation
    const preview = []
    preview.push(data[0]) // First result

    if (data.length > 2) {
      const middleIndex = Math.floor(data.length / 2)
      preview.push(data[middleIndex]) // Middle result

      if (data.length > 3) {
        preview.push(data[data.length - 1]) // Last result
      }
    }
    else if (data.length === 2) {
      preview.push(data[1])
    }

    // Add sample indicator
    return {
      samples: preview,
      totalCount: data.length,
      distribution: 'first, middle, last',
    }
  }

  // For document symbols, show top-level items preferentially
  if (toolName === 'get_document_symbols' && Array.isArray(data)) {
    const topLevel = data.filter((item: any) =>
      !item.containerName && item.kind !== undefined,
    ).slice(0, maxItems)

    if (topLevel.length > 0) {
      return {
        topLevelSymbols: topLevel,
        totalSymbols: data.length,
        note: 'Showing top-level symbols only',
      }
    }
  }

  // For references/implementations, group by file
  if ((toolName === 'get_references' || toolName === 'get_implementations') && Array.isArray(data)) {
    const byFile: { [key: string]: any[] } = {}

    for (const item of data) {
      const uri = item.uri || item.file || 'unknown'
      const fileName = uri.split('/').pop() || uri

      if (!byFile[fileName]) {
        byFile[fileName] = []
      }
      byFile[fileName].push(item)
    }

    const fileNames = Object.keys(byFile)
    const preview = {
      fileCount: fileNames.length,
      totalReferences: data.length,
      fileDistribution: {} as any,
    }

    // Show first few files with counts
    fileNames.slice(0, maxItems).forEach((fileName) => {
      preview.fileDistribution[fileName] = {
        count: byFile[fileName].length,
        firstReference: byFile[fileName][0],
      }
    })

    if (fileNames.length > maxItems) {
      preview.fileDistribution['...'] = `${fileNames.length - maxItems} more files`
    }

    return preview
  }

  // For completions, categorize by kind
  if (toolName === 'get_completions' && Array.isArray(data)) {
    const byKind: { [key: string]: any[] } = {}
    const kindNames: { [key: number]: string } = {
      0: 'Text',
      1: 'Method',
      2: 'Function',
      3: 'Constructor',
      4: 'Field',
      5: 'Variable',
      6: 'Class',
      7: 'Interface',
      8: 'Module',
      9: 'Property',
      10: 'Unit',
      11: 'Value',
      12: 'Enum',
      13: 'Keyword',
      14: 'Snippet',
      15: 'Color',
      16: 'File',
      17: 'Reference',
    }

    for (const item of data) {
      const kindName = kindNames[item.kind] || 'Other'
      if (!byKind[kindName]) {
        byKind[kindName] = []
      }
      byKind[kindName].push(item)
    }

    const preview = {
      totalCompletions: data.length,
      byCategory: {} as any,
      topSuggestions: data.slice(0, maxItems),
    }

    Object.keys(byKind).forEach((kind) => {
      preview.byCategory[kind] = {
        count: byKind[kind].length,
        examples: byKind[kind].slice(0, 2).map((item: any) => item.label),
      }
    })

    return preview
  }

  // Default behavior for arrays
  if (Array.isArray(data)) {
    if (data.length <= maxItems) {
      return data
    }
    return {
      firstItems: data.slice(0, maxItems),
      totalCount: data.length,
    }
  }

  // Default behavior for objects
  if (typeof data === 'object' && data !== null) {
    const entries = Object.entries(data)
    if (entries.length <= maxItems) {
      return data
    }

    const preview = Object.fromEntries(entries.slice(0, maxItems))
    return {
      ...preview,
      _truncated: `${entries.length - maxItems} more properties`,
    }
  }

  return data
}

/**
 * Generate a unique buffer ID
 */
function generateBufferId(toolName: string): string {
  return `${toolName}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Buffer a response and analyze its size
 */
export function bufferResponse(
  toolName: string,
  data: any,
  config: Partial<BufferConfig> = {},
): BufferedResponse | any {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  if (!finalConfig.enableBuffering) {
    return data
  }

  // Calculate metadata
  const tokens = estimateTokens(data)
  const bytes = JSON.stringify(data).length
  const depth = calculateDepth(data)
  const itemCount = countItems(data)
  const wouldExceedLimit = tokens > finalConfig.maxTokensPerResponse

  const metadata: BufferedResponse['metadata'] = {
    totalTokens: tokens,
    totalBytes: bytes,
    itemCount,
    maxDepth: depth,
    wouldExceedLimit,
  }

  logger.info(`Buffering ${toolName} response:`, {
    tokens,
    bytes,
    depth,
    itemCount,
    exceedsLimit: wouldExceedLimit,
  })

  // Determine if we need to buffer or truncate
  const needsBuffering = wouldExceedLimit
  const toolDepthLimit = TOOL_DEPTH_LIMITS[toolName] ?? finalConfig.defaultMaxDepth
  const needsDepthTruncation = depth > toolDepthLimit

  // If within all limits, return original data
  if (!needsBuffering && !needsDepthTruncation && !finalConfig.autoTruncate) {
    return data
  }

  // Store the full original data if buffering
  let bufferId: string | undefined
  if (needsBuffering) {
    bufferId = generateBufferId(toolName)

    // Enforce buffer limits to prevent memory exhaustion
    enforceBufferLimits(bytes)

    responseBuffers.set(bufferId, {
      data,
      timestamp: Date.now(),
      metadata,
    })
  }

  // Apply depth truncation for preview or direct response
  let processedData = data
  if (needsDepthTruncation || needsBuffering) {
    processedData = truncateDepth(data, toolDepthLimit)
    metadata.truncatedAtDepth = toolDepthLimit
  }

  // If we're not buffering (just truncating), return the truncated data directly
  if (!needsBuffering) {
    logger.info(`Applied depth truncation to ${toolName} (depth ${depth} -> ${toolDepthLimit})`)
    return processedData
  }

  // Create smart preview for buffered response
  const preview = generateSmartPreview(processedData, toolName, 3)

  // Generate suggestions based on the tool and data
  const suggestions = generateRefinementSuggestions(toolName, data, metadata)

  // Return buffered response with instructions
  const response: BufferedResponse = {
    metadata,
    preview,
    bufferId,
    suggestions,
    _instructions: `This response was buffered to prevent token overflow. `
      + `The preview contains a smart summary of ${metadata.itemCount} items. `
      + `To access the complete data, use the retrieve_buffer tool with bufferId: "${bufferId}". `
      + `The data was ${metadata.truncatedAtDepth ? `truncated at depth ${metadata.truncatedAtDepth}` : 'depth-limited'} to fit within ${finalConfig.maxTokensPerResponse} tokens.`,
  }

  return response
}

/**
 * Retrieve buffered data by ID
 */
export function retrieveBuffer(bufferId: string): any | null {
  const buffer = responseBuffers.get(bufferId)
  if (!buffer) {
    logger.warn(`Buffer ${bufferId} not found`)
    return null
  }

  // Update timestamp to prevent expiry during use
  buffer.timestamp = Date.now()

  return buffer.data
}

/**
 * Generate refinement suggestions based on the response
 */
function generateRefinementSuggestions(
  toolName: string,
  _data: any,
  metadata: BufferedResponse['metadata'],
): string[] {
  const suggestions: string[] = []

  // Tool-specific suggestions with more reasonable thresholds
  switch (toolName) {
    case 'search_text':
      if (metadata.itemCount > 20) {
        suggestions.push('Add file type filter (e.g., includes: ["**/*.ts"])')
        suggestions.push('Limit to specific directories')
        suggestions.push(`Reduce maxResults (current: ${metadata.itemCount} matches)`)
      }
      if (metadata.totalTokens > 2000) {
        suggestions.push('Use more specific search terms')
        suggestions.push('Enable matchWholeWord option')
      }
      break

    case 'get_references':
      if (metadata.itemCount > 30) {
        suggestions.push('Symbol may be too common, consider refactoring')
        suggestions.push('Filter by file type or directory')
      }
      break

    case 'get_document_symbols':
      if (metadata.maxDepth > 4) {
        suggestions.push('File has deep nesting, consider focusing on top-level symbols')
        suggestions.push('Use search_text for specific symbol names')
      }
      break

    case 'get_completions':
      if (metadata.itemCount > 50) {
        suggestions.push('Too many completions, type more characters')
        suggestions.push('Use more specific context')
      }
      break
  }

  // General suggestions
  if (metadata.wouldExceedLimit) {
    suggestions.push(`Response exceeds token limit (${metadata.totalTokens} tokens)`)
    suggestions.push('Consider breaking into smaller queries')
  }

  return suggestions
}

/**
 * Check if buffering is needed for a response
 */
export function shouldBuffer(
  data: any,
  config: Partial<BufferConfig> = {},
): boolean {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  if (!finalConfig.enableBuffering) {
    return false
  }

  const tokens = estimateTokens(data)
  return tokens > finalConfig.maxTokensPerResponse
}

/**
 * Get buffer statistics
 */
export function getBufferStats(): {
  activeBuffers: number
  totalSize: number
  oldestBuffer: number | null
} {
  let totalSize = 0
  let oldestTimestamp: number | null = null

  for (const buffer of responseBuffers.values()) {
    totalSize += buffer.metadata.totalBytes
    if (!oldestTimestamp || buffer.timestamp < oldestTimestamp) {
      oldestTimestamp = buffer.timestamp
    }
  }

  return {
    activeBuffers: responseBuffers.size,
    totalSize,
    oldestBuffer: oldestTimestamp ? Date.now() - oldestTimestamp : null,
  }
}

/**
 * Clear all buffers
 */
export function clearAllBuffers(): void {
  responseBuffers.clear()
  logger.info('Cleared all response buffers')
}

/**
 * Configure buffer system
 */
let currentConfig = DEFAULT_CONFIG

export function configureBufferSystem(config: Partial<BufferConfig>): void {
  currentConfig = { ...currentConfig, ...config }
  logger.info('Buffer system configured:', currentConfig)
}

export function getBufferConfig(): BufferConfig {
  return { ...currentConfig }
}
