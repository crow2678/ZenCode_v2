/**
 * ZenCode V2 - Assembly Engine Types
 *
 * Types for the stack-agnostic assembly engine
 */

import type { ValidationError } from '@/stacks/types'

// =============================================================================
// Input Types
// =============================================================================

export interface WorkOrder {
  id: string
  title: string
  description: string
  files: WorkOrderFile[]
  dependencies?: string[]
  phase?: string
}

export interface WorkOrderFile {
  path: string
  action: 'create' | 'modify' | 'delete'
  content?: string
  description?: string
}

export interface AssemblyInput {
  projectId: string
  projectName: string
  stackId?: string // If not provided, uses default
  workOrders: WorkOrder[]
  existingFiles?: Map<string, string>
  options?: AssemblyOptions
}

export interface AssemblyOptions {
  validateImports?: boolean
  validateExports?: boolean
  extractDependencies?: boolean
  generateMissingFiles?: boolean
  maxValidationPasses?: number
  dryRun?: boolean
}

// =============================================================================
// Output Types
// =============================================================================

export interface AssemblyResult {
  success: boolean
  projectId: string
  stackId: string
  files: Map<string, string>
  dependencies: string[]
  validationErrors: ValidationError[]
  stats: AssemblyStats
  phases: PhaseResult[]
}

export interface AssemblyStats {
  totalFiles: number
  filesCreated: number
  filesModified: number
  filesDeleted: number
  missingFilesGenerated: number
  validationPasses: number
  errorsFixed: number
  timeMs: number
}

export interface PhaseResult {
  phase: string
  status: 'success' | 'partial' | 'failed'
  filesProcessed: number
  errors: ValidationError[]
}

// =============================================================================
// Intermediate Types
// =============================================================================

export interface FileAnalysis {
  path: string
  imports: ImportAnalysis[]
  exports: ExportAnalysis[]
  externalDeps: string[]
  errors: ValidationError[]
}

export interface ImportAnalysis {
  names: string[]
  source: string
  line: number
  resolved: boolean
  resolvedPath?: string
}

export interface ExportAnalysis {
  name: string
  type: 'value' | 'type' | 'default'
  line: number
}

export interface MissingFileInfo {
  path: string
  requiredExports: string[]
  importedBy: string[]
}

// =============================================================================
// Events (for progress tracking)
// =============================================================================

export type AssemblyEvent =
  | { type: 'phase_start'; phase: string }
  | { type: 'phase_complete'; phase: string; status: 'success' | 'partial' | 'failed' }
  | { type: 'file_processed'; path: string; action: 'create' | 'modify' | 'validate' }
  | { type: 'validation_pass'; pass: number; errors: number }
  | { type: 'dependency_extracted'; count: number }
  | { type: 'missing_file_generated'; path: string }
  | { type: 'error'; message: string }

export type AssemblyEventHandler = (event: AssemblyEvent) => void
