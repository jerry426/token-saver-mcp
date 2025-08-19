import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import { Uri, window, workspace } from 'vscode'
import { logger } from '../utils'
import { cleanupBuffers } from './buffer-manager'
import { registerSimpleRestEndpoints } from './simple-rest'
// Import new modular tool registry
import { registerAllTools } from './tools/index'

// Map to store transports by session ID with metadata
interface SessionInfo {
  transport: StreamableHTTPServerTransport
  createdAt: number
  lastActivity: number
}

const sessions: { [sessionId: string]: SessionInfo } = {}

// Session management constants
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000 // Check every 5 minutes
const SESSION_MAX_IDLE_TIME = 30 * 60 * 1000 // 30 minutes idle timeout
const SESSION_MAX_AGE = 2 * 60 * 60 * 1000 // 2 hours maximum age

// Cleanup dead sessions periodically
function cleanupDeadSessions() {
  const now = Date.now()
  for (const [sessionId, sessionInfo] of Object.entries(sessions)) {
    const age = now - sessionInfo.createdAt
    const idleTime = now - sessionInfo.lastActivity

    if (age > SESSION_MAX_AGE || idleTime > SESSION_MAX_IDLE_TIME) {
      logger.info(`Cleaning up inactive session: ${sessionId} (age: ${Math.round(age / 1000)}s, idle: ${Math.round(idleTime / 1000)}s)`)

      // Close the transport if it has a close method
      if (sessionInfo.transport.close) {
        sessionInfo.transport.close()
      }

      delete sessions[sessionId]
    }
  }
}

// Start cleanup timer
let cleanupTimer: NodeJS.Timeout | null = null

// Track the current port globally
let currentPort: number = 0

