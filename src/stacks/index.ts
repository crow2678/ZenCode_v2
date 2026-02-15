/**
 * ZenCode V2 - Stack System Entry Point
 *
 * This file exports the stack plugin system and auto-registers all built-in stacks.
 * To use a stack, import from this module and use the factory:
 *
 * @example
 * import { StackFactory, getStack } from '@/stacks'
 *
 * // Get default stack (Next.js + MongoDB)
 * const stack = getStack()
 *
 * // Get specific stack
 * const stack = getStack('fastapi-postgres')
 *
 * // List all available stacks
 * const stacks = StackFactory.listStacks()
 */

// Export types
export type {
  IStackHandler,
  ImportInfo,
  ExportInfo,
  ValidationError,
  DependencyInfo,
  PathAliases,
  FileStructure,
  PromptSection,
  PromptContext,
  StackInfo,
} from './types'

// Export base class for extending
export { BaseStackHandler } from './base'

// Export registry (for advanced usage and testing)
export { stackRegistry } from './registry'

// Export factory (main entry point)
export { StackFactory, getStack, getDefaultStack } from './factory'

// =============================================================================
// Auto-register built-in stacks
// These imports trigger registration via their side effects.
// All consumers are server-side only, so this doesn't affect client bundles.
// =============================================================================

import './nextjs-mongodb'
import './fastapi-postgres'
import './express-postgres'
