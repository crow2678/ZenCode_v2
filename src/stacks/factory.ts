/**
 * ZenCode V2 - Stack Factory
 *
 * Factory for creating and resolving stack handlers.
 * Provides convenient access to the registry with type safety.
 */

import { stackRegistry } from './registry'
import type { IStackHandler, StackInfo } from './types'

/**
 * Stack Factory
 *
 * Main entry point for getting stack handlers.
 * Wraps the registry with additional convenience methods.
 */
export class StackFactory {
  /**
   * Get a stack handler by ID
   * Falls back to default if not found
   */
  static get(stackId?: string): IStackHandler {
    if (!stackId) {
      return stackRegistry.getDefault()
    }
    return stackRegistry.get(stackId)
  }

  /**
   * Get stack handler, but return null if not found
   */
  static tryGet(stackId: string): IStackHandler | null {
    return stackRegistry.has(stackId) ? stackRegistry.get(stackId) : null
  }

  /**
   * Get the default stack handler
   */
  static getDefault(): IStackHandler {
    return stackRegistry.getDefault()
  }

  /**
   * Check if a stack is available
   */
  static isAvailable(stackId: string): boolean {
    return stackRegistry.has(stackId)
  }

  /**
   * List all available stacks
   */
  static listStacks(): StackInfo[] {
    return stackRegistry.list()
  }

  /**
   * Get count of available stacks
   */
  static count(): number {
    return stackRegistry.count()
  }

  /**
   * Get recommended stack for a project based on heuristics
   *
   * @param projectConfig - Partial project config or hints
   * @returns Recommended stack ID
   */
  static recommend(projectConfig: {
    language?: string
    framework?: string
    database?: string
    hasTypescript?: boolean
  }): string {
    const stacks = stackRegistry.list()

    // If explicit framework is specified, match it
    if (projectConfig.framework) {
      const match = stacks.find(
        (s) => s.framework.toLowerCase() === projectConfig.framework!.toLowerCase()
      )
      if (match) return match.id
    }

    // If explicit language is specified, match it
    if (projectConfig.language) {
      const match = stacks.find(
        (s) => s.language.toLowerCase() === projectConfig.language!.toLowerCase()
      )
      if (match) return match.id
    }

    // Default to nextjs-mongodb
    return stackRegistry.getDefaultId()
  }

  /**
   * Resolve stack from PRD hints
   *
   * Parses PRD/blueprint for stack hints and returns appropriate handler
   */
  static resolveFromPRD(prd: {
    techStack?: string[]
    requirements?: string
    features?: string[]
  }): IStackHandler {
    const techStack = prd.techStack || []
    const requirements = prd.requirements || ''
    const allText = [...techStack, requirements].join(' ').toLowerCase()

    // Check for Python/FastAPI
    if (allText.includes('python') || allText.includes('fastapi') || allText.includes('django')) {
      const pythonStack = stackRegistry.has('fastapi-postgres')
        ? stackRegistry.get('fastapi-postgres')
        : null
      if (pythonStack) return pythonStack
    }

    // Check for Express.js
    if (allText.includes('express') && !allText.includes('next')) {
      const expressStack = stackRegistry.has('express-postgres')
        ? stackRegistry.get('express-postgres')
        : null
      if (expressStack) return expressStack
    }

    // Check for Go
    if (allText.includes('golang') || allText.includes(' go ')) {
      const goStack = stackRegistry.has('go-postgres')
        ? stackRegistry.get('go-postgres')
        : null
      if (goStack) return goStack
    }

    // Check for specific databases (with Express preference over FastAPI for Node.js)
    if (allText.includes('postgres') || allText.includes('postgresql')) {
      // If Node.js/TypeScript mentioned, prefer express-postgres
      if (allText.includes('node') || allText.includes('typescript') || allText.includes('rest api')) {
        const expressStack = stackRegistry.has('express-postgres')
          ? stackRegistry.get('express-postgres')
          : null
        if (expressStack) return expressStack
      }
      // Otherwise look for any postgres-based stack
      const stacks = stackRegistry.list()
      const postgresStack = stacks.find((s) => s.id.includes('postgres'))
      if (postgresStack) return stackRegistry.get(postgresStack.id)
    }

    // Default to Next.js + MongoDB
    return stackRegistry.getDefault()
  }
}

/**
 * Convenience function to get a stack handler
 * Shorthand for StackFactory.get()
 */
export function getStack(stackId?: string): IStackHandler {
  return StackFactory.get(stackId)
}

/**
 * Convenience function to get the default stack
 */
export function getDefaultStack(): IStackHandler {
  return StackFactory.getDefault()
}
