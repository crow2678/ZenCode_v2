/**
 * ZenCode V2 - Stack Handler Type Definitions
 *
 * This file defines the core interfaces that all stack handlers must implement.
 * The plugin architecture allows adding new stacks by simply implementing IStackHandler.
 */

// ============================================================================
// Import/Export Types
// ============================================================================

export interface ImportInfo {
  /** Imported names: ['useState', 'useEffect'] or ['default'] */
  names: string[]
  /** Import source: 'react' or './utils' or '@/lib/trpc' */
  source: string
  /** Line number in the file */
  line: number
  /** Whether this is a default import */
  isDefault: boolean
  /** Whether this is a type-only import (import type { X }) */
  isTypeOnly: boolean
}

export interface ExportInfo {
  /** Exported name */
  name: string
  /** Export type: value (const/function), type (interface/type), or default */
  type: 'value' | 'type' | 'default'
  /** Line number in the file */
  line: number
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  /** Relative file path */
  file: string
  /** Line number */
  line: number
  /** Error message */
  message: string
  /** Severity level */
  severity: 'error' | 'warning'
  /** Whether this error can be auto-fixed */
  fixable: boolean
}

// ============================================================================
// Dependency Types
// ============================================================================

export interface DependencyInfo {
  /** Package name */
  name: string
  /** Version string (e.g., "^1.0.0") */
  version: string
  /** Whether this is a dev dependency */
  dev: boolean
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface PathAliases {
  /** Alias prefix to resolved path: { '@/': 'src/' } */
  [alias: string]: string
}

export interface FileStructure {
  /** Path to models/schemas: 'src/lib/db/models' or 'app/models' */
  models: string
  /** Path to services/business logic: 'src/server/services' */
  services: string
  /** Path to API routes: 'src/server/trpc/procedures' or 'app/routers' */
  routes: string
  /** Path to pages/views: 'src/app' or 'pages' */
  pages: string
  /** Path to UI components: 'src/components' */
  components: string
  /** Path to utilities: 'src/lib' */
  utils: string
}

// ============================================================================
// Prompt Types
// ============================================================================

export type PromptSection =
  | 'project-structure'
  | 'code-patterns'
  | 'component-patterns'
  | 'validation-checklist'
  | 'model-patterns'
  | 'service-patterns'
  | 'route-patterns'
  | 'auth-patterns'
  // Generation pipeline sections
  | 'prd'
  | 'blueprint'
  | 'work-orders'
  | 'agent-execution'
  // Assembly pipeline sections
  | 'scaffold'
  | 'missing_files'
  | 'validation_fixes'
  | 'wiring'

export interface PromptContext {
  projectName?: string
  authType?: 'none' | 'clerk' | 'auth0' | 'firebase' | 'custom'
  features?: string[]
  existingFiles?: string[]
}

// ============================================================================
// Stack Handler Interface
// ============================================================================

/**
 * The core interface that all stack handlers must implement.
 *
 * To add a new stack:
 * 1. Create a class that implements IStackHandler
 * 2. Register it with stackRegistry.register(new YourHandler())
 * 3. The stack is now available throughout the system
 */
export interface IStackHandler {
  // === Identity ===

  /** Unique identifier: 'nextjs-mongodb', 'fastapi-postgres' */
  readonly id: string
  /** Display name: 'Next.js + MongoDB' */
  readonly name: string
  /** Description for UI */
  readonly description: string
  /** Icon (emoji or icon name) */
  readonly icon: string
  /** Handler version */
  readonly version: string

  // === Language/Framework Info ===

  /** Primary language */
  readonly language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'ruby' | 'php'
  /** Framework name: 'nextjs', 'fastapi', 'express', 'django' */
  readonly framework: string
  /** Runtime environment */
  readonly runtime: 'node' | 'python' | 'go' | 'jvm' | 'rust' | 'ruby' | 'php'

  // === File Handling ===

