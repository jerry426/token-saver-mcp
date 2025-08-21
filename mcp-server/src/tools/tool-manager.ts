/**
 * Tool Manager - Centralized management of all modular tools
 * This replaces the old tool-registry.ts
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getAllToolMetadata } from './index'

// Store registered tools and their handlers
const registeredTools = new Map<string, any>()
let mcpServerInstance: McpServer | null = null

/**
 * Set the MCP server instance to track registered tools
 */
export function setMcpServerInstance(server: McpServer) {
  mcpServerInstance = server
}

/**
 * Register a tool handler (called by each tool module during registration)
 */
export function registerToolHandler(name: string, handler: any) {
  registeredTools.set(name, handler)
}

/**
 * Get all tools in the format expected by MCP protocol
 */
export function listAllTools() {
  const metadata = getAllToolMetadata()
  
  return metadata.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties: tool.docs?.parameters ? 
        Object.entries(tool.docs.parameters).reduce((acc, [key, desc]) => ({
          ...acc,
          [key]: { 
            type: 'string', 
            description: desc as string 
          }
        }), {}) : {},
      required: []
    }
  }))
}

/**
 * Get a tool by name
 */
export function getToolByName(name: string) {
  const handler = registeredTools.get(name)
  if (!handler) {
    // Fallback to old naming for backward compatibility
    if (name === 'search_text') {
      // Map old search_text to find_text
      return registeredTools.get('find_text')
    }
    return null
  }
  
  const metadata = getAllToolMetadata().find(m => m.name === name)
  
  return {
    name,
    description: metadata?.description || '',
    handler
  }
}

/**
 * Get tools organized by category
 */
export function getToolsByCategory() {
  const metadata = getAllToolMetadata()
  const categories: Record<string, any[]> = {
    lsp: [],
    cdp: [],
    helper: [],
    system: []
  }
  
  for (const tool of metadata) {
    const category = tool.category
    if (categories[category]) {
      categories[category].push({
        name: tool.name,
        description: tool.description
      })
    }
  }
  
  return categories
}

/**
 * Get tool count by category
 */
export function getToolCounts() {
  const metadata = getAllToolMetadata()
  const counts: Record<string, number> = {
    lsp: 0,
    cdp: 0,
    helper: 0,
    system: 0
  }
  
  for (const tool of metadata) {
    if (counts[tool.category] !== undefined) {
      counts[tool.category]++
    }
  }
  
  return {
    ...counts,
    total: metadata.length
  }
}