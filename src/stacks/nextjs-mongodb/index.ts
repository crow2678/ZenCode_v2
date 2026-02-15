/**
 * ZenCode V2 - Next.js + MongoDB Stack Handler
 *
 * Full implementation of IStackHandler for Next.js 14+ with MongoDB/Mongoose
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

export class NextjsMongoHandler extends BaseStackHandler {
  // =========================================================================
  // Identity
  // =========================================================================
  readonly id = 'nextjs-mongodb'
  readonly name = 'Next.js + MongoDB'
  readonly description = 'Next.js 14+ App Router with MongoDB/Mongoose, tRPC, and shadcn/ui'
  readonly icon = '⚡'
  readonly version = '1.0.0'

  // =========================================================================
  // Language/Framework
  // =========================================================================
  readonly language = 'typescript' as const
  readonly framework = 'nextjs'
  readonly runtime = 'node' as const

  // =========================================================================
  // File Handling
  // =========================================================================
  readonly sourceExtensions = ['.ts', '.tsx', '.js', '.jsx']
  readonly configFiles = ['tsconfig.json', 'package.json', 'next.config.js', 'next.config.mjs']
  readonly indexFileNames = ['index.ts', 'index.tsx', 'index.js']

  readonly fileStructure: FileStructure = {
    models: 'src/lib/db/models',
    services: 'src/server/services',
    routes: 'src/server/trpc/procedures',
    pages: 'src/app',
    components: 'src/components',
    utils: 'src/lib',
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
    const lines = content.split('\n')

    while ((match = importRegex.exec(content)) !== null) {
      const isTypeOnly = !!match[1]
      const namedImports = match[2] || match[5] // { X, Y }
      const namespaceImport = match[3] // * as X
      const defaultImport = match[4] // X
      const source = match[6]

      // Find line number
      const beforeMatch = content.substring(0, match.index)
      const line = beforeMatch.split('\n').length

      const names: string[] = []
      let isDefault = false

      if (defaultImport) {
        names.push(defaultImport)
        isDefault = true
      }

      if (namedImports) {
        // Parse { X, Y, Z } or { X as Y }
        const cleaned = namedImports.replace(/[{}]/g, '').trim()
        const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean)
        for (const part of parts) {
          // Handle "X as Y" - use the local name Y
          const asMatch = part.match(/(\w+)\s+as\s+(\w+)/)
          if (asMatch) {
            names.push(asMatch[2])
          } else if (part.match(/^type\s+/)) {
            // type X - skip type prefix but include the name
            names.push(part.replace(/^type\s+/, ''))
          } else {
            names.push(part)
          }
        }
      }

      if (namespaceImport) {
        // * as X - extract X
        const nsMatch = namespaceImport.match(/\*\s+as\s+(\w+)/)
        if (nsMatch) {
          names.push(nsMatch[1])
          isDefault = true // treat namespace as default-like
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

    // Also match require() for commonjs
    const requireRegex = /(?:const|let|var)\s+(\{[^}]+\}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      const names: string[] = []
      const binding = match[1]
      const source = match[2]

      const beforeMatch = content.substring(0, match.index)
      const line = beforeMatch.split('\n').length

      if (binding.startsWith('{')) {
        // Destructured require
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
    const lines = content.split('\n')

    // Track what we've seen to avoid duplicates
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

    // export { X, Y, Z } or export { X as Y }
    const bracedExportRegex = /export\s+(?:type\s+)?\{([^}]+)\}(?:\s+from\s+['"][^'"]+['"])?/g
    while ((match = bracedExportRegex.exec(content)) !== null) {
      const inner = match[1]
      const beforeMatch = content.substring(0, match.index)
      const line = beforeMatch.split('\n').length
      const isReExport = match[0].includes('from')

      const parts = inner.split(',').map((p) => p.trim()).filter(Boolean)
      for (const part of parts) {
        const asMatch = part.match(/(\w+)\s+as\s+(\w+)/)
        const name = asMatch ? asMatch[2] : part.replace(/^type\s+/, '').trim()

        // Determine if it's a type export
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

    // ES6 imports: from 'package' or from '@scope/package'
    // Non-scoped packages
    const jsImportRegex = /(?:import|from)\s+['"]([^./'"@][^'"]*)['"]/g
    // Scoped packages
    const scopedImportRegex = /(?:import|from)\s+['"](@[^/'"]+\/[^'"]+)['"]/g
    // require()
    const requireRegex = /require\s*\(\s*['"]([^./'"]+)['"]\s*\)/g
    const scopedRequireRegex = /require\s*\(\s*['"](@[^/'"]+\/[^'"]+)['"]\s*\)/g

    let match: RegExpExecArray | null

    while ((match = jsImportRegex.exec(content)) !== null) {
      const pkg = match[1].split('/')[0] // Get root package name
      deps.add(pkg)
    }

    while ((match = scopedImportRegex.exec(content)) !== null) {
      // @scope/package or @scope/package/sub -> @scope/package
      const full = match[1]
      const parts = full.split('/')
      const pkg = parts.slice(0, 2).join('/') // @scope/package
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

      // Remove comments for JSON parsing
      const jsonContent = tsconfigContent
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')

      const tsconfig = JSON.parse(jsonContent)
      const paths = tsconfig.compilerOptions?.paths || {}

      for (const [alias, targets] of Object.entries(paths)) {
        if (Array.isArray(targets) && targets.length > 0) {
          // Convert "@/*" -> "@/" and ["./src/*"] -> "src/"
          const cleanAlias = alias.replace(/\*$/, '')
          const cleanTarget = (targets[0] as string).replace(/^\.\//, '').replace(/\*$/, '')
          aliases[cleanAlias] = cleanTarget
        }
      }
    } catch {
      // Default Next.js alias if no tsconfig
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
    // Try exact path
    if (availableFiles.has(basePath)) return basePath

    // Try with extensions
    for (const ext of this.sourceExtensions) {
      const withExt = basePath + ext
      if (availableFiles.has(withExt)) return withExt
    }

    // Try index files
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

    // Sort alphabetically
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
    return 'npx next lint'
  }

  validateFile(content: string, filePath: string): ValidationError[] {
    const errors: ValidationError[] = []

    // Check for common Next.js/tRPC issues

    // 1. Provider in server component (layout without 'use client')
    if (filePath.includes('layout.tsx') && !content.includes("'use client'")) {
      if (content.includes('QueryClientProvider') || content.includes('TRPCReactProvider')) {
        errors.push({
          file: filePath,
          line: 1,
          message: 'Context providers must be in a client component. Move to providers.tsx.',
          severity: 'error',
          fixable: true,
        })
      }
    }

    // 2. tRPC transformer in wrong place
    if (filePath.includes('client.ts') || filePath.includes('providers.tsx')) {
      if (content.includes('httpBatchLink') && content.includes('transformer')) {
        // Check if transformer is inside httpBatchLink
        const httpBatchMatch = content.match(/httpBatchLink\s*\(\s*\{[^}]*transformer[^}]*\}/s)
        if (httpBatchMatch) {
          errors.push({
            file: filePath,
            line: this.findLine(content, 'transformer'),
            message: 'transformer should be at createClient level, not inside httpBatchLink',
            severity: 'error',
            fixable: true,
          })
        }
      }
    }

    // 3. Missing 'use client' for hooks
    const clientHooks = ['useState', 'useEffect', 'useContext', 'useQuery', 'useMutation']
    for (const hook of clientHooks) {
      if (content.includes(hook) && !content.includes("'use client'")) {
        if (filePath.endsWith('.tsx') && !filePath.includes('/api/')) {
          errors.push({
            file: filePath,
            line: 1,
            message: `Using ${hook} requires 'use client' directive`,
            severity: 'warning',
            fixable: true,
          })
          break // Only report once
        }
      }
    }

    // 4. Mongoose model without existence check
    if (filePath.includes('models/') && content.includes('mongoose.model')) {
      if (!content.includes('mongoose.models.')) {
        errors.push({
          file: filePath,
          line: this.findLine(content, 'mongoose.model'),
          message: 'Model should check mongoose.models first for hot-reload safety',
          severity: 'warning',
          fixable: true,
        })
      }
    }

    // 5. Service without connectDB
    if (filePath.includes('services/') && filePath.endsWith('.ts')) {
      if (content.includes('await ') && content.includes('.find(')) {
        if (!content.includes('connectDB') && !content.includes('connectToDatabase')) {
          errors.push({
            file: filePath,
            line: 1,
            message: 'Service should call connectDB() before database operations',
            severity: 'error',
            fixable: true,
          })
        }
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

const handler = new NextjsMongoHandler()
stackRegistry.register(handler)

export { handler as nextjsMongoHandler }