// Token savings estimates (based on typical text search alternatives)
const TOKEN_SAVINGS_ESTIMATES: Record<string, number> = {
  // LSP tools save tokens by avoiding text searches
  get_hover: 500, // Avoids reading entire file to understand types
  get_definition: 2000, // Avoids searching entire codebase for definition
  get_references: 5000, // Avoids grep through entire codebase
  get_implementations: 4000, // Avoids complex searches for implementations
  get_completions: 1000, // Avoids listing all possible completions manually
  get_document_symbols: 3000, // Avoids parsing entire file structure
  get_call_hierarchy: 6000, // Avoids tracing through multiple files
  rename_symbol: 8000, // Avoids finding and editing all occurrences
  get_code_actions: 1500, // Avoids analyzing code for fixes
  get_diagnostics: 2000, // Avoids reading error outputs
  get_semantic_tokens: 1500, // Avoids parsing syntax manually
  get_type_definition: 2000, // Avoids searching for type definitions
  find_implementations: 4000, // Avoids searching for all implementations
  search_text: 100, // Still saves some tokens with better formatting

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

// Metrics tracking
interface RequestMetrics {
  totalRequests: number
  successCount: number
  errorCount: number
  responseTimeHistory: number[]
  toolUsage: Map<string, number>
  tokenSavings: Map<string, number> // Track token savings per tool
  totalTokensSaved: number // Total tokens saved
  recentActivity: Array<{
    timestamp: number
    method: string
    tool?: string
    status: string
    responseTime?: number
    tokensSaved?: number
  }>
}

const metrics: RequestMetrics = {
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
const serverStartTime = Date.now()

// SSE clients for real-time dashboard updates
const dashboardClients = new Set<express.Response>()

// Broadcast metrics update to all dashboard clients
function broadcastMetrics() {
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
function getMetricsData() {
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
    successRate,
    avgResponseTime,
    activeConnections: sessions ? Object.keys(sessions).length : 0,
    errorCount: metrics.errorCount,
    recentActivity: metrics.recentActivity.slice(-10),
    popularTools,
    topTokenSavers,
    totalTokensSaved: metrics.totalTokensSaved,
    tokenSavingsByTool: Object.fromEntries(metrics.tokenSavings),
    responseTimeHistory: metrics.responseTimeHistory.slice(-50),
    uptime: Date.now() - serverStartTime,
  }
}

// Get dashboard HTML as a string
function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Token Saver MCP - Developer Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        
        @media (max-width: 1200px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
            .card.full-width {
                grid-column: 1;
            }
        }
        
        .card.full-width {
            grid-column: 1 / -1;
        }
        
        .card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        .card h2 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.3em;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
        
        .status-active {
            background: #10b981;
        }
        
        .status-inactive {
            background: #ef4444;
        }
        
        .status-warning {
            background: #f59e0b;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .metric:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        
        .metric-value {
            color: #333;
            font-weight: bold;
            font-family: 'Courier New', monospace;
        }
        
        .activity-log {
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
        }
        
        .log-entry {
            padding: 4px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .log-time {
            color: #666;
            margin-right: 10px;
        }
        
        .log-method {
            color: #667eea;
            font-weight: bold;
        }
        
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            transition: background 0.3s ease;
        }
        
        .refresh-btn:hover {
            background: #5a67d8;
        }
        
        .error-message {
            background: #fee;
            color: #c00;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
        
        .tools-grid, #tools-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 8px;
            margin-top: 15px;
        }
        
        @media (max-width: 768px) {
            .tools-grid, #tools-list {
                grid-template-columns: 1fr;
            }
        }
        
        .tool-badge {
            background: #f0f0f0;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 0.8em;
            min-height: 32px;
            transition: all 0.2s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 4px;
            border: 1px solid transparent;
        }
        
        .tool-badge:hover {
            background: #e5e5e5;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .tool-badge.lsp {
            background: #e0f2fe;
            color: #0369a1;
            border-color: #bae6fd;
        }
        
        .tool-badge.lsp:hover {
            background: #bae6fd;
            border-color: #7dd3fc;
        }
        
        .tool-badge.cdp {
            background: #fef3c7;
            color: #92400e;
            border-color: #fde68a;
        }
        
        .tool-badge.cdp:hover {
            background: #fde68a;
            border-color: #fde047;
        }
        
        .token-badge {
            background: rgba(0, 0, 0, 0.1);
            padding: 2px 6px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: bold;
            margin-left: 4px;
        }
        
        .chart-container {
            height: 200px;
            margin-top: 15px;
            position: relative;
        }
        
        .workspace-info {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
        
        .workspace-path {
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #666;
            word-break: break-all;
        }
        
        .token-savings {
            color: #10b981;
            font-weight: bold;
            font-size: 1.2em;
        }
        
        .token-badge {
            background: #d1fae5;
            color: #065f46;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.75em;
            margin-left: 4px;
            font-weight: bold;
        }
        
        .savings-breakdown {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }
        
        .savings-item {
            background: #f0fdf4;
            padding: 8px;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .savings-label {
            color: #14532d;
            font-size: 0.85em;
        }
        
        .savings-value {
            color: #10b981;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Token Saver MCP Dashboard</h1>
        
        <div class="dashboard">
            <!-- Server Status Card -->
            <div class="card">
                <h2>Server Status</h2>
                <div class="metric">
                    <span class="metric-label">Status</span>
                    <span class="metric-value">
                        <span class="status-indicator status-active"></span>
                        <span id="server-status">Active</span>
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">Port</span>
                    <span class="metric-value" id="server-port">9527</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value" id="server-uptime">0h 0m</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Mode</span>
                    <span class="metric-value" id="server-mode">Sessionless</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Version</span>
                    <span class="metric-value" id="version-info">v1.0.2</span>
                </div>
                <div id="update-notification" style="display: none; margin-top: 10px; padding: 8px; background: #fef3c7; border-radius: 5px; font-size: 0.85em;">
                    🎉 <strong>Update Available!</strong> 
                    <a href="#" id="update-link" target="_blank" style="color: #92400e;">View Release</a>
                </div>
                <div class="workspace-info">
                    <div class="metric-label">Workspace</div>
                    <div class="workspace-path" id="workspace-path">Loading...</div>
                </div>
            </div>
            
            <!-- Request Metrics Card -->
            <div class="card">
                <h2>Request Metrics</h2>
                <div class="metric">
                    <span class="metric-label">Total Requests</span>
                    <span class="metric-value" id="total-requests">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Success Rate</span>
                    <span class="metric-value" id="success-rate">100%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Avg Response Time</span>
                    <span class="metric-value" id="avg-response-time">0ms</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Active Connections</span>
                    <span class="metric-value" id="active-connections">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Errors (24h)</span>
                    <span class="metric-value" id="error-count">0</span>
                </div>
                <button class="refresh-btn" onclick="refreshMetrics()">Refresh</button>
            </div>
            
            <!-- Token Savings Card -->
            <div class="card">
                <h2>💎 Token Savings</h2>
                <div class="metric">
                    <span class="metric-label">Total Tokens Saved</span>
                    <span class="metric-value token-savings" id="total-tokens-saved">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Avg Savings per Call</span>
                    <span class="metric-value" id="avg-tokens-per-call">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Estimated Cost Saved</span>
                    <span class="metric-value" id="cost-saved">$0.00</span>
                </div>
                <div id="top-savers" class="savings-breakdown">
                    <!-- Top token-saving tools will be shown here -->
                </div>
            </div>
            
            <!-- Available Tools Card (Full Width) -->
            <div class="card full-width">
                <h2>Available Tools</h2>
                <div style="display: flex; gap: 20px; margin-bottom: 10px;">
                    <div class="metric" style="flex: 0;">
                        <span class="metric-label">LSP Tools:</span>
                        <span class="metric-value" id="lsp-tool-count">13</span>
                    </div>
                    <div class="metric" style="flex: 0;">
                        <span class="metric-label">CDP Tools:</span>
                        <span class="metric-value" id="cdp-tool-count">13</span>
                    </div>
                    <div class="metric" style="flex: 0;">
                        <span class="metric-label">System Tools:</span>
                        <span class="metric-value" id="system-tool-count">4</span>
                    </div>
                </div>
                <div class="tools-grid" id="tools-list">
                    <!-- Tools will be populated here -->
                </div>
            </div>
            
            <!-- Recent Activity Card -->
            <div class="card">
                <h2>Recent Activity</h2>
                <div class="activity-log" id="activity-log">
                    <!-- Activity entries will be added here -->
                </div>
            </div>
            
            <!-- Performance Chart Card -->
            <div class="card">
                <h2>Response Time (Last 50 requests)</h2>
                <div class="chart-container">
                    <canvas id="performance-chart"></canvas>
                </div>
            </div>
            
            <!-- Popular Tools Card -->
            <div class="card">
                <h2>Most Used Tools (24h)</h2>
                <div id="popular-tools">
                    <!-- Will be populated with tool usage stats -->
                </div>
            </div>
        </div>
    </div>
    
    <script>
        let eventSource = null;
        let startTime = Date.now();
        let responseTimeHistory = [];
        
        async function fetchMetrics() {
            try {
                const response = await fetch('/metrics');
                const data = await response.json();
                updateDashboard(data);
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
                document.getElementById('server-status').textContent = 'Error';
                document.querySelector('.status-indicator').className = 'status-indicator status-inactive';
            }
        }
        
        async function fetchWorkspaceInfo() {
            try {
                const response = await fetch('/workspace-info');
                const data = await response.json();
                document.getElementById('workspace-path').textContent = data.workspacePath || 'No workspace';
                document.getElementById('server-port').textContent = data.port || '9527';
            } catch (error) {
                console.error('Failed to fetch workspace info:', error);
            }
        }
        
        async function fetchTools() {
            try {
                const response = await fetch('/available-tools');
                const data = await response.json();
                
                const toolsList = document.getElementById('tools-list');
                toolsList.innerHTML = '';
                
                data.tools.forEach(tool => {
                    const badge = document.createElement('div');
                    badge.className = \`tool-badge \${tool.category}\`;
                    badge.innerHTML = \`
                        <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${tool.name}</span>
                        <span style="display: flex; align-items: center; flex-shrink: 0;">
                            \${tool.callCount > 0 ? \`<span style="font-weight: bold;">(\${tool.callCount})</span>\` : ''}
                            \${tool.tokensSaved > 0 ? \`<span class="token-badge">\${tool.tokensSaved.toLocaleString()}tk</span>\` : ''}
                        </span>
                    \`;
                    badge.style.display = 'flex';
                    badge.style.justifyContent = 'space-between';
                    badge.style.alignItems = 'center';
                    badge.style.gap = '8px';
                    badge.title = \`\${tool.name} - Estimated \${tool.estimatedSavingsPerCall} tokens saved per call\`;
                    toolsList.appendChild(badge);
                });
                
                // Update token savings display
                if (data.totalTokensSaved !== undefined) {
                    document.getElementById('total-tokens-saved').textContent = 
                        data.totalTokensSaved.toLocaleString();
                }
                
                document.getElementById('lsp-tool-count').textContent = 
                    data.tools.filter(t => t.category === 'lsp').length;
                document.getElementById('cdp-tool-count').textContent = 
                    data.tools.filter(t => t.category === 'cdp').length;
                document.getElementById('system-tool-count').textContent = 
                    data.tools.filter(t => t.category === 'system').length;
            } catch (error) {
                console.error('Failed to fetch tools:', error);
            }
        }
        
        function updateDashboard(data) {
            // Update metrics
            document.getElementById('total-requests').textContent = data.totalRequests || 0;
            document.getElementById('success-rate').textContent = 
                Math.round((data.successRate || 0) * 100) + '%';
            document.getElementById('avg-response-time').textContent = 
                Math.round(data.avgResponseTime || 0) + 'ms';
            document.getElementById('active-connections').textContent = data.activeConnections || 0;
            document.getElementById('error-count').textContent = data.errorCount || 0;
            
            // Update uptime
            const uptime = Date.now() - startTime;
            const hours = Math.floor(uptime / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            document.getElementById('server-uptime').textContent = \`\${hours}h \${minutes}m\`;
            
            // Update activity log
            if (data.recentActivity) {
                const logContainer = document.getElementById('activity-log');
                logContainer.innerHTML = data.recentActivity.map(entry => \`
                    <div class="log-entry">
                        <span class="log-time">\${new Date(entry.timestamp).toLocaleTimeString()}</span>
                        <span class="log-method">\${entry.method}</span>
                        \${entry.tool ? \`<span>\${entry.tool}</span>\` : ''}
                        <span>\${entry.status}</span>
                    </div>
                \`).join('');
            }
            
            // Update popular tools
            if (data.popularTools) {
                const popularTools = document.getElementById('popular-tools');
                popularTools.innerHTML = data.popularTools.map((tool, index) => \`
                    <div class="metric">
                        <span class="metric-label">\${index + 1}. \${tool.name}</span>
                        <span class="metric-value">\${tool.count} calls</span>
                    </div>
                \`).join('');
            }
            
            // Update response time history for chart
            if (data.responseTimeHistory) {
                responseTimeHistory = data.responseTimeHistory;
                updateChart();
            }
            
            // Update token savings metrics
            if (data.totalTokensSaved !== undefined) {
                document.getElementById('total-tokens-saved').textContent = 
                    data.totalTokensSaved.toLocaleString();
                
                // Calculate average tokens saved per call
                const avgTokens = data.totalRequests > 0 
                    ? Math.round(data.totalTokensSaved / data.totalRequests)
                    : 0;
                document.getElementById('avg-tokens-per-call').textContent = avgTokens.toLocaleString();
                
                // Estimate cost saved (using ~$0.003 per 1K tokens as rough estimate)
                const costSaved = (data.totalTokensSaved / 1000) * 0.003;
                document.getElementById('cost-saved').textContent = '$' + costSaved.toFixed(2);
            }
            
            // Update top token savers
            if (data.topTokenSavers && data.topTokenSavers.length > 0) {
                const topSavers = document.getElementById('top-savers');
                topSavers.innerHTML = data.topTokenSavers.map(tool => \`
                    <div class="savings-item">
                        <span class="savings-label">\${tool.name}</span>
                        <span class="savings-value">\${tool.saved.toLocaleString()}tk</span>
                    </div>
                \`).join('');
            }
            
            // Also refresh the tools list to update call counts
            fetchTools();
        }
        
        function updateChart() {
            const canvas = document.getElementById('performance-chart');
            const ctx = canvas.getContext('2d');
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;
            
            canvas.width = width;
            canvas.height = height;
            
            if (responseTimeHistory.length === 0) {
                // Draw empty state message
                ctx.fillStyle = '#999';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No data yet', width / 2, height / 2);
                return;
            }
            
            const padding = { left: 40, right: 20, top: 20, bottom: 30 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;
            
            const maxTime = Math.max(...responseTimeHistory, 100);
            const step = chartWidth / Math.max(responseTimeHistory.length - 1, 1);
            
            // Draw Y axis labels (response time in ms)
            ctx.fillStyle = '#666';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            
            // Draw 5 Y axis labels
            for (let i = 0; i <= 4; i++) {
                const value = Math.round(maxTime * (1 - i / 4));
                const y = padding.top + (chartHeight * i / 4);
                ctx.fillText(\`\${value}ms\`, padding.left - 5, y + 3);
                
                // Draw horizontal grid lines
                ctx.strokeStyle = '#f0f0f0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();
            }
            
            // Draw X axis label
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('← Older    Requests    Newer →', width / 2, height - 5);
            
            // Draw the line chart
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            responseTimeHistory.forEach((time, index) => {
                const x = padding.left + (index * step);
                const y = padding.top + chartHeight - (time / maxTime) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                
                // Draw data points
                ctx.fillStyle = '#667eea';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
            });
            
            ctx.strokeStyle = '#667eea';
            ctx.stroke();
            
            // Draw axes
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Y axis
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, height - padding.bottom);
            // X axis
            ctx.lineTo(width - padding.right, height - padding.bottom);
            ctx.stroke();
        }
        
        function connectSSE() {
            eventSource = new EventSource('/dashboard-events');
            
            eventSource.onmessage = function(event) {
                const data = JSON.parse(event.data);
                updateDashboard(data);
            };
            
            eventSource.onerror = function(error) {
                console.error('SSE connection error:', error);
                setTimeout(connectSSE, 5000); // Reconnect after 5 seconds
            };
        }
        
        function refreshMetrics() {
            fetchMetrics();
            fetchTools();
        }
        
        // Initialize dashboard
        async function checkForUpdates() {
            try {
                const response = await fetch('https://api.github.com/repos/jerry426/token-saver-mcp/releases/latest');
                if (response.ok) {
                    const release = await response.json();
                    const latestVersion = release.tag_name.replace(/^v/, '');
                    const currentVersion = '1.0.2';
                    
                    // Simple version comparison (assumes semantic versioning)
                    if (latestVersion > currentVersion) {
                        document.getElementById('update-notification').style.display = 'block';
                        document.getElementById('update-link').href = release.html_url;
                        document.getElementById('version-info').innerHTML = 
                            \`v\${currentVersion} <span style="color: #92400e;">(v\${latestVersion} available)</span>\`;
                    }
                }
            } catch (error) {
                console.error('Failed to check for updates:', error);
            }
        }
        
        document.addEventListener('DOMContentLoaded', function() {
            fetchMetrics();
            fetchWorkspaceInfo();
            fetchTools();
            connectSSE();
            checkForUpdates();
            
            // Auto-refresh every 5 seconds
            setInterval(fetchMetrics, 5000);
        });
    </script>
</body>
</html>`
}

// Track a request
function trackRequest(method: string, tool?: string, success: boolean = true, responseTime?: number) {
  metrics.totalRequests++
  if (success) {
    metrics.successCount++
  }
  else {
    metrics.errorCount++
  }

  if (responseTime !== undefined) {
    metrics.responseTimeHistory.push(responseTime)
    // Keep only last 100 response times
    if (metrics.responseTimeHistory.length > 100) {
      metrics.responseTimeHistory.shift()
    }
  }

  let tokensSaved = 0
  if (tool) {
    metrics.toolUsage.set(tool, (metrics.toolUsage.get(tool) || 0) + 1)

    // Calculate and track token savings
    tokensSaved = TOKEN_SAVINGS_ESTIMATES[tool] || 0
    if (tokensSaved > 0) {
      const currentSavings = metrics.tokenSavings.get(tool) || 0
      metrics.tokenSavings.set(tool, currentSavings + tokensSaved)
      metrics.totalTokensSaved += tokensSaved
    }
  }

  metrics.recentActivity.push({
    timestamp: Date.now(),
    method,
    tool,
    status: success ? 'success' : 'error',
    responseTime,
    tokensSaved,
  })

  // Keep only last 50 activities
  if (metrics.recentActivity.length > 50) {
    metrics.recentActivity.shift()
  }

  // Broadcast update to dashboard clients
  broadcastMetrics()
}

// Singleton server for sessionless mode
let singletonServer: McpServer | null = null
let singletonTransport: StreamableHTTPServerTransport | null = null

export async function startMcp() {
  const config = workspace.getConfiguration('lsp-mcp')
  const isMcpEnabled = config.get('enabled', true)

  if (!isMcpEnabled) {
    window.showInformationMessage('Token Saver MCP server is disabled by configuration.')
    return
  }

  // Default values
  let mcpPort = config.get('port', 9527)
  let maxRetries = config.get('maxRetries', 10)

  // Check for .lsp_mcp_port file in workspace root
  const workspaceFolder = workspace.workspaceFolders?.[0]
  if (workspaceFolder) {
    try {
      const portFile = Uri.joinPath(workspaceFolder.uri, '.lsp_mcp_port')
      const portContent = await workspace.fs.readFile(portFile)
      const fixedPort = Number.parseInt(new TextDecoder().decode(portContent).trim(), 10)

      if (!Number.isNaN(fixedPort) && fixedPort > 0 && fixedPort < 65536) {
        mcpPort = fixedPort
        maxRetries = 0 // Don't retry if using fixed port from file
        logger.info(`Using fixed port ${mcpPort} from .lsp_mcp_port file`)
      }
    }
    catch {
      // No .lsp_mcp_port file, use defaults
      logger.info(`No .lsp_mcp_port file found, using default port ${mcpPort}`)
    }
  }

  // Start session cleanup timer
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
  }
  cleanupTimer = setInterval(cleanupDeadSessions, SESSION_CLEANUP_INTERVAL)

  const app = express()
  app.use(express.json())

  // Register simple REST endpoints (works with curl, Gemini CLI, etc.)
  registerSimpleRestEndpoints(app, metrics)

  // Endpoint to get current session (for reconnection)
  app.get('/session-info', (_req, res) => {
    if (singletonTransport && singletonTransport.sessionId) {
      res.json({
        sessionId: singletonTransport.sessionId,
        mode: 'singleton',
        initialized: true,
      })
    }
    else {
      res.json({
        sessionId: null,
        mode: 'not-initialized',
        initialized: false,
      })
    }
  })

  // Dashboard endpoint - serve HTML
  app.get('/dashboard', (_req, res) => {
    res.setHeader('Content-Type', 'text/html')
    res.send(getDashboardHTML())
  })

  // Metrics endpoint
  app.get('/metrics', (_req, res) => {
    res.json(getMetricsData())
  })

  // Available tools endpoint
  app.get('/available-tools', async (_req, res) => {
    const lspTools = [
      'get_hover',
      'get_completions',
      'get_definition',
      'get_type_definition',
      'get_references',
      'find_implementations',
      'get_document_symbols',
      'get_call_hierarchy',
      'rename_symbol',
      'get_code_actions',
      'get_diagnostics',
      'get_semantic_tokens',
      'search_text',
    ]

    const cdpTools = [
      'execute_in_browser',
      'get_browser_console',
      'navigate_browser',
      'get_dom_snapshot',
      'click_element',
      'type_in_browser',
      'take_screenshot',
      'wait_for_element',
      'test_react_component',
      'test_api_endpoint',
      'test_form_validation',
      'check_page_performance',
      'debug_javascript_error',
    ]

    const systemTools = [
      'retrieve_buffer',
      'get_buffer_stats',
      'get_instructions',
      'get_supported_languages',
    ]

    // Include call counts and token savings from metrics
    const tools = [
      ...lspTools.map(name => ({
        name,
        category: 'lsp',
        callCount: metrics.toolUsage.get(name) || 0,
        tokensSaved: metrics.tokenSavings.get(name) || 0,
        estimatedSavingsPerCall: TOKEN_SAVINGS_ESTIMATES[name] || 0,
      })),
      ...cdpTools.map(name => ({
        name,
        category: 'cdp',
        callCount: metrics.toolUsage.get(name) || 0,
        tokensSaved: metrics.tokenSavings.get(name) || 0,
        estimatedSavingsPerCall: TOKEN_SAVINGS_ESTIMATES[name] || 0,
      })),
      ...systemTools.map(name => ({
        name,
        category: 'system',
        callCount: metrics.toolUsage.get(name) || 0,
        tokensSaved: metrics.tokenSavings.get(name) || 0,
        estimatedSavingsPerCall: TOKEN_SAVINGS_ESTIMATES[name] || 0,
      })),
    ]

    res.json({
      tools,
      totalTokensSaved: metrics.totalTokensSaved,
    })
  })

  // SSE endpoint for real-time dashboard updates
  app.get('/dashboard-events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Add client to the set
    dashboardClients.add(res)

    // Send initial data
    res.write(`data: ${JSON.stringify(getMetricsData())}\n\n`)

    // Clean up on disconnect
    req.on('close', () => {
      dashboardClients.delete(res)
    })
  })

  // Endpoint to identify the workspace
  app.get('/workspace-info', async (_req, res) => {
    const workspaceFolder = workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      res.status(404).json({ error: 'No workspace folder found' })
      return
    }

    // Try to read the workspace ID file
    let workspaceId: string | null = null
    try {
      const idFilePath = `${workspaceFolder.uri.fsPath}/.lsp_mcp_workspace_id`
      const fs = await import('node:fs/promises')
      workspaceId = (await fs.readFile(idFilePath, 'utf-8')).trim()
    }
    catch {
      // File doesn't exist or can't be read
      logger.info('No .lsp_mcp_workspace_id file found')
    }

    res.json({
      workspacePath: workspaceFolder.uri.fsPath,
      workspaceName: workspaceFolder.name,
      workspaceId: workspaceId || 'no-id-file',
      port: currentPort,
    })
  })

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    const startTime = Date.now()

    // Extract tool name if this is a tools/call request
    let toolName: string | undefined
    if (req.body?.method === 'tools/call' && req.body?.params?.name) {
      toolName = req.body.params.name
    }

    // Check for existing session ID (optional, for backwards compatibility)
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport: StreamableHTTPServerTransport

    // Option 1: Session ID provided and valid (backwards compatibility)
    if (sessionId && sessions[sessionId]) {
      // Reuse existing transport and update activity
      sessions[sessionId].lastActivity = Date.now()
      transport = sessions[sessionId].transport
    }
    // Option 2: Initialize request - create or reuse singleton
    else if (isInitializeRequest(req.body)) {
      // Use singleton for sessionless mode
      if (!singletonTransport || !singletonServer) {
        logger.info('Creating sessionless MCP server singleton')

        // Create transport without session management
        singletonTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => 'sessionless',
          onsessioninitialized: (actualSessionId) => {
            logger.info(`Sessionless MCP transport initialized with ID: ${actualSessionId}`)
            // Store the singleton session for reuse
            if (actualSessionId && singletonTransport) {
              sessions[actualSessionId] = {
                transport: singletonTransport,
                createdAt: Date.now(),
                lastActivity: Date.now(),
              }
            }
          },
          allowedHosts: ['127.0.0.1', 'localhost'],
        })

        singletonServer = new McpServer({
          name: 'lsp-server',
          version: '0.0.2',
        })

        // Register all tools from modular structure
        await registerAllTools(singletonServer)

        // Connect to the MCP server
        await singletonServer.connect(singletonTransport)
      }
      else {
        // Singleton already exists - return success response for initialize
        logger.info('Reusing existing singleton for initialize request - returning cached initialization')

        // Return a successful initialization response
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const initResponse = {
          jsonrpc: '2.0',
          id: (req.body as any).id || 1,
          result: {
            protocolVersion: '2025-01-05',
            capabilities: {
              tools: true,
            },
            serverInfo: {
              name: 'lsp-server',
              version: '0.0.2',
            },
          },
        }

        res.write(`event: message\ndata: ${JSON.stringify(initResponse)}\n\n`)
        res.end()
        return
      }
      transport = singletonTransport
    }
    // Option 3: Regular request without session - use singleton if available
    else if (!sessionId && singletonTransport) {
      // Sessionless mode - use singleton
      transport = singletonTransport
      // Add the session ID to the request headers for the transport
      if (singletonTransport.sessionId) {
        req.headers['mcp-session-id'] = singletonTransport.sessionId
      }
    }
    // Option 4: Session ID provided but invalid - try to use singleton as fallback
    else if (sessionId && !sessions[sessionId]) {
      if (singletonTransport) {
        // Fallback to singleton if session ID is invalid
        logger.warn(`Invalid session ID '${sessionId}' provided, falling back to singleton`)
        transport = singletonTransport
        // IMPORTANT: Replace the invalid session ID with the correct one
        // This allows the transport.handleRequest to work properly
        if (singletonTransport.sessionId) {
          req.headers['mcp-session-id'] = singletonTransport.sessionId
        }
      }
      else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Invalid session ID and no singleton available. Send initialize request first.',
          },
          id: null,
        })
        return
      }
    }
    // Option 5: No session and no singleton - need initialization
    else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Not initialized. Send initialize request first.',
        },
        id: null,
      })
      return
    }

    // Handle the request
    try {
      await transport.handleRequest(req, res, req.body)

      // Track successful request
      const responseTime = Date.now() - startTime
      trackRequest(req.body?.method || 'unknown', toolName, true, responseTime)
    }
    catch (error) {
      // Track failed request
      const responseTime = Date.now() - startTime
      trackRequest(req.body?.method || 'unknown', toolName, false, responseTime)

      // Re-throw to maintain original error handling
      throw error
    }
  })

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', handleSessionRequest)

  // Try to start server, handling port conflicts
  startServer(app, mcpPort, maxRetries)
}

