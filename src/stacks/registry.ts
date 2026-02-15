/**
 * ZenCode V2 - Stack Registry
 *
 * Central registry for all stack handlers.
 * Uses singleton pattern for global access.
 * Stacks auto-register when their modules are imported.
 */

import type { IStackHandler, StackInfo } from './types'

class StackRegistry {
  private static instance: StackRegistry
  private handlers = new Map<string, IStackHandler>()
  private defaultId = 'nextjs-mongodb'

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): StackRegistry {
    if (!StackRegistry.instance) {
      StackRegistry.instance = new StackRegistry()
    }
    return StackRegistry.instance
  }

  /**
   * Register a stack handler
   * Called by each stack's index.ts on import
   */
  register(handler: IStackHandler): void {
    if (this.handlers.has(handler.id)) {
      return // Already registered, skip
    }
    console.log(`[StackRegistry] Registered: ${handler.id} (${handler.name})`)
    this.handlers.set(handler.id, handler)
  }

  /**
   * Get a stack handler by ID
   * Falls back to default if not found
   */
  get(id: string): IStackHandler {
    const handler = this.handlers.get(id)
    if (!handler) {
      console.warn(`[StackRegistry] Stack '${id}' not found, using default: ${this.defaultId}`)
      return this.getDefault()
    }
    return handler
  }

  /**
   * Get the default stack handler
   */
  getDefault(): IStackHandler {
    const handler = this.handlers.get(this.defaultId)
    if (!handler) {
      throw new Error(
        `[StackRegistry] Default stack '${this.defaultId}' not registered. ` +
        `Available stacks: ${Array.from(this.handlers.keys()).join(', ') || 'none'}`
      )
    }
    return handler
  }

  /**
   * Check if a stack is registered
   */
  has(id: string): boolean {
    return this.handlers.has(id)
  }

  /**
   * List all registered stacks
   */
  list(): StackInfo[] {
    return Array.from(this.handlers.values()).map((h) => ({
      id: h.id,
      name: h.name,
      description: h.description,
      icon: h.icon,
      language: h.language,
      framework: h.framework,
      version: h.version,
    }))
  }

  /**
   * Get count of registered stacks
   */
  count(): number {
    return this.handlers.size
  }

  /**
   * Set the default stack ID
   */
  setDefault(id: string): void {
    if (!this.handlers.has(id)) {
      throw new Error(`[StackRegistry] Cannot set default: '${id}' not registered`)
    }
    this.defaultId = id
    console.log(`[StackRegistry] Default stack set to: ${id}`)
  }

  /**
   * Get the current default stack ID
   */
  getDefaultId(): string {
    return this.defaultId
  }

  /**
   * Unregister a stack (mainly for testing)
   */
  unregister(id: string): boolean {
    return this.handlers.delete(id)
  }

  /**
   * Clear all registrations (mainly for testing)
   */
  clear(): void {
    this.handlers.clear()
  }
}

// Export singleton instance
export const stackRegistry = StackRegistry.getInstance()
