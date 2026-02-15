/**
 * ZenCode V2 - Express + PostgreSQL Stack Handler
 *
 * Full implementation of IStackHandler for Express with Sequelize and PostgreSQL
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

export class ExpressPostgresHandler extends BaseStackHandler {
  // =========================================================================
  // Identity
  // =========================================================================
  readonly id = 'express-postgres'
  readonly name = 'Express + PostgreSQL'
  readonly description = 'Express.js with Sequelize ORM, PostgreSQL, and JWT authentication'
  readonly icon = '🚀'
  readonly version = '1.0.0'

  // =========================================================================
  // Language/Framework
  // =========================================================================
  readonly language = 'typescript' as const
  readonly framework = 'express'
  readonly runtime = 'node' as const

  // =========================================================================
  // File Handling
  // =========================================================================
  readonly sourceExtensions = ['.ts', '.js']
  readonly configFiles = ['tsconfig.json', 'package.json']
  readonly indexFileNames = ['index.ts', 'index.js']

  readonly fileStructure: FileStructure = {
    models: 'src/models',
    services: 'src/services',
    routes: 'src/routes',
    pages: 'src/views',
    components: 'src/views/components',
    utils: 'src/utils',
  }

  // =========================================================================
  // Dependency Management
  // =========================================================================
  readonly dependencyFile = 'package.json'
  readonly lockFile = 'package-lock.json'

  // =========================================================================
  // Parsing: Imports
  // =========================================================================

  parseImports(content: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = []

    // Match ES6 imports: import { X } from 'source' or import X from 'source'
    const importRegex = /import\s+(?:(type)\s+)?(?:(\{[^}]+\})|(\*\s+as\s+\w+)|(\w+))(?:\s*,\s*(\{[^}]+\}))?\s+from\s+['"]([^'"]+)['"]/g

    let match: RegExpExecArray | null

    while ((match = importRegex.exec(content)) !== null) {
      const isTypeOnly = !!match[1]
      const namedImports = match[2] || match[5]
      const namespaceImport = match[3]
      const defaultImport = match[4]
      const source = match[6]

      const beforeMatch = content.substring(0, match.index)
      const line = beforeMatch.split('\n').length

      const names: string[] = []
      let isDefault = false

      if (defaultImport) {
        names.push(defaultImport)
        isDefault = true
      }

      if (namedImports) {
        const cleaned = namedImports.replace(/[{}]/g, '').trim()
        const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean)
        for (const part of parts) {
          const asMatch = part.match(/(\w+)\s+as\s+(\w+)/)
          if (asMatch) {
            names.push(asMatch[2])
          } else if (part.match(/^type\s+/)) {
            names.push(part.replace(/^type\s+/, ''))
          } else {
            names.push(part)
          }
        }
      }

      if (namespaceImport) {
        const nsMatch = namespaceImport.match(/\*\s+as\s+(\w+)/)
        if (nsMatch) {
          names.push(nsMatch[1])
          isDefault = true
        }
      }

      if (names.length > 0) {
        imports.push({
          names,
          source,
          line,
          isDefault,
          isTypeOnly,
        })
      }
    }

    // Also match require()
    const requireRegex = /(?:const|let|var)\s+(\{[^}]+\}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      const names: string[] = []
      const binding = match[1]
      const source = match[2]

      const beforeMatch = content.substring(0, match.index)
      const line = beforeMatch.split('\n').length

      if (binding.startsWith('{')) {
        const cleaned = binding.replace(/[{}]/g, '').trim()
        const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean)
        for (const part of parts) {
          const colonMatch = part.match(/(\w+)\s*:\s*(\w+)/)
          if (colonMatch) {
            names.push(colonMatch[2])
          } else {
            names.push(part)
          }
        }
      } else {
        names.push(binding)
      }

      if (names.length > 0) {
        imports.push({
          names,
          source,
          line,
          isDefault: !binding.startsWith('{'),
          isTypeOnly: false,
        })
      }
    }

    return imports
  }

  // =========================================================================
  // Parsing: Exports
  // =========================================================================

  parseExports(content: string, filePath: string): ExportInfo[] {
    const exports: ExportInfo[] = []
    const seen = new Set<string>()

    const addExport = (name: string, type: ExportInfo['type'], line: number) => {
      const key = `${name}:${type}`
      if (!seen.has(key)) {
        seen.add(key)
        exports.push({ name, type, line })
      }
    }

    // export const/let/var/function/class/interface/type/enum X
    const namedExportRegex = /export\s+(?:(type)\s+)?(const|let|var|function|class|interface|type|enum)\s+(\w+)/g
    let match: RegExpExecArray | null
    while ((match = namedExportRegex.exec(content)) !== null) {
      const isTypeKeyword = !!match[1]
      const kind = match[2]
      const name = match[3]
      const beforeMatch = content.substring(0, match.index)
      const line = beforeMatch.split('\n').length

      const exportType: ExportInfo['type'] =
        isTypeKeyword || kind === 'interface' || kind === 'type' ? 'type' : 'value'
      addExport(name, exportType, line)
    }

    // export default
    const defaultExportRegex = /export\s+default\s/g
    while ((match = defaultExportRegex.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index)
      const line = beforeMatch.split('\n').length
      addExport('default', 'default', line)
    }

    // export { X, Y, Z }
    const bracedExportRegex = /export\s+(?:type\s+)?\{([^}]+)\}(?:\s+from\s+['"][^'"]+['"])?/g
    while ((match = bracedExportRegex.exec(content)) !== null) {
      const inner = match[1]
      const beforeMatch = content.substring(0, match.index)
      const line = beforeMatch.split('\n').length

      const parts = inner.split(',').map((p) => p.trim()).filter(Boolean)
      for (const part of parts) {
        const asMatch = part.match(/(\w+)\s+as\s+(\w+)/)
        const name = asMatch ? asMatch[2] : part.replace(/^type\s+/, '').trim()
        const isType = part.startsWith('type ') || match[0].includes('export type')
        addExport(name, isType ? 'type' : 'value', line)
      }
    }

    return exports
  }

  // =========================================================================
  // Parsing: Package Dependencies
  // =========================================================================

  parsePackageDependencies(content: string): string[] {
    const deps = new Set<string>()

    // ES6 imports
    const jsImportRegex = /(?:import|from)\s+['"]([^./'"@][^'"]*)['"]/g
    const scopedImportRegex = /(?:import|from)\s+['"](@[^/'"]+\/[^'"]+)['"]/g
    const requireRegex = /require\s*\(\s*['"]([^./'"]+)['"]\s*\)/g
    const scopedRequireRegex = /require\s*\(\s*['"](@[^/'"]+\/[^'"]+)['"]\s*\)/g

    let match: RegExpExecArray | null

    while ((match = jsImportRegex.exec(content)) !== null) {
      const pkg = match[1].split('/')[0]
      deps.add(pkg)
    }

    while ((match = scopedImportRegex.exec(content)) !== null) {
      const full = match[1]
      const parts = full.split('/')
      const pkg = parts.slice(0, 2).join('/')
      deps.add(pkg)
    }

    while ((match = requireRegex.exec(content)) !== null) {
      const pkg = match[1].split('/')[0]
      deps.add(pkg)
    }

    while ((match = scopedRequireRegex.exec(content)) !== null) {
      const full = match[1]
      const parts = full.split('/')
      const pkg = parts.slice(0, 2).join('/')
      deps.add(pkg)
    }

    return Array.from(deps)
  }

  // =========================================================================
  // Path Resolution
  // =========================================================================

  async getPathAliases(projectDir: string): Promise<PathAliases> {
    const aliases: PathAliases = {}

    try {
      const tsconfigPath = path.join(projectDir, 'tsconfig.json')
      const tsconfigContent = await readFile(tsconfigPath, 'utf-8')

      const jsonContent = tsconfigContent
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')

      const tsconfig = JSON.parse(jsonContent)
      const paths = tsconfig.compilerOptions?.paths || {}

      for (const [alias, targets] of Object.entries(paths)) {
        if (Array.isArray(targets) && targets.length > 0) {
          const cleanAlias = alias.replace(/\*$/, '')
          const cleanTarget = (targets[0] as string).replace(/^\.\//, '').replace(/\*$/, '')
          aliases[cleanAlias] = cleanTarget
        }
      }
    } catch {
      // Default alias
      aliases['@/'] = 'src/'
    }

    return aliases
  }

  resolveImportPath(
    importSource: string,
    fromFile: string,
    projectDir: string,
    availableFiles: Set<string>
  ): string | null {
    // Handle aliased imports
    if (importSource.startsWith('@/')) {
      const withoutAlias = importSource.replace('@/', 'src/')
      return this.tryResolve(withoutAlias, availableFiles)
    }

    // Handle relative imports
    if (importSource.startsWith('.')) {
      const fromDir = path.dirname(fromFile)
      const resolved = path.join(fromDir, importSource).replace(/\\/g, '/')
      return this.tryResolve(resolved, availableFiles)
    }

    // External package
    return null
  }

  private tryResolve(basePath: string, availableFiles: Set<string>): string | null {
    if (availableFiles.has(basePath)) return basePath

    for (const ext of this.sourceExtensions) {
      const withExt = basePath + ext
      if (availableFiles.has(withExt)) return withExt
    }

    for (const indexName of this.indexFileNames) {
      const indexPath = basePath + '/' + indexName
      if (availableFiles.has(indexPath)) return indexPath
    }

    return null
  }

  // =========================================================================
  // Dependency File Handling
  // =========================================================================

  parseDependencyFile(content: string): DependencyInfo[] {
    const deps: DependencyInfo[] = []

    try {
      const pkg = JSON.parse(content)

      for (const [name, version] of Object.entries(pkg.dependencies || {})) {
        deps.push({ name, version: version as string, dev: false })
      }

      for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
        deps.push({ name, version: version as string, dev: true })
      }
    } catch {
      // Invalid JSON
    }

    return deps
  }

  serializeDependencyFile(deps: DependencyInfo[], existing?: string): string {
    let pkg: Record<string, unknown> = {}

    if (existing) {
      try {
        pkg = JSON.parse(existing)
      } catch {
        // Start fresh
      }
    }

    const dependencies: Record<string, string> = (pkg.dependencies as Record<string, string>) || {}
    const devDependencies: Record<string, string> = (pkg.devDependencies as Record<string, string>) || {}

    for (const dep of deps) {
      if (dep.dev) {
        devDependencies[dep.name] = dep.version
      } else {
        dependencies[dep.name] = dep.version
      }
    }

    pkg.dependencies = Object.fromEntries(
      Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))
    )
    pkg.devDependencies = Object.fromEntries(
      Object.entries(devDependencies).sort(([a], [b]) => a.localeCompare(b))
    )

    return JSON.stringify(pkg, null, 2)
  }

  getInstallCommand(deps: string[]): string {
    if (deps.length === 0) return ''
    return `npm install ${deps.join(' ')}`
  }

  // =========================================================================
  // Validation
  // =========================================================================

  getTypeCheckCommand(): string {
    return 'npx tsc --noEmit'
  }

  getLintCommand(): string {
    return 'npx eslint src/ --ext .ts'
  }

  validateFile(content: string, filePath: string): ValidationError[] {
    const errors: ValidationError[] = []

    // 1. Check for missing async/await on Sequelize operations
    if (filePath.includes('services/') || filePath.includes('routes/')) {
      if (content.includes('async ')) {
        if (content.includes('.findAll(') && !content.includes('await') && !content.includes('return ')) {
          // Only warn if there's a findAll without any await nearby
        }
        if (content.includes('.create(') && content.match(/(?<!await\s)\w+\.create\(/)) {
          errors.push({
            file: filePath,
            line: this.findLine(content, '.create('),
            message: 'Sequelize .create() should be awaited in async function',
            severity: 'warning',
            fixable: true,
          })
        }
      }
    }

    // 2. Check for router not using express.Router()
    if (filePath.includes('routes/') && !filePath.endsWith('index.ts')) {
      if (!content.includes('Router') && !content.includes('router')) {
        errors.push({
          file: filePath,
          line: 1,
          message: 'Route file should use express.Router()',
          severity: 'warning',
          fixable: false,
        })
      }
    }

    // 3. Check for missing error handling in routes
    if (filePath.includes('routes/') && content.includes('router.')) {
      if (!content.includes('try') && !content.includes('catch') && !content.includes('asyncHandler')) {
        errors.push({
          file: filePath,
          line: 1,
          message: 'Route handlers should include error handling (try/catch or asyncHandler wrapper)',
          severity: 'warning',
          fixable: true,
        })
      }
    }

    // 4. Check for model without DataTypes import
    if (filePath.includes('models/') && !filePath.endsWith('index.ts')) {
      if (content.includes('sequelize') && !content.includes('DataTypes') && !content.includes('DataType')) {
        errors.push({
          file: filePath,
          line: 1,
          message: 'Model file should import DataTypes from sequelize',
          severity: 'warning',
          fixable: false,
        })
      }
    }

    // 5. Check for hardcoded secrets
    if (content.match(/['"](?:password|secret|key)['"]\s*:\s*['"][^'"]{3,}['"]/i)) {
      errors.push({
        file: filePath,
        line: this.findLine(content, 'secret'),
        message: 'Possible hardcoded secret detected — use environment variables',
        severity: 'error',
        fixable: false,
      })
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

const handler = new ExpressPostgresHandler()
stackRegistry.register(handler)

export { handler as expressPostgresHandler }