// Try to start server, if port is occupied try other ports
function startServer(app: express.Express, initialPort: number, maxRetries: number) {
  currentPort = initialPort
  let retries = 0

  const tryListen = () => {
    const server = app.listen(currentPort, () => {
      window.showInformationMessage(`Token Saver MCP server started on port ${currentPort}`)
      logger.info(`MCP server running at http://127.0.0.1:${currentPort}/mcp`)
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && retries < maxRetries) {
        // Port in use, try next port
        retries++
        currentPort++
        window.showWarningMessage(`Port ${currentPort - 1} is in use, trying port ${currentPort}...`)
        tryListen()
      }
      else {
        window.showErrorMessage(`Failed to start Token Saver MCP server: ${err.message}`)
      }
    })
  }

  tryListen()
}

// Reusable handler for GET and DELETE requests
async function handleSessionRequest(req: express.Request, res: express.Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  // Update last activity
  sessions[sessionId].lastActivity = Date.now()

  const transport = sessions[sessionId].transport
  await transport.handleRequest(req, res)
}

// Export cleanup function for extension deactivation
export function stopMcp() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }

  // Clean up buffer manager
  cleanupBuffers()

  // Clean up singleton
  if (singletonTransport && singletonTransport.close) {
    singletonTransport.close()
  }
  singletonTransport = null
  singletonServer = null

  // Close all active sessions
  for (const sessionInfo of Object.values(sessions)) {
    if (sessionInfo.transport.close) {
      sessionInfo.transport.close()
    }
  }

  // Clear sessions
  Object.keys(sessions).forEach(key => delete sessions[key])
}