  /** Source file extensions: ['.ts', '.tsx'] or ['.py'] */
  readonly sourceExtensions: string[]
  /** Config files to look for: ['tsconfig.json', 'package.json'] */
  readonly configFiles: string[]
  /** Index/barrel file names: ['index.ts'] or ['__init__.py'] */
  readonly indexFileNames: string[]
  /** Standard file structure paths */
  readonly fileStructure: FileStructure

  // === Parsing Methods ===

  /**
   * Parse imports from file content
   * @param content - File content
   * @param filePath - Relative file path (for context)
   * @returns Array of import information
   */
  parseImports(content: string, filePath: string): ImportInfo[]

  /**
   * Parse exports from file content
   * @param content - File content
   * @param filePath - Relative file path (for context)
   * @returns Array of export information
   */
  parseExports(content: string, filePath: string): ExportInfo[]

  /**
   * Extract external package names from file content
   * @param content - File content
   * @returns Array of package names (e.g., ['react', 'mongoose'])
   */
  parsePackageDependencies(content: string): string[]

  // === Path Resolution ===

  /**
   * Get path aliases from project config (tsconfig.json, etc.)
   * @param projectDir - Project root directory
   * @returns Map of alias prefix to resolved path
   */
  getPathAliases(projectDir: string): Promise<PathAliases>

  /**
   * Resolve an import path to an actual file
   * @param importSource - The import source (e.g., '@/lib/utils' or './helpers')
   * @param fromFile - File that contains the import
   * @param projectDir - Project root directory
   * @param availableFiles - Set of available file paths
   * @returns Resolved file path or null if not found
   */
  resolveImportPath(
    importSource: string,
    fromFile: string,
    projectDir: string,
    availableFiles: Set<string>
  ): string | null

  // === Dependency Management ===

  /** Dependency file name: 'package.json', 'requirements.txt' */
  readonly dependencyFile: string
  /** Lock file name: 'package-lock.json', 'poetry.lock' */
  readonly lockFile: string

  /**
   * Parse dependency file content
   * @param content - Dependency file content
   * @returns Array of dependencies
   */
  parseDependencyFile(content: string): DependencyInfo[]

  /**
   * Serialize dependencies back to file format
   * @param deps - Dependencies to add
   * @param existing - Existing file content (optional)
   * @returns Updated file content
   */
  serializeDependencyFile(deps: DependencyInfo[], existing?: string): string

  /**
   * Get command to install dependencies
   * @param deps - Package names to install
   * @returns Command string (e.g., 'npm install react mongoose')
   */
  getInstallCommand(deps: string[]): string

  // === Validation ===

  /**
   * Get type check command
   * @returns Command or null if no type checking
   */
  getTypeCheckCommand(): string | null

  /**
   * Get lint command
   * @returns Command or null if no linting
   */
  getLintCommand(): string | null

  /**
   * Validate file content for stack-specific issues
   * @param content - File content
   * @param filePath - Relative file path
   * @returns Array of validation errors
   */
  validateFile(content: string, filePath: string): ValidationError[]

  // === AI Prompts ===

  /**
   * Get a specific prompt section
   * @param section - Section to retrieve
   * @returns Prompt text for that section
   */
  getPromptSection(section: PromptSection): string

  /**
   * Build complete system prompt for AI
   * @param context - Context for prompt building
   * @returns Complete system prompt
   */
  buildSystemPrompt(context: PromptContext): string

  // === Templates ===

  /**
   * Get scaffold template files
   * @returns Map of filename to content
   */
  getScaffoldTemplates(): Map<string, string>

  /**
   * Get list of files that must exist in a valid project
   * @returns Array of required file paths
   */
  getRequiredFiles(): string[]
}

// ============================================================================
// Stack Info (for listing)
// ============================================================================

export interface StackInfo {
  id: string
  name: string
  description: string
  icon: string
  language: string
  framework: string
  version: string
}
