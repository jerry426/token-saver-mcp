/**
 * Type definitions for tool metadata
 * Enforces consistent documentation structure across all tools
 */

export interface ToolMetadata {
  /** Tool identifier used in MCP registration */
  name: string

  /** Human-readable tool name */
  title: string

  /** Tool category for organization */
  category: 'lsp' | 'cdp' | 'helper' | 'system'

  /** Full description of what the tool does */
  description: string

  /** Comprehensive documentation */
  docs: {
    /** One-line summary for quick reference */
    brief: string

    /** Parameter descriptions keyed by parameter name */
    parameters?: Record<string, string>

    /** Usage examples with code */
    examples?: Array<{
      title: string
      code: string
    }>

    /** Workflow integration information */
    workflow?: {
      /** Tools that commonly precede this one */
      usedWith?: string[]
      /** Tools that commonly follow this one */
      followedBy?: string[]
      /** Description of how this tool fits in workflows */
      description?: string
    }

    /** Best practices and usage tips */
    tips?: string[]

    /** Performance characteristics */
    performance?: {
      speed?: string
      tokenSavings?: string
      accuracy?: string
      reliability?: string
      buffering?: string
    }

    /** Additional metadata */
    meta?: {
      /** Whether this is a utility/support tool */
      isUtility?: boolean
      /** What system/feature this tool supports */
      supportsTool?: string
      /** Whether this is a high-level helper */
      isHelper?: boolean
      /** Whether to always include in documentation */
      alwaysInclude?: boolean
      /** Whether this tool requires Chrome */
      requiresChrome?: boolean
      /** Whether this is a meta tool about the system itself */
      isMetaTool?: boolean
    }

    // Helper tool specific fields
    /** What this helper tests automatically (for helper tools) */
    testsAutomatically?: string[]
    /** How this saves time vs manual testing (for helper tools) */
    savesTimeVsManual?: string[]
    /** Integration workflow scenarios (for helper tools) */
    integrationWorkflows?: string[]
    /** Single example usage string (for helper tools) */
    exampleUsage?: string
  }
}

/**
 * Tool module structure for registration
 */
export interface ToolModule {
  /** Tool metadata for documentation */
  metadata: ToolMetadata

  /** Function to register the tool with MCP server */
  register: (server: any) => void
}
