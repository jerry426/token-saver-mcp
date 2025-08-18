import { logger } from '../utils'
import * as vscode from 'vscode'
import * as https from 'https'
import * as semver from 'semver'

interface GitHubRelease {
  tag_name: string
  name: string
  html_url: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
  }>
}

export class UpdateChecker {
  private static readonly GITHUB_API_URL = 'https://api.github.com/repos/jerry426/token-saver-mcp/releases/latest'
  private static readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000 // Check once per day
  private static readonly LAST_CHECK_KEY = 'token-saver-mcp.lastUpdateCheck'
  private static readonly DISMISSED_VERSION_KEY = 'token-saver-mcp.dismissedVersion'

  /**
   * Check for updates from GitHub releases
   */
  static async checkForUpdates(context: vscode.ExtensionContext, silent: boolean = true): Promise<void> {
    try {
      // Check if we should check for updates (once per day)
      if (silent) {
        const lastCheck = context.globalState.get<number>(this.LAST_CHECK_KEY, 0)
        const now = Date.now()
        if (now - lastCheck < this.CHECK_INTERVAL) {
          return
        }
      }

      // Get current version from package.json
      const currentVersion = context.extension.packageJSON.version

      // Fetch latest release from GitHub
      const latestRelease = await this.fetchLatestRelease()
      if (!latestRelease) {
        if (!silent) {
          vscode.window.showInformationMessage('Unable to check for updates. Please check your internet connection.')
        }
        return
      }

      // Parse version from tag (remove 'v' prefix if present)
      const latestVersion = latestRelease.tag_name.replace(/^v/, '')

      // Check if update is available
      if (semver.gt(latestVersion, currentVersion)) {
        // Check if user already dismissed this version
        const dismissedVersion = context.globalState.get<string>(this.DISMISSED_VERSION_KEY)
        if (silent && dismissedVersion === latestVersion) {
          return
        }

        // Find VSIX asset
        const vsixAsset = latestRelease.assets.find(asset => asset.name.endsWith('.vsix'))
        
        // Show update notification
        const message = `Token Saver MCP v${latestVersion} is available! (Current: v${currentVersion})`
        const actions = ['View Release', 'Download VSIX']
        if (silent) actions.push('Dismiss')
        
        const selection = await vscode.window.showInformationMessage(message, ...actions)
        
        if (selection === 'View Release') {
          vscode.env.openExternal(vscode.Uri.parse(latestRelease.html_url))
        } else if (selection === 'Download VSIX' && vsixAsset) {
          vscode.env.openExternal(vscode.Uri.parse(vsixAsset.browser_download_url))
        } else if (selection === 'Dismiss') {
          await context.globalState.update(this.DISMISSED_VERSION_KEY, latestVersion)
        }
      } else if (!silent) {
        vscode.window.showInformationMessage(`Token Saver MCP is up to date! (v${currentVersion})`)
      }

      // Update last check timestamp
      await context.globalState.update(this.LAST_CHECK_KEY, Date.now())
      
    } catch (error) {
      logger.error('Failed to check for updates:', error)
      if (!silent) {
        vscode.window.showErrorMessage('Failed to check for updates')
      }
    }
  }

  /**
   * Fetch latest release from GitHub API
   */
  private static fetchLatestRelease(): Promise<GitHubRelease | null> {
    return new Promise((resolve) => {
      const options = {
        headers: {
          'User-Agent': 'Token-Saver-MCP',
          'Accept': 'application/vnd.github.v3+json'
        }
      }

      https.get(this.GITHUB_API_URL, options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const release = JSON.parse(data) as GitHubRelease
              resolve(release)
            } else {
              logger.warn(`GitHub API returned status ${res.statusCode}`)
              resolve(null)
            }
          } catch (error) {
            logger.error('Failed to parse GitHub release:', error)
            resolve(null)
          }
        })
      }).on('error', (error) => {
        logger.error('Failed to fetch GitHub release:', error)
        resolve(null)
      })
    })
  }

  /**
   * Get update status for dashboard
   */
  static async getUpdateStatus(context: vscode.ExtensionContext): Promise<any> {
    try {
      const currentVersion = context.extension.packageJSON.version
      const latestRelease = await this.fetchLatestRelease()
      
      if (!latestRelease) {
        return {
          current: currentVersion,
          latest: null,
          updateAvailable: false
        }
      }

      const latestVersion = latestRelease.tag_name.replace(/^v/, '')
      const updateAvailable = semver.gt(latestVersion, currentVersion)

      return {
        current: currentVersion,
        latest: latestVersion,
        updateAvailable,
        releaseUrl: latestRelease.html_url,
        publishedAt: latestRelease.published_at
      }
    } catch (error) {
      logger.error('Failed to get update status:', error)
      return {
        current: context.extension.packageJSON.version,
        latest: null,
        updateAvailable: false
      }
    }
  }
}