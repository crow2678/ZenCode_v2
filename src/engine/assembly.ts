/**
 * ZenCode V2 - Stack-Agnostic Assembly Engine
 *
 * Orchestrates the assembly process using stack handlers for stack-specific logic.
 * This is a pure TypeScript implementation with no database dependencies.
 */

import { StackFactory, getStack } from '@/stacks'
import type { IStackHandler, ValidationError } from '@/stacks/types'
import type {
  AssemblyInput,
  AssemblyResult,
  AssemblyStats,
  AssemblyOptions,
  PhaseResult,
  FileAnalysis,
  MissingFileInfo,
  AssemblyEvent,
  AssemblyEventHandler,
} from './types'

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<AssemblyOptions> = {
  validateImports: true,
  validateExports: true,
  extractDependencies: true,
  generateMissingFiles: true,
  maxValidationPasses: 3,
  dryRun: false,
}

// =============================================================================
// Assembly Engine
// =============================================================================

export class AssemblyEngine {
  private stack: IStackHandler
  private files: Map<string, string>
  private eventHandler?: AssemblyEventHandler

  constructor(stackId?: string) {
    this.stack = getStack(stackId)
    this.files = new Map()
  }

  /**
   * Set event handler for progress tracking
   */
  onEvent(handler: AssemblyEventHandler): void {
    this.eventHandler = handler
  }

  private emit(event: AssemblyEvent): void {
    this.eventHandler?.(event)
  }

  /**
   * Execute assembly process
   */
  async assemble(input: AssemblyInput): Promise<AssemblyResult> {
    const startTime = Date.now()
    const options = { ...DEFAULT_OPTIONS, ...input.options }
    const phases: PhaseResult[] = []

    // Initialize files from input
    this.files = new Map(input.existingFiles || [])

    // Resolve stack
    this.stack = getStack(input.stackId)

    // Phase 1: Apply work orders
    this.emit({ type: 'phase_start', phase: 'apply_work_orders' })
    const applyResult = await this.applyWorkOrders(input.workOrders)
    phases.push(applyResult)
    this.emit({ type: 'phase_complete', phase: 'apply_work_orders', status: applyResult.status })

    // Phase 2: Extract dependencies
    let dependencies: string[] = []
    if (options.extractDependencies) {
      this.emit({ type: 'phase_start', phase: 'extract_dependencies' })
      dependencies = this.extractDependencies()
      this.emit({ type: 'dependency_extracted', count: dependencies.length })
      phases.push({
        phase: 'extract_dependencies',
        status: 'success',
        filesProcessed: this.files.size,
        errors: [],
      })
      this.emit({ type: 'phase_complete', phase: 'extract_dependencies', status: 'success' })
    }

    // Phase 3: Validate and fix
    let allErrors: ValidationError[] = []
    if (options.validateImports || options.validateExports) {
      this.emit({ type: 'phase_start', phase: 'validation' })
      const validationResult = await this.validateAndFix(options)
      allErrors = validationResult.errors
      phases.push(validationResult)
      this.emit({ type: 'phase_complete', phase: 'validation', status: validationResult.status })
    }

    // Calculate stats
    const stats: AssemblyStats = {
      totalFiles: this.files.size,
      filesCreated: input.workOrders.reduce(
        (sum, wo) => sum + wo.files.filter((f) => f.action === 'create').length,
        0
      ),
      filesModified: input.workOrders.reduce(
        (sum, wo) => sum + wo.files.filter((f) => f.action === 'modify').length,
        0
      ),
      filesDeleted: input.workOrders.reduce(
        (sum, wo) => sum + wo.files.filter((f) => f.action === 'delete').length,
        0
      ),
      missingFilesGenerated: 0, // TODO: track this
      validationPasses: phases.filter((p) => p.phase === 'validation').length,
      errorsFixed: 0, // TODO: track this
      timeMs: Date.now() - startTime,
    }

    return {
      success: allErrors.filter((e) => e.severity === 'error').length === 0,
      projectId: input.projectId,
      stackId: this.stack.id,
      files: this.files,
      dependencies,
      validationErrors: allErrors,
      stats,
      phases,
    }
  }

