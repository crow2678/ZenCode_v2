/**
 * ZenCode V2 - FastAPI + PostgreSQL Stack Handler
 *
 * Full implementation of IStackHandler for FastAPI with SQLAlchemy and PostgreSQL
 */

import { readFile } from 'fs/promises'
import path from 'path'
import { BaseStackHandler } from '../base'
import { stackRegistry } from '../registry'
import type {
  ImportInfo,
  ExportInfo,
  ValidationError,
  DependencyInfo,
  PathAliases,
  FileStructure,
  PromptSection,
  PromptContext,
} from '../types'
import * as prompts from './prompts'
import * as templates from './templates'

export class FastAPIPostgresHandler extends BaseStackHandler {
  // =========================================================================
  // Identity
  // =========================================================================
  readonly id = 'fastapi-postgres'
  readonly name = 'FastAPI + PostgreSQL'
  readonly description = 'FastAPI with SQLAlchemy ORM, PostgreSQL, and Pydantic v2'
  readonly icon = '🐍'
  readonly version = '1.0.0'

  // =========================================================================
  // Language/Framework
  // =========================================================================
  readonly language = 'python' as const
  readonly framework = 'fastapi'
  readonly runtime = 'python' as const

  // =========================================================================
  // File Handling
  // =========================================================================
  readonly sourceExtensions = ['.py']
  readonly configFiles = ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg']
  readonly indexFileNames = ['__init__.py']

  readonly fileStructure: FileStructure = {
    models: 'app/models',
    services: 'app/services',
    routes: 'app/routers',
    pages: 'templates',
    components: 'app/dependencies',
    utils: 'app/utils',
  }

  // =========================================================================
  // Dependency Management
  // =========================================================================
  readonly dependencyFile = 'requirements.txt'
  readonly lockFile = 'requirements.lock'

  // =========================================================================
  // Parsing: Imports
  // =========================================================================

  parseImports(content: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineNum = i + 1

      // from X import Y, Z
      const fromImportMatch = line.match(/^from\s+([\w.]+)\s+import\s+(.+)$/)
      if (fromImportMatch) {
        const source = fromImportMatch[1]
        const importsStr = fromImportMatch[2]

        // Handle multi-line imports with parentheses
        let fullImports = importsStr
        if (importsStr.includes('(') && !importsStr.includes(')')) {
          // Multi-line import, gather until closing paren
          let j = i + 1
          while (j < lines.length && !lines[j].includes(')')) {
            fullImports += ' ' + lines[j].trim()
            j++
          }
          if (j < lines.length) {
            fullImports += ' ' + lines[j].trim()
          }
        }

        // Parse imported names
        const names = fullImports
          .replace(/[()]/g, '')
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => {
            // Handle "X as Y" - use local name Y
            const asMatch = n.match(/(\w+)\s+as\s+(\w+)/)
            return asMatch ? asMatch[2] : n
          })

        if (names.length > 0) {
          imports.push({
            names,
            source,
            line: lineNum,
            isDefault: false,
            isTypeOnly: false,
          })
        }
        continue
      }

      // import X, Y, Z
      const importMatch = line.match(/^import\s+(.+)$/)
      if (importMatch) {
        const importsStr = importMatch[1]
        const names = importsStr
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => {
            const asMatch = n.match(/(\w+)\s+as\s+(\w+)/)
            return asMatch ? asMatch[2] : n.split('.')[0] // Just the root module
          })

