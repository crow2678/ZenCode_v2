/**
 * ZenCode V2 - Base Stack Handler
 *
 * Abstract base class that provides common functionality for all stack handlers.
 * Implements template methods that delegate to abstract methods.
 */

import { readFile, readdir, stat } from 'fs/promises'
import path from 'path'
import type {
  IStackHandler,
  ImportInfo,
  ExportInfo,
  ValidationError,
  DependencyInfo,
  PathAliases,
  FileStructure,
  PromptSection,
  PromptContext,
} from './types'

export abstract class BaseStackHandler implements IStackHandler {
  // === Abstract Identity Properties ===
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly icon: string
  abstract readonly version: string

  // === Abstract Language/Framework Properties ===
  abstract readonly language: IStackHandler['language']
  abstract readonly framework: string
  abstract readonly runtime: IStackHandler['runtime']

  // === Abstract File Handling Properties ===
  abstract readonly sourceExtensions: string[]
  abstract readonly configFiles: string[]
  abstract readonly indexFileNames: string[]
  abstract readonly fileStructure: FileStructure

  // === Abstract Dependency Properties ===
  abstract readonly dependencyFile: string
  abstract readonly lockFile: string

  // =========================================================================
  // Template Methods (common logic, delegates to abstract methods)
  // =========================================================================

  /**
   * Validate an entire project directory
   * Template method that uses stack-specific parsing
   */
  async validate(projectDir: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = []
    const files = await this.walkSourceFiles(projectDir)
    const availableFiles = new Set(files.map((f) => this.relativePath(f, projectDir)))
    const aliases = await this.getPathAliases(projectDir)

    for (const file of files) {
      const content = await readFile(file, 'utf-8')
      const relativePath = this.relativePath(file, projectDir)

      // Parse imports using stack-specific logic
      const imports = this.parseImports(content, relativePath)

      // Validate each import resolves
      for (const imp of imports) {
        // Skip external packages
        if (this.isExternalPackage(imp.source, aliases)) continue

        const resolved = this.resolveImportPath(
          imp.source,
          relativePath,
          projectDir,
          availableFiles
        )

        if (!resolved) {
          errors.push({
            file: relativePath,
            line: imp.line,
            message: `Unresolved import: ${imp.source}`,
            severity: 'error',
            fixable: false,
          })
        }
      }

      // Stack-specific file validation
      errors.push(...this.validateFile(content, relativePath))
    }

    return errors
  }

  /**
   * Extract all external dependencies from project
   */
  async extractDependencies(projectDir: string): Promise<string[]> {
    const deps = new Set<string>()
    const files = await this.walkSourceFiles(projectDir)

    for (const file of files) {
      const content = await readFile(file, 'utf-8')
      const fileDeps = this.parsePackageDependencies(content)
      fileDeps.forEach((d) => deps.add(d))
    }

    return Array.from(deps)
  }

  // =========================================================================
  // Common Helper Methods
  // =========================================================================

  /**
   * Walk directory and return all source files
   */
  protected async walkSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    const walk = async (currentDir: string) => {
      const entries = await readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (!['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv'].includes(entry.name)) {
            await walk(fullPath)
          }
        } else if (this.sourceExtensions.includes(path.extname(entry.name))) {
          files.push(fullPath)
        }
      }
    }

    await walk(dir)
    return files
  }

  /**
   * Get relative path with forward slashes
   */
  protected relativePath(file: string, base: string): string {
    return path.relative(base, file).replace(/\\/g, '/')
  }

  /**
   * Check if an import source is an external package
   */
  protected isExternalPackage(source: string, aliases: PathAliases): boolean {
    // Relative imports are not external
    if (source.startsWith('.')) return false

    // Aliased imports are not external
    for (const alias of Object.keys(aliases)) {
      if (source.startsWith(alias)) return false
    }

    // Everything else is external
    return true
  }

  /**
   * Check if a file exists
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      const s = await stat(filePath)
      return s.isFile()
    } catch {
      return false
    }
  }

  /**
   * Check if a directory exists
   */
  protected async dirExists(dirPath: string): Promise<boolean> {
    try {
      const s = await stat(dirPath)
      return s.isDirectory()
    } catch {
      return false
    }
  }

  // =========================================================================
  // Abstract Methods (each stack must implement)
  // =========================================================================

  abstract parseImports(content: string, filePath: string): ImportInfo[]
  abstract parseExports(content: string, filePath: string): ExportInfo[]
  abstract parsePackageDependencies(content: string): string[]

  abstract getPathAliases(projectDir: string): Promise<PathAliases>
  abstract resolveImportPath(
    importSource: string,
    fromFile: string,
    projectDir: string,
    availableFiles: Set<string>
  ): string | null

  abstract parseDependencyFile(content: string): DependencyInfo[]
  abstract serializeDependencyFile(deps: DependencyInfo[], existing?: string): string
  abstract getInstallCommand(deps: string[]): string

  abstract getTypeCheckCommand(): string | null
  abstract getLintCommand(): string | null
  abstract validateFile(content: string, filePath: string): ValidationError[]

  abstract getPromptSection(section: PromptSection): string
  abstract buildSystemPrompt(context: PromptContext): string

  abstract getScaffoldTemplates(): Map<string, string>
  abstract getRequiredFiles(): string[]
}