  // ===========================================================================
  // Phase 1: Apply Work Orders
  // ===========================================================================

  private async applyWorkOrders(
    workOrders: AssemblyInput['workOrders']
  ): Promise<PhaseResult> {
    const errors: ValidationError[] = []
    let filesProcessed = 0

    for (const workOrder of workOrders) {
      for (const file of workOrder.files) {
        filesProcessed++

        switch (file.action) {
          case 'create':
          case 'modify':
            if (file.content) {
              this.files.set(file.path, file.content)
              this.emit({ type: 'file_processed', path: file.path, action: file.action })
            } else {
              errors.push({
                file: file.path,
                line: 0,
                message: `No content provided for ${file.action} action`,
                severity: 'error',
                fixable: false,
              })
            }
            break

          case 'delete':
            this.files.delete(file.path)
            this.emit({ type: 'file_processed', path: file.path, action: 'modify' })
            break
        }
      }
    }

    return {
      phase: 'apply_work_orders',
      status: errors.length > 0 ? 'partial' : 'success',
      filesProcessed,
      errors,
    }
  }

  // ===========================================================================
  // Phase 2: Extract Dependencies
  // ===========================================================================

  private extractDependencies(): string[] {
    const deps = new Set<string>()

    for (const [path, content] of this.files) {
      // Only process source files
      if (!this.isSourceFile(path)) continue

      const fileDeps = this.stack.parsePackageDependencies(content)
      fileDeps.forEach((d) => deps.add(d))
    }

    return Array.from(deps).sort()
  }

  private isSourceFile(path: string): boolean {
    return this.stack.sourceExtensions.some((ext) => path.endsWith(ext))
  }

  // ===========================================================================
  // Phase 3: Validate and Fix
  // ===========================================================================

  private async validateAndFix(
    options: Required<AssemblyOptions>
  ): Promise<PhaseResult> {
    const allErrors: ValidationError[] = []
    let pass = 0

    while (pass < options.maxValidationPasses) {
      pass++
      const errors = await this.runValidationPass(options)
      this.emit({ type: 'validation_pass', pass, errors: errors.length })

      if (errors.length === 0) {
        break
      }

      // Store unfixable errors
      const unfixable = errors.filter((e) => !e.fixable)
      allErrors.push(...unfixable)

      // If no fixable errors, stop
      const fixable = errors.filter((e) => e.fixable)
      if (fixable.length === 0) {
        allErrors.push(...errors)
        break
      }

      // TODO: Attempt to fix errors
      // For now, just collect them
      allErrors.push(...errors)
      break
    }

    return {
      phase: 'validation',
      status: allErrors.length > 0 ? 'partial' : 'success',
      filesProcessed: this.files.size,
      errors: allErrors,
    }
  }

  private async runValidationPass(
    options: Required<AssemblyOptions>
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = []
    const availableFiles = new Set(this.files.keys())

    for (const [filePath, content] of this.files) {
      if (!this.isSourceFile(filePath)) continue

      // Parse imports and check resolution
      if (options.validateImports) {
        const imports = this.stack.parseImports(content, filePath)

        for (const imp of imports) {
          // Skip external packages
          if (this.isExternalPackage(imp.source)) continue

          // Try to resolve the import
          const resolved = this.stack.resolveImportPath(
            imp.source,
            filePath,
            '', // projectDir not needed for in-memory
            availableFiles
          )

          if (!resolved) {
            errors.push({
              file: filePath,
              line: imp.line,
              message: `Unresolved import: ${imp.source}`,
              severity: 'error',
              fixable: false,
            })
          } else if (options.validateExports) {
            // Check that named imports exist in target exports
            const targetContent = this.files.get(resolved)
            if (targetContent) {
              const exports = this.stack.parseExports(targetContent, resolved)
              const exportNames = new Set(exports.map((e) => e.name))

              for (const name of imp.names) {
                if (!exportNames.has(name) && name !== 'default') {
                  errors.push({
                    file: filePath,
                    line: imp.line,
                    message: `Named import '${name}' not found in exports of ${resolved}`,
                    severity: 'error',
                    fixable: true,
                  })
                }
              }
            }
          }
        }
      }

      // Run stack-specific validation
      const fileErrors = this.stack.validateFile(content, filePath)
      errors.push(...fileErrors)
    }

    return errors
  }

  private isExternalPackage(source: string): boolean {
    // Relative imports are not external
    if (source.startsWith('.')) return false
    // Alias imports are not external
    if (source.startsWith('@/')) return false
    // Everything else is external
    return true
  }

  // ===========================================================================
  // Analysis Methods (for debugging/reporting)
  // ===========================================================================

  /**
   * Analyze all files and return detailed analysis
   */
  analyzeFiles(): FileAnalysis[] {
    const analyses: FileAnalysis[] = []
    const availableFiles = new Set(this.files.keys())

    for (const [filePath, content] of this.files) {
      if (!this.isSourceFile(filePath)) continue

      const imports = this.stack.parseImports(content, filePath)
      const exports = this.stack.parseExports(content, filePath)
      const deps = this.stack.parsePackageDependencies(content)
      const fileErrors = this.stack.validateFile(content, filePath)

      analyses.push({
        path: filePath,
        imports: imports.map((imp) => ({
          ...imp,
          resolved: !this.isExternalPackage(imp.source)
            ? !!this.stack.resolveImportPath(imp.source, filePath, '', availableFiles)
            : true,
          resolvedPath: !this.isExternalPackage(imp.source)
            ? this.stack.resolveImportPath(imp.source, filePath, '', availableFiles) ?? undefined
            : undefined,
        })),
        exports: exports.map((exp) => ({
          name: exp.name,
          type: exp.type,
          line: exp.line,
        })),
        externalDeps: deps,
        errors: fileErrors,
      })
    }

    return analyses
  }

  /**
   * Find missing files that are imported but don't exist
   */
  findMissingFiles(): MissingFileInfo[] {
    const missing = new Map<string, MissingFileInfo>()
    const availableFiles = new Set(this.files.keys())

    for (const [filePath, content] of this.files) {
      if (!this.isSourceFile(filePath)) continue

      const imports = this.stack.parseImports(content, filePath)

      for (const imp of imports) {
        if (this.isExternalPackage(imp.source)) continue

        const resolved = this.stack.resolveImportPath(
          imp.source,
          filePath,
          '',
          availableFiles
        )

        if (!resolved) {
          // Determine the expected path
          const expectedPath = this.resolveToPath(imp.source, filePath)

          if (!missing.has(expectedPath)) {
            missing.set(expectedPath, {
              path: expectedPath,
              requiredExports: [],
              importedBy: [],
            })
          }

          const info = missing.get(expectedPath)!
          info.requiredExports.push(...imp.names)
          if (!info.importedBy.includes(filePath)) {
            info.importedBy.push(filePath)
          }
        }
      }
    }

    // Dedupe required exports
    for (const info of missing.values()) {
      info.requiredExports = [...new Set(info.requiredExports)]
    }

    return Array.from(missing.values())
  }

  private resolveToPath(source: string, fromFile: string): string {
    if (source.startsWith('@/')) {
      return source.replace('@/', 'src/') + '.ts'
    }
    if (source.startsWith('.')) {
      const fromDir = fromFile.split('/').slice(0, -1).join('/')
      const parts = source.split('/')
      let current = fromDir.split('/')

      for (const part of parts) {
        if (part === '..') {
          current.pop()
        } else if (part !== '.') {
          current.push(part)
        }
      }

      return current.join('/') + '.ts'
    }
    return source
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  getFiles(): Map<string, string> {
    return new Map(this.files)
  }

  getStack(): IStackHandler {
    return this.stack
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createAssemblyEngine(stackId?: string): AssemblyEngine {
  return new AssemblyEngine(stackId)
}