        for (const name of names) {
          imports.push({
            names: [name],
            source: name,
            line: lineNum,
            isDefault: true,
            isTypeOnly: false,
          })
        }
      }
    }

    return imports
  }

  // =========================================================================
  // Parsing: Exports
  // =========================================================================

  parseExports(content: string, filePath: string): ExportInfo[] {
    const exports: ExportInfo[] = []
    const lines = content.split('\n')
    const seen = new Set<string>()

    const addExport = (name: string, type: ExportInfo['type'], line: number) => {
      if (!seen.has(name)) {
        seen.add(name)
        exports.push({ name, type, line })
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      // Class definition
      const classMatch = line.match(/^class\s+(\w+)/)
      if (classMatch) {
        addExport(classMatch[1], 'value', lineNum)
        continue
      }

      // Function definition (not private)
      const funcMatch = line.match(/^(?:async\s+)?def\s+(\w+)/)
      if (funcMatch && !funcMatch[1].startsWith('_')) {
        addExport(funcMatch[1], 'value', lineNum)
        continue
      }

      // Top-level variable assignment
      const varMatch = line.match(/^(\w+)\s*[=:]/)
      if (varMatch && !varMatch[1].startsWith('_') && !line.includes('(')) {
        addExport(varMatch[1], 'value', lineNum)
        continue
      }

      // __all__ list
      const allMatch = line.match(/__all__\s*=\s*\[([^\]]+)\]/)
      if (allMatch) {
        const names = allMatch[1]
          .split(',')
          .map((n) => n.trim().replace(/['"]/g, ''))
          .filter(Boolean)
        for (const name of names) {
          addExport(name, 'value', lineNum)
        }
      }
    }

    return exports
  }

  // =========================================================================
  // Parsing: Package Dependencies
  // =========================================================================

  parsePackageDependencies(content: string): string[] {
    const deps = new Set<string>()

    // from X import ... or import X
    const importRegex = /(?:from|import)\s+([\w]+)/g
    let match: RegExpExecArray | null

    while ((match = importRegex.exec(content)) !== null) {
      const pkg = match[1]
      // Filter out local imports (app, tests, etc.)
      if (!['app', 'tests', 'config', 'models', 'schemas', 'services', 'routers', 'dependencies', 'utils'].includes(pkg)) {
        deps.add(pkg)
      }
    }

    return Array.from(deps)
  }

  // =========================================================================
  // Path Resolution
  // =========================================================================

  async getPathAliases(projectDir: string): Promise<PathAliases> {
    // Python doesn't typically use path aliases like JS/TS
    // Imports are relative to the project root or installed packages
    return {}
  }

  resolveImportPath(
    importSource: string,
    fromFile: string,
    projectDir: string,
    availableFiles: Set<string>
  ): string | null {
    // Convert Python import to file path
    // e.g., "app.models.user" -> "app/models/user.py"
    // e.g., "app.models" -> "app/models/__init__.py"

    const parts = importSource.split('.')
    const basePath = parts.join('/')

    // Try as module file
    const modulePath = basePath + '.py'
    if (availableFiles.has(modulePath)) return modulePath

    // Try as package __init__.py
    const initPath = basePath + '/__init__.py'
    if (availableFiles.has(initPath)) return initPath

    // Relative imports (starts with .)
    if (importSource.startsWith('.')) {
      const fromDir = path.dirname(fromFile)
      const relativeParts = importSource.replace(/^\.+/, '').split('.')
      const dots = importSource.match(/^\.+/)?.[0].length || 0

      let current = fromDir.split('/')
      for (let i = 1; i < dots; i++) {
        current.pop()
      }

      const resolved = [...current, ...relativeParts].join('/')

      if (availableFiles.has(resolved + '.py')) return resolved + '.py'
      if (availableFiles.has(resolved + '/__init__.py')) return resolved + '/__init__.py'
    }

    return null
  }

  // =========================================================================
  // Dependency File Handling
  // =========================================================================

  parseDependencyFile(content: string): DependencyInfo[] {
    const deps: DependencyInfo[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      // Parse package specification
      // e.g., "fastapi>=0.109.0" or "fastapi==0.109.0" or "fastapi"
      const match = trimmed.match(/^([a-zA-Z0-9_-]+(?:\[[^\]]+\])?)(.*)$/)
      if (match) {
        const name = match[1].replace(/\[.*\]/, '') // Remove extras like [asyncio]
        const version = match[2] || '*'
        deps.push({ name, version, dev: false })
      }
    }

    return deps
  }

  serializeDependencyFile(deps: DependencyInfo[], existing?: string): string {
    const existingDeps = new Map<string, string>()

    if (existing) {
      for (const line of existing.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const match = trimmed.match(/^([a-zA-Z0-9_-]+(?:\[[^\]]+\])?)(.*)$/)
        if (match) {
          existingDeps.set(match[1].replace(/\[.*\]/, ''), trimmed)
        }
      }
    }

    // Add new deps
    for (const dep of deps) {
      if (!existingDeps.has(dep.name)) {
        existingDeps.set(dep.name, `${dep.name}${dep.version !== '*' ? dep.version : ''}`)
      }
    }

    return Array.from(existingDeps.values()).sort().join('\n')
  }

  getInstallCommand(deps: string[]): string {
    if (deps.length === 0) return ''
    return `pip install ${deps.join(' ')}`
  }

  // =========================================================================
  // Validation
  // =========================================================================

  getTypeCheckCommand(): string {
    return 'mypy app'
  }

  getLintCommand(): string {
    return 'ruff check app'
  }

  validateFile(content: string, filePath: string): ValidationError[] {
    const errors: ValidationError[] = []

    // 1. Check for async def without await in DB operations
    if (filePath.includes('services/') || filePath.includes('routers/')) {
      if (content.includes('async def')) {
        // Check if using session but missing await
        if (content.includes('db.execute') && !content.includes('await db.execute')) {
          errors.push({
            file: filePath,
            line: this.findLine(content, 'db.execute'),
            message: 'db.execute must be awaited in async function',
            severity: 'error',
            fixable: true,
          })
        }
        if (content.includes('db.commit') && !content.includes('await db.commit')) {
          errors.push({
            file: filePath,
            line: this.findLine(content, 'db.commit'),
            message: 'db.commit must be awaited in async function',
            severity: 'error',
            fixable: true,
          })
        }
      }
    }

    // 2. Check for Pydantic v1 patterns in v2 codebase
    if (content.includes('class Config:')) {
      if (content.includes('orm_mode = True')) {
        errors.push({
          file: filePath,
          line: this.findLine(content, 'orm_mode'),
          message: 'Use "from_attributes = True" instead of "orm_mode = True" (Pydantic v2)',
          severity: 'error',
          fixable: true,
        })
      }
    }

    // 3. Check for missing __init__.py in packages
    if (filePath.includes('/') && filePath.endsWith('.py') && !filePath.endsWith('__init__.py')) {
      // This file is in a subdirectory, check pattern
      const dir = path.dirname(filePath)
      // We can't check for __init__.py here without access to file list
      // but we can warn about common issues
    }

    // 4. Check for router not using APIRouter
    if (filePath.includes('routers/') && !filePath.endsWith('__init__.py')) {
      if (!content.includes('APIRouter')) {
        errors.push({
          file: filePath,
          line: 1,
          message: 'Router file should use APIRouter from fastapi',
          severity: 'warning',
          fixable: false,
        })
      }
    }

    return errors
  }

  private findLine(content: string, search: string): number {
    const idx = content.indexOf(search)
    if (idx === -1) return 1
    return content.substring(0, idx).split('\n').length
  }

  // =========================================================================
  // AI Prompts
  // =========================================================================

  getPromptSection(section: PromptSection): string {
    return prompts.getPromptSection(section)
  }

  buildSystemPrompt(context: PromptContext): string {
    return prompts.buildSystemPrompt(context)
  }

  // =========================================================================
  // Templates
  // =========================================================================

  getScaffoldTemplates(): Map<string, string> {
    return templates.getScaffoldTemplates()
  }

  getRequiredFiles(): string[] {
    return templates.getRequiredFiles()
  }
}

// =============================================================================
// Auto-register with the registry
// =============================================================================

const handler = new FastAPIPostgresHandler()
stackRegistry.register(handler)

export { handler as fastapiPostgresHandler }
