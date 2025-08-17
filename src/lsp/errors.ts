import type * as vscode from 'vscode'

/**
 * Standard error class for LSP operations
 */
export class LSPError extends Error {
  public readonly operation: string
  public readonly uri?: string
  public readonly position?: vscode.Position
  public readonly cause?: Error

  constructor(
    message: string,
    operation: string,
    options?: {
      uri?: string
      position?: vscode.Position
      cause?: Error
    },
  ) {
    super(message)
    this.name = 'LSPError'
    this.operation = operation
    this.uri = options?.uri
    this.position = options?.position
    this.cause = options?.cause

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LSPError)
    }
  }

  /**
   * Convert error to a standardized response format
   */
  toResponse() {
    return {
      success: false,
      error: {
        message: this.message,
        operation: this.operation,
        uri: this.uri,
        position: this.position
          ? {
              line: this.position.line,
              character: this.position.character,
            }
          : undefined,
        cause: this.cause?.message,
      },
    }
  }
}

/**
 * Standard response wrapper for LSP operations
 */
export interface LSPResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    operation: string
    uri?: string
    position?: { line: number, character: number }
    cause?: string
  }
}

/**
 * Create a successful response
 */
export function successResponse<T>(data: T): LSPResponse<T> {
  return { success: true, data }
}

/**
 * Create an error response from an LSPError
 */
export function errorResponse(error: LSPError): LSPResponse<never> {
  return error.toResponse()
}

/**
 * Wrap an async LSP operation with error handling
 */
export async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  options?: {
    uri?: string
    position?: vscode.Position
  },
): Promise<T> {
  try {
    return await fn()
  }
  catch (error) {
    if (error instanceof LSPError) {
      throw error
    }

    throw new LSPError(
      `Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      operation,
      {
        uri: options?.uri,
        position: options?.position,
        cause: error instanceof Error ? error : undefined,
      },
    )
  }
}
