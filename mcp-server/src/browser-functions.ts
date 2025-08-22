import { Buffer } from 'node:buffer'
import { CDPClient } from './cdp-client'

// Singleton CDP client instance
let cdpClient: CDPClient | null = null

export async function ensureCDPConnection() {
  if (!cdpClient) {
    cdpClient = new CDPClient({
      port: 9222,
      launchBrowser: true,
    })
  }

  const isHealthy = await cdpClient.isHealthy()
  if (!isHealthy) {
    await cdpClient.connect()
  }

  return cdpClient
}

export async function executeInBrowser(expression: string, url?: string) {
  const client = await ensureCDPConnection()

  if (url) {
    await client.navigate(url)
  }

  const result = await client.execute(expression)
  return JSON.stringify(result)
}

export async function getBrowserConsole(filter?: string, clear?: boolean) {
  const client = await ensureCDPConnection()

  let messages = client.getConsoleMessages()

  if (filter) {
    const regex = new RegExp(filter, 'i')
    messages = messages.filter(m =>
      regex.test(m.text)
      || regex.test(m.type)
      || (m.url && regex.test(m.url)),
    )
  }

  if (clear) {
    client.clearConsoleMessages()
  }

  return JSON.stringify({ messages })
}

export async function navigateBrowser(url: string) {
  const client = await ensureCDPConnection()
  await client.navigate(url)
  return JSON.stringify({ success: true })
}

export async function getDOMSnapshot() {
  const client = await ensureCDPConnection()
  const snapshot = await client.getDOMSnapshot()
  return JSON.stringify(snapshot)
}

export async function clickElement(selector: string) {
  const client = await ensureCDPConnection()
  await client.click(selector)
  return JSON.stringify({ success: true })
}

export async function typeInBrowser(selector: string, text: string) {
  const client = await ensureCDPConnection()
  await client.type(selector, text)
  return JSON.stringify({ success: true })
}

export async function takeScreenshot(
  _fullPage: boolean = false,
  downsample: boolean = true,
  metadataOnly: boolean = false,
  quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom' = 'low', // Default to low since it's the only one under 25K
  customWidth?: number,
  customQuality?: number,
) {
  const client = await ensureCDPConnection()

  // Get full screenshot first to calculate size
  const fullScreenshot = await client.screenshot()
  const fullSizeBytes = Buffer.from(fullScreenshot, 'base64').length
  const fullSizeTokens = Math.ceil(fullScreenshot.length / 4) // Rough estimate: ~4 chars per token

  // Define quality presets - conservative to stay under 25K token limit
  const presets = {
    low: { width: 800, quality: 70 }, // ~12K tokens (tested and working)
    medium: { width: 850, quality: 72 }, // ~15K tokens (safer than 1000px)
    high: { width: 900, quality: 75 }, // ~18K tokens (conservative)
    ultra: { width: 950, quality: 78 }, // ~22K tokens (near limit)
    custom: {
      width: customWidth || 850,
      quality: customQuality || 72,
    },
  }

  const selectedPreset = presets[quality]

  // If only metadata requested, return size info without data
  if (metadataOnly) {
    // Actual estimates based on real testing (very conservative)
    const estimates = {
      low: Math.ceil(fullSizeTokens * 0.027), // ~2.7% of original (12K actual for 446K)
      medium: Math.ceil(fullSizeTokens * 0.098), // ~9.8% of original (43K actual for 446K)
      high: Math.ceil(fullSizeTokens * 0.123), // ~12.3% estimated
      ultra: Math.ceil(fullSizeTokens * 0.157), // ~15.7% estimated
      full: fullSizeTokens,
    }

    return JSON.stringify({
      metadata: {
        fullSizeBytes,
        fullSizeTokens,
        estimates,
        selectedQuality: quality,
        presetUsed: selectedPreset,
        format: downsample ? 'jpeg' : 'png',
        warning: fullSizeTokens > 25000 ? `Full image would use ${fullSizeTokens.toLocaleString()} tokens (exceeds 25k limit)` : null,
      },
    })
  }

  // Get the appropriate screenshot based on settings
  const screenshot = downsample
    ? await client.screenshotDownsampled(selectedPreset.width, selectedPreset.quality)
    : fullScreenshot

  const actualTokens = Math.ceil(screenshot.length / 4)

  return JSON.stringify({
    data: screenshot,
    downsampled: downsample,
    format: downsample ? 'jpeg' : 'png',
    quality,
    metadata: {
      actualBytes: Buffer.from(screenshot, 'base64').length,
      actualTokens,
      fullSizeBytes,
      fullSizeTokens,
      width: selectedPreset.width,
      jpegQuality: selectedPreset.quality,
      compressionRatio: downsample ? (1 - actualTokens / fullSizeTokens).toFixed(2) : '0',
    },
  })
}

export async function waitForElement(selector: string, timeout: number = 30000) {
  const client = await ensureCDPConnection()
  await client.waitForSelector(selector, timeout)
  return JSON.stringify({ success: true })
}

export function resetCDPClient() {
  if (cdpClient) {
    cdpClient.disconnect()
    cdpClient = null
  }
}
