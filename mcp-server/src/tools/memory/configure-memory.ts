import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolMetadata } from '../types'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { z } from 'zod'
import { memoryDb } from '../../db/memory-db'

/**
 * Tool metadata for documentation generation
 */
export const metadata: ToolMetadata = {
  name: 'configure_memory',
  title: 'Configure Memory',
  category: 'memory' as const,
  description: 'Configure memory system defaults and behavior for optimal token efficiency.',

  docs: {
    brief: 'Configure memory system settings',

    parameters: {
      action: 'Action to perform: get, set, reset, or profile',
      setting: 'Setting name when using set action',
      value: 'Value to set when using set action',
      profile: 'Apply preset profile: minimal, standard, detailed, or comprehensive',
    },

    examples: [
      {
        title: 'Get current configuration',
        code: `configure_memory({
  action: "get"
})`,
      },
      {
        title: 'Set default importance level',
        code: `configure_memory({
  action: "set",
  setting: "defaultImportance",
  value: 3
})`,
      },
      {
        title: 'Apply minimal profile for maximum token savings',
        code: `configure_memory({
  action: "profile",
  profile: "minimal"
})`,
      },
      {
        title: 'Reset to defaults',
        code: `configure_memory({
  action: "reset"
})`,
      },
    ],

    workflow: {
      usedWith: ['write_memory', 'smart_resume'],
      followedBy: ['Apply settings to memory operations'],
      description: 'Optimize memory system for specific use cases',
    },

    tips: [
      'Use profiles for quick configuration changes',
      'Minimal profile saves most tokens but loses detail',
      'Comprehensive profile preserves everything but uses more tokens',
      'Settings persist across sessions in ~/.token-saver-mcp/config.json',
    ],

    meta: {
      isUtility: true,
    },
  },
}

interface MemoryConfig {
  defaultImportance: number // 1-5
  defaultVerbosity: number // 1-4
  autoExportEnabled: boolean
  autoExportPath: string
  autoExportFrequency: number // hours
  smartResumeMaxTokens: number
  smartResumeMinImportance: number
  smartResumeMaxVerbosity: number
  ttlDefault: number // seconds, 0 = no expiry
  patternPrefixes: Record<string, { importance: number, verbosity: number }>
}

const DEFAULT_CONFIG: MemoryConfig = {
  defaultImportance: 3,
  defaultVerbosity: 2,
  autoExportEnabled: false,
  autoExportPath: 'auto',
  autoExportFrequency: 24,
  smartResumeMaxTokens: 2000,
  smartResumeMinImportance: 3,
  smartResumeMaxVerbosity: 2,
  ttlDefault: 0,
  patternPrefixes: {
    'architecture.': { importance: 5, verbosity: 2 },
    'decision.': { importance: 4, verbosity: 3 },
    'todo.': { importance: 3, verbosity: 1 },
    'error.': { importance: 4, verbosity: 4 },
    'debug.': { importance: 2, verbosity: 4 },
    'temp.': { importance: 1, verbosity: 1 },
  },
}

const PROFILES = {
  minimal: {
    defaultImportance: 4,
    defaultVerbosity: 1,
    smartResumeMinImportance: 4,
    smartResumeMaxVerbosity: 1,
    smartResumeMaxTokens: 500,
  },
  standard: {
    defaultImportance: 3,
    defaultVerbosity: 2,
    smartResumeMinImportance: 3,
    smartResumeMaxVerbosity: 2,
    smartResumeMaxTokens: 2000,
  },
  detailed: {
    defaultImportance: 2,
    defaultVerbosity: 3,
    smartResumeMinImportance: 2,
    smartResumeMaxVerbosity: 3,
    smartResumeMaxTokens: 5000,
  },
  comprehensive: {
    defaultImportance: 1,
    defaultVerbosity: 4,
    smartResumeMinImportance: 1,
    smartResumeMaxVerbosity: 4,
    smartResumeMaxTokens: 10000,
  },
}

function getConfigPath(): string {
  const configDir = path.join(os.homedir(), '.token-saver-mcp')
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  return path.join(configDir, 'config.json')
}

function loadConfig(): MemoryConfig {
  const configPath = getConfigPath()
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
    }
    catch {
      return DEFAULT_CONFIG
    }
  }
  return DEFAULT_CONFIG
}

function saveConfig(config: MemoryConfig): void {
  const configPath = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

// Tool handler
export async function handler(params: {
  action: 'get' | 'set' | 'reset' | 'profile'
  setting?: string
  value?: any
  profile?: 'minimal' | 'standard' | 'detailed' | 'comprehensive'
} = { action: 'get' }): Promise<any> {
  try {
    const config = loadConfig()

    switch (params.action) {
      case 'get': {
        const stats = memoryDb.getStats()

        return {
          content: [{
            type: 'text',
            text: `📋 **Memory System Configuration**

**Default Settings:**
• Default Importance: ${config.defaultImportance} (${['', 'Trivial', 'Low', 'Standard', 'High', 'Critical'][config.defaultImportance]})
• Default Verbosity: ${config.defaultVerbosity} (${['', 'Minimal', 'Standard', 'Detailed', 'Comprehensive'][config.defaultVerbosity]})
• Default TTL: ${config.ttlDefault === 0 ? 'No expiry' : `${config.ttlDefault} seconds`}

**Smart Resume Settings:**
• Max Tokens: ${config.smartResumeMaxTokens}
• Min Importance: ${config.smartResumeMinImportance}
• Max Verbosity: ${config.smartResumeMaxVerbosity}

**Auto Export:**
• Enabled: ${config.autoExportEnabled ? 'Yes' : 'No'}
• Path: ${config.autoExportPath}
• Frequency: Every ${config.autoExportFrequency} hours

**Pattern Prefixes:**
${Object.entries(config.patternPrefixes).map(([prefix, settings]) =>
  `• ${prefix} → Importance: ${settings.importance}, Verbosity: ${settings.verbosity}`,
).join('\n')}

**Current Stats:**
• Total Memories: ${stats.total_memories}
• Storage Size: ${(stats.database_size / 1024).toFixed(1)} KB

**Config Location:** ${getConfigPath()}`,
          }],
        }
      }

      case 'set': {
        if (!params.setting) {
          return {
            content: [{
              type: 'text',
              text: '❌ Error: setting parameter required for set action',
            }],
          }
        }

        const validSettings = Object.keys(DEFAULT_CONFIG)
        if (!validSettings.includes(params.setting)) {
          return {
            content: [{
              type: 'text',
              text: `❌ Error: Invalid setting. Valid settings: ${validSettings.join(', ')}`,
            }],
          }
        }

        // Validate and set the value
        const oldValue = (config as any)[params.setting]

        // Type validation
        if (params.setting === 'defaultImportance' || params.setting === 'smartResumeMinImportance') {
          const val = Number(params.value)
          if (val < 1 || val > 5) {
            return {
              content: [{
                type: 'text',
                text: '❌ Error: Importance must be between 1 and 5',
              }],
            }
          }
          (config as any)[params.setting] = val
        }
        else if (params.setting === 'defaultVerbosity' || params.setting === 'smartResumeMaxVerbosity') {
          const val = Number(params.value)
          if (val < 1 || val > 4) {
            return {
              content: [{
                type: 'text',
                text: '❌ Error: Verbosity must be between 1 and 4',
              }],
            }
          }
          (config as any)[params.setting] = val
        }
        else if (params.setting === 'autoExportEnabled') {
          (config as any)[params.setting] = Boolean(params.value)
        }
        else if (params.setting === 'patternPrefixes') {
          if (typeof params.value !== 'object') {
            return {
              content: [{
                type: 'text',
                text: '❌ Error: patternPrefixes must be an object',
              }],
            }
          }
          (config as any)[params.setting] = params.value
        }
        else {
          (config as any)[params.setting] = params.value
        }

        saveConfig(config)

        return {
          content: [{
            type: 'text',
            text: `✅ Setting updated: ${params.setting}
Old value: ${JSON.stringify(oldValue)}
New value: ${JSON.stringify((config as any)[params.setting])}`,
          }],
        }
      }

      case 'profile': {
        if (!params.profile || !PROFILES[params.profile]) {
          return {
            content: [{
              type: 'text',
              text: `❌ Error: Invalid profile. Valid profiles: ${Object.keys(PROFILES).join(', ')}`,
            }],
          }
        }

        const profile = PROFILES[params.profile]
        const updatedConfig = { ...config, ...profile }
        saveConfig(updatedConfig)

        return {
          content: [{
            type: 'text',
            text: `✅ **Profile Applied: ${params.profile}**

${params.profile === 'minimal' ? '🎯 **Minimal Profile** - Maximum token efficiency, minimal context' : ''}
${params.profile === 'standard' ? '📊 **Standard Profile** - Balanced token usage and context' : ''}
${params.profile === 'detailed' ? '📖 **Detailed Profile** - More context, higher token usage' : ''}
${params.profile === 'comprehensive' ? '📚 **Comprehensive Profile** - Full context preservation' : ''}

**Applied Settings:**
• Default Importance: ${updatedConfig.defaultImportance}
• Default Verbosity: ${updatedConfig.defaultVerbosity}
• Smart Resume Min Importance: ${updatedConfig.smartResumeMinImportance}
• Smart Resume Max Verbosity: ${updatedConfig.smartResumeMaxVerbosity}
• Smart Resume Max Tokens: ${updatedConfig.smartResumeMaxTokens}

${params.profile === 'minimal' ? '💡 Use this for maximum token savings when you only need critical decisions and architecture.' : ''}
${params.profile === 'comprehensive' ? '⚠️ Warning: This profile uses significantly more tokens but preserves full context.' : ''}`,
          }],
        }
      }

      case 'reset': {
        saveConfig(DEFAULT_CONFIG)

        return {
          content: [{
            type: 'text',
            text: `✅ Configuration reset to defaults

**Default Configuration:**
${JSON.stringify(DEFAULT_CONFIG, null, 2)}`,
          }],
        }
      }

      default:
        return {
          content: [{
            type: 'text',
            text: `❌ Error: Invalid action. Use: get, set, reset, or profile`,
          }],
        }
    }
  }
  catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error configuring memory: ${error.message}`,
      }],
    }
  }
}

export function register(server: McpServer) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: {
        action: z.enum(['get', 'set', 'reset', 'profile']).describe('Action to perform'),
        setting: z.string().optional().describe('Setting name for set action'),
        value: z.any().optional().describe('Value for set action'),
        profile: z.enum(['minimal', 'standard', 'detailed', 'comprehensive']).optional().describe('Profile to apply'),
      },
    },
    handler,
  )
}

// Export config functions for use by other memory tools
export { DEFAULT_CONFIG, loadConfig, type MemoryConfig }
