import type { Response } from 'express'

// Token savings estimates (based on typical text search alternatives)
export const TOKEN_SAVINGS_ESTIMATES: Record<string, number> = {
  // LSP tools save tokens by avoiding text searches
  get_hover: 500,
  get_definition: 2000,
  get_references: 5000,
  find_implementations: 4000,
  get_completions: 1000,
  get_document_symbols: 3000,
  get_call_hierarchy: 6000,
  rename_symbol: 8000,
  get_code_actions: 1500,
  get_diagnostics: 2000,
  get_semantic_tokens: 1500,
  get_type_definition: 2000,
  find_symbols: 3000,
  find_text: 100,

  // Browser tools save tokens by avoiding complex DOM manipulation scripts
  execute_in_browser: 500,
  navigate_browser: 200,
  click_element: 300,
  type_in_browser: 300,
  get_dom_snapshot: 2000,
  take_screenshot: 100,
  wait_for_element: 200,
  get_browser_console: 1000,
  test_react_component: 3000,
  test_api_endpoint: 1500,
  test_form_validation: 2000,
  check_page_performance: 2500,
  debug_javascript_error: 3000,

  // System tools
  retrieve_buffer: 100,
  get_buffer_stats: 50,
  get_instructions: 50,
  get_supported_languages: 100,
}

interface ActivityEntry {
  timestamp: number
  method: string
  tool?: string
  status: 'success' | 'error'
  responseTime: number
}

interface RequestMetrics {
  totalRequests: number
  successCount: number
  errorCount: number
  responseTimeHistory: number[]
  toolUsage: Map<string, number>
  tokenSavings: Map<string, number>
  totalTokensSaved: number
  recentActivity: ActivityEntry[]
}

// Global metrics object
export const metrics: RequestMetrics = {
  totalRequests: 0,
  successCount: 0,
  errorCount: 0,
  responseTimeHistory: [],
  toolUsage: new Map(),
  tokenSavings: new Map(),
  totalTokensSaved: 0,
  recentActivity: [],
}

// Track server start time
export const serverStartTime = Date.now()

// SSE clients for real-time dashboard updates
export const dashboardClients = new Set<Response>()

// Track a successful tool call
export function trackToolCall(toolName: string, responseTime: number) {
  metrics.totalRequests++
  metrics.successCount++
  
  // Update response time history (keep last 100)
  metrics.responseTimeHistory.push(responseTime)
  if (metrics.responseTimeHistory.length > 100) {
    metrics.responseTimeHistory.shift()
  }
  
  // Update tool usage
  const currentUsage = metrics.toolUsage.get(toolName) || 0
  metrics.toolUsage.set(toolName, currentUsage + 1)
  
  // Update token savings
  const tokensSaved = TOKEN_SAVINGS_ESTIMATES[toolName] || 0
  const currentSavings = metrics.tokenSavings.get(toolName) || 0
  metrics.tokenSavings.set(toolName, currentSavings + tokensSaved)
  metrics.totalTokensSaved += tokensSaved
  
  // Add to recent activity (keep last 20)
  metrics.recentActivity.unshift({
    timestamp: Date.now(),
    method: 'tools/call',
    tool: toolName,
    status: 'success',
    responseTime,
  })
  if (metrics.recentActivity.length > 20) {
    metrics.recentActivity.pop()
  }
  
  // Broadcast update to dashboard clients
  broadcastMetrics()
}

// Track an error
export function trackError(toolName?: string, responseTime?: number) {
  metrics.totalRequests++
  metrics.errorCount++
  
  if (responseTime) {
    metrics.responseTimeHistory.push(responseTime)
    if (metrics.responseTimeHistory.length > 100) {
      metrics.responseTimeHistory.shift()
    }
  }
  
  // Add to recent activity
  metrics.recentActivity.unshift({
    timestamp: Date.now(),
    method: 'tools/call',
    tool: toolName,
    status: 'error',
    responseTime: responseTime || 0,
  })
  if (metrics.recentActivity.length > 20) {
    metrics.recentActivity.pop()
  }
  
  broadcastMetrics()
}

// Broadcast metrics update to all dashboard clients
export function broadcastMetrics() {
  const metricsData = getMetricsData()
  dashboardClients.forEach((client) => {
    try {
      client.write(`data: ${JSON.stringify(metricsData)}\n\n`)
    }
    catch (error) {
      // Client disconnected, remove from set
      dashboardClients.delete(client)
    }
  })
}

// Get formatted metrics data
export function getMetricsData() {
  const successRate = metrics.totalRequests > 0
    ? metrics.successCount / metrics.totalRequests
    : 1

  const avgResponseTime = metrics.responseTimeHistory.length > 0
    ? metrics.responseTimeHistory.reduce((a, b) => a + b, 0) / metrics.responseTimeHistory.length
    : 0

  // Get top 5 most used tools
  const popularTools = Array.from(metrics.toolUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Get top 5 token-saving tools
  const topTokenSavers = Array.from(metrics.tokenSavings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, saved]) => ({ name, saved }))

  return {
    totalRequests: metrics.totalRequests,
    successCount: metrics.successCount,
    errorCount: metrics.errorCount,
    successRate,
    avgResponseTime,
    activeConnections: dashboardClients.size,
    recentActivity: metrics.recentActivity,
    popularTools,
    topTokenSavers,
    totalTokensSaved: metrics.totalTokensSaved,
    tokenSavingsByTool: Object.fromEntries(metrics.tokenSavings),
    responseTimeHistory: metrics.responseTimeHistory.slice(-50),
    uptime: Date.now() - serverStartTime,
  }
}