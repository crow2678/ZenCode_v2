/**
 * ZenCode V2 - Enhanced Assembly Service
 *
 * Combines V2's stack-agnostic architecture with V1's battle-tested assembly logic.
 * This service handles the full assembly pipeline including:
 * - File merging and deduplication
 * - Missing file generation (3-pass iterative)
 * - Deterministic auto-fixes
 * - TypeScript validation
 */

import { connectDB } from '@/lib/db/connection'
import { Assembly, Project, Blueprint, WorkOrder } from '@/lib/db/models'
import { getStack } from '@/stacks'
import {
  generateScaffold,
  generateMissingFiles,
  generateValidationFixes,
  generateTypeScriptFixes,
  generateWiring,
  fixPackageJson,
} from '@/lib/ai/scaffold'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, readFile, readdir, rm, stat } from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)
const ASSEMBLED_DIR = path.join(process.cwd(), '.assembled')
const TEMP_ASSEMBLED_DIR = path.join(process.cwd(), '.assembled-preview')

// =============================================================================
// Helpers
// =============================================================================

async function appendLog(assemblyId: unknown, message: string) {
  console.log(`[Assembly] ${message}`)
  await Assembly.findByIdAndUpdate(assemblyId, {
    $push: { logs: { timestamp: new Date(), message } },
  })
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const s = await stat(dir)
    return s.isDirectory()
  } catch {
    return false
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo'])

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath))
}

// =============================================================================
// Named Import/Export Extraction (from V1)
// =============================================================================

function extractNamedImports(content: string): Array<{
  names: string[]
  source: string
  line: number
}> {
  const results: Array<{ names: string[]; source: string; line: number }> = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // import { A, B, C } from 'path'
    const namedMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/)
    if (namedMatch) {
      const names = namedMatch[1].split(',').map((n) => {
        let trimmed = n.trim()
        if (trimmed.startsWith('type ')) trimmed = trimmed.slice(5).trim()
        const asMatch = trimmed.match(/^(\w+)\s+as\s+\w+$/)
        return asMatch ? asMatch[1] : trimmed
      }).filter(Boolean)
      results.push({ names, source: namedMatch[2], line: i + 1 })
    }
  }

  return results
}

function extractFileExports(content: string): Set<string> {
  const exports = new Set<string>()

  const namedExportRegex = /export\s+(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g
  let match
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.add(match[1])
  }

  if (/export\s+default\s/.test(content)) {
    exports.add('default')
  }

  const reExportRegex = /export\s+\{([^}]+)\}/g
  while ((match = reExportRegex.exec(content)) !== null) {
    const names = match[1].split(',')
    for (const name of names) {
      const trimmed = name.trim()
      const asMatch = trimmed.match(/\w+\s+as\s+(\w+)/)
      exports.add(asMatch ? asMatch[1] : trimmed.replace(/^type\s+/, ''))
    }
  }

  return exports
}

// =============================================================================
// Deduplication (from V1)
// =============================================================================

async function deduplicateFiles(projectDir: string): Promise<string[]> {
  const removed: string[] = []
  const allFiles = await walkDir(projectDir)
  const filesByDir = new Map<string, string[]>()

  for (const file of allFiles) {
    const relativePath = path.relative(projectDir, file).replace(/\\/g, '/')
    const dir = path.dirname(relativePath)
    const fileName = path.basename(relativePath)
    if (!filesByDir.has(dir)) filesByDir.set(dir, [])
    filesByDir.get(dir)!.push(fileName)
  }

  for (const [dir, files] of filesByDir) {
    const tsFiles = files.filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))
    const basenames = new Map<string, string[]>()

    for (const file of tsFiles) {
      const ext = path.extname(file)
      let base = path.basename(file, ext)
      if (base.endsWith('s') && !base.endsWith('ss')) {
        const singular = base.slice(0, -1)
        if (!basenames.has(singular)) basenames.set(singular, [])
        basenames.get(singular)!.push(file)
      } else {
        if (!basenames.has(base)) basenames.set(base, [])
        basenames.get(base)!.push(file)
      }
    }

    for (const [base, variants] of basenames) {
      if (variants.length > 1) {
        const singular = variants.find((f) => !f.match(new RegExp(`${base}s\\.(ts|tsx|js|jsx)$`)))
        const plural = variants.find((f) => f.match(new RegExp(`${base}s\\.(ts|tsx|js|jsx)$`)))
        if (singular && plural) {
          const pluralPath = path.join(projectDir, dir, plural)
          try {
            await rm(pluralPath)
            removed.push(path.join(dir, plural).replace(/\\/g, '/'))
          } catch { /* ignore */ }
        }
      }
    }
  }

  return removed
}

// =============================================================================
// Auto-Fixes (Deterministic - from V1)
// =============================================================================

async function runAutoFixes(
  projectDir: string,
  errors: Array<{ file: string; line: number; message: string }>
): Promise<{ fixed: number; errors: typeof errors }> {
  let fixed = 0

  // Auto-fix: export default → named exports
  const missingExportsPerTarget = new Map<string, Set<string>>()
  for (const err of errors) {
    const match = err.message.match(/Named import '(\w+)' not found in exports of (.+)$/)
    if (!match) continue
    const [, exportName, targetPath] = match
    if (!missingExportsPerTarget.has(targetPath)) {
      missingExportsPerTarget.set(targetPath, new Set())
    }
    missingExportsPerTarget.get(targetPath)!.add(exportName)
  }

  for (const [targetPath, missingNames] of missingExportsPerTarget) {
    const fullPath = path.join(projectDir, targetPath)
    let content: string
    try { content = await readFile(fullPath, 'utf-8') } catch { continue }
    if (!/export\s+default\s/.test(content)) continue

    const definedNames: string[] = []
    for (const name of missingNames) {
      const pattern = new RegExp(`(?:(?:async\\s+)?function|const|let|var|class)\\s+${name}\\b`)
      if (pattern.test(content)) definedNames.push(name)
    }
    if (definedNames.length === 0) continue

    const exportLine = `export { ${definedNames.join(', ')} }`
    if (content.includes(exportLine)) continue

    await writeFile(fullPath, content.trimEnd() + `\n${exportLine}\n`, 'utf-8')
    fixed++
  }

  // Re-filter errors that were fixed
  const fixedPaths = new Set(missingExportsPerTarget.keys())
  const remainingErrors = errors.filter((err) => {
    const match = err.message.match(/Named import '(\w+)' not found in exports of (.+)$/)
    if (!match) return true
    return !fixedPaths.has(match[2])
  })

  return { fixed, errors: remainingErrors }
}

// =============================================================================
// Validation (from V1)
// =============================================================================

interface ValidationError {
  file: string
  line: number
  message: string
}

async function validateProject(projectDir: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  const allFiles = await walkDir(projectDir)
  const availableFiles = new Set<string>()

  for (const f of allFiles) {
    availableFiles.add(path.relative(projectDir, f).replace(/\\/g, '/'))
  }

  const stack = getStack('nextjs-mongodb')
  const aliases: Record<string, string> = { '@/': 'src/' }

  const jsFiles = allFiles.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f))

  for (const file of jsFiles) {
    const content = await readFile(file, 'utf-8')
    const lines = content.split('\n')
    const relativePath = path.relative(projectDir, file).replace(/\\/g, '/')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check aliased imports
      for (const [prefix, target] of Object.entries(aliases)) {
        const aliasRegex = new RegExp(`from\\s+['"]${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^'"]+)['"]`)
        const match = line.match(aliasRegex)
        if (!match) continue

        const importPath = match[1]
        const resolvedBase = target + importPath
        const candidates = [
          resolvedBase,
          resolvedBase + '.ts',
          resolvedBase + '.tsx',
          resolvedBase + '/index.ts',
          resolvedBase + '/index.tsx',
        ]

        if (!candidates.some((c) => availableFiles.has(c))) {
          errors.push({
            file: relativePath,
            line: i + 1,
            message: `Unresolved import: ${prefix}${importPath}`,
          })
        }
      }

      // Check relative imports
      const relImportMatch = line.match(/from\s+['"](\.\.?\/[^'"]+)['"]/)
      if (relImportMatch) {
        const importPath = relImportMatch[1]
        const fileDir = path.dirname(relativePath)
        const resolvedBase = path.posix.normalize(path.posix.join(fileDir, importPath))
        const candidates = [
          resolvedBase,
          resolvedBase + '.ts',
          resolvedBase + '.tsx',
          resolvedBase + '/index.ts',
          resolvedBase + '/index.tsx',
        ]

        if (!candidates.some((c) => availableFiles.has(c))) {
          errors.push({
            file: relativePath,
            line: i + 1,
            message: `Unresolved relative import: ${importPath}`,
          })
        }
      }
    }

    // Validate named imports against exports
    const imports = extractNamedImports(content)
    for (const imp of imports) {
      if (!imp.source.startsWith('.') && !imp.source.startsWith('@/')) continue

      let resolvedPath: string | null = null
      if (imp.source.startsWith('@/')) {
        const withoutAlias = imp.source.replace('@/', 'src/')
        const candidates = [withoutAlias + '.ts', withoutAlias + '.tsx', withoutAlias + '/index.ts']
        resolvedPath = candidates.find((c) => availableFiles.has(c)) || null
      } else {
        const fileDir = path.dirname(relativePath)
        const resolvedBase = path.posix.normalize(path.posix.join(fileDir, imp.source))
        const candidates = [resolvedBase + '.ts', resolvedBase + '.tsx', resolvedBase + '/index.ts']
        resolvedPath = candidates.find((c) => availableFiles.has(c)) || null
      }

      if (!resolvedPath) continue

      const targetContent = await readFile(path.join(projectDir, resolvedPath), 'utf-8')
      const targetExports = extractFileExports(targetContent)

      for (const name of imp.names) {
        if (name === 'default') continue
        if (!targetExports.has(name)) {
          errors.push({
            file: relativePath,
            line: imp.line,
            message: `Named import '${name}' not found in exports of ${resolvedPath}`,
          })
        }
      }
    }
  }

  return errors
}

// =============================================================================
// TypeScript Validation (from V1)
// =============================================================================

interface TypeScriptError {
  file: string
  line: number
  code: string
  message: string
}

async function runTypeScriptValidation(projectDir: string): Promise<TypeScriptError[]> {
  const errors: TypeScriptError[] = []

  try {
    const tsconfigPath = path.join(projectDir, 'tsconfig.json')
    try { await stat(tsconfigPath) } catch { return [] }

    const { stderr } = await execAsync('npx tsc --noEmit --pretty false 2>&1 || true', {
      cwd: projectDir,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    })

    const errorRegex = /^(.+?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.+)$/gm
    let match
    while ((match = errorRegex.exec(stderr)) !== null) {
      const [, filePath, lineStr, code, message] = match
      const relativePath = filePath.startsWith(projectDir)
        ? filePath.slice(projectDir.length + 1).replace(/\\/g, '/')
        : filePath.replace(/\\/g, '/')

      errors.push({
        file: relativePath,
        line: parseInt(lineStr, 10),
        code,
        message: message.trim(),
      })
    }
  } catch (error) {
    console.error('TypeScript validation error:', error)
  }

  return errors
}

// =============================================================================
// Main Assembly Function
// =============================================================================

export interface AssembleProjectInput {
  projectId: string
  blueprintId: string
  orgId: string
  userId: string
  stackId?: string
  dryRun?: boolean  // Preview mode - don't save to DB
}

export interface DryRunResult {
  success: boolean
  files: Array<{ path: string; action: 'create' | 'modify'; size: number }>
  totalFiles: number
  validationErrors: Array<{ file: string; line: number; message: string }>
  fixesApplied: number
  tsErrors: number
  logs: string[]
  tempPath: string  // For confirm step
}

export async function assembleProject(input: AssembleProjectInput) {
  await connectDB()

  const project = await Project.findById(input.projectId)
  if (!project) throw new Error('Project not found')

  const blueprint = await Blueprint.findById(input.blueprintId)
  if (!blueprint) throw new Error('Blueprint not found')

  const workOrders = await WorkOrder.find({
    blueprintId: input.blueprintId,
    status: 'completed',
  }).sort({ completedAt: 1 })

  if (workOrders.length === 0) {
    throw new Error('No completed work orders to assemble')
  }

  const stackId = input.stackId || blueprint.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)
  const outputPath = path.join(ASSEMBLED_DIR, input.projectId, input.blueprintId)

  const assembly = await Assembly.create({
    projectId: input.projectId,
    blueprintId: input.blueprintId,
    status: 'pending',
    outputPath,
    workOrderIds: workOrders.map((wo) => wo._id),
    scaffold: { techStack: [], files: [] },
    mergedFiles: [],
    validationErrors: [],
    fixAttempts: 0,
    startedAt: new Date(),
    createdBy: input.userId,
  })

  try {
    // Stage 1: Collect files from work orders
    await Assembly.findByIdAndUpdate(assembly._id, { status: 'scaffolding' })
    await appendLog(assembly._id, `Starting assembly for "${project.name}" with ${workOrders.length} work orders`)

    const allFiles = new Map<string, string>()
    const existingFilePaths: string[] = []

    for (const wo of workOrders) {
      for (const file of wo.files || []) {
        if (file.action === 'delete') {
          allFiles.delete(file.path)
        } else if (file.content) {
          allFiles.set(file.path, file.content)
          existingFilePaths.push(file.path)
        }
      }
    }

    await appendLog(assembly._id, `Collected ${allFiles.size} files from work orders`)

    // Extract dependencies
    const extractedDeps: string[] = []
    for (const [, content] of allFiles) {
      const deps = stack.parsePackageDependencies(content)
      extractedDeps.push(...deps)
    }
    const uniqueDeps = [...new Set(extractedDeps)]

    // Stage 2: Generate scaffold
    const techStack = (project.metadata?.techStack as string[]) || ['Next.js', 'MongoDB', 'tRPC']

    const scaffoldResult = await generateScaffold({
      projectName: project.name,
      techStack,
      extractedDeps: uniqueDeps,
      existingFilePaths,
      stackHandler: stack,
    })

    await appendLog(assembly._id, `Generated ${scaffoldResult.files.length} scaffold files`)

    // Write all files to output
    if (await dirExists(outputPath)) {
      await rm(outputPath, { recursive: true, force: true })
    }
    await mkdir(outputPath, { recursive: true })

    // Write scaffold files
    for (const file of scaffoldResult.files) {
      const filePath = path.join(outputPath, file.path)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, file.content, 'utf-8')
    }

    // Write work order files (overwrites scaffold)
    await Assembly.findByIdAndUpdate(assembly._id, { status: 'merging' })
    const mergedFiles: string[] = []
    for (const [filePath, content] of allFiles) {
      const fullPath = path.join(outputPath, filePath)
      await mkdir(path.dirname(fullPath), { recursive: true })
      await writeFile(fullPath, content, 'utf-8')
      mergedFiles.push(filePath)
    }

    await appendLog(assembly._id, `Merged ${mergedFiles.length} files`)
    await Assembly.findByIdAndUpdate(assembly._id, { mergedFiles })

    // Stage 2.5: Deduplication
    const duplicatesRemoved = await deduplicateFiles(outputPath)
    if (duplicatesRemoved.length > 0) {
      await appendLog(assembly._id, `Removed ${duplicatesRemoved.length} duplicate files`)
    }

    // Stage 2.7: Post-merge package.json fix
    const packageJsonPath = path.join(outputPath, 'package.json')
    try {
      const allFilesAfterMerge = await walkDir(outputPath)
      const allFilePathsAfterMerge = allFilesAfterMerge.map((f) => path.relative(outputPath, f).replace(/\\/g, '/'))
      const packageContent = await readFile(packageJsonPath, 'utf-8')
      const fixedPackageContent = fixPackageJson(packageContent, allFilePathsAfterMerge)
      if (fixedPackageContent !== packageContent) {
        await writeFile(packageJsonPath, fixedPackageContent, 'utf-8')
        await appendLog(assembly._id, 'Updated package.json with detected dependencies')
      }
    } catch { /* package.json might not exist */ }

    // Stage 3: Generate missing files (3-pass iterative)
    await Assembly.findByIdAndUpdate(assembly._id, { status: 'generating' })
    const MAX_PASSES = 3
    let totalGenerated = 0

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const currentFiles = await walkDir(outputPath)
      const availableFiles = new Set(currentFiles.map((f) => path.relative(outputPath, f).replace(/\\/g, '/')))

      const missingPathsSet = new Set<string>()
      const sampleImports: Array<{ file: string; imports: string[] }> = []
      const requiredExportsMap = new Map<string, { exports: Set<string>; importedBy: Set<string> }>()

      for (const file of currentFiles) {
        if (!isSourceFile(file)) continue
        const content = await readFile(file, 'utf-8')
        const relativePath = path.relative(outputPath, file).replace(/\\/g, '/')
        const fileImports: string[] = []

        // Check alias imports
        const aliasRegex = /from\s+['"]@\/([^'"]+)['"]/g
        let match
        while ((match = aliasRegex.exec(content)) !== null) {
          const importPath = match[1]
          const resolvedBase = 'src/' + importPath
          const candidates = [resolvedBase, resolvedBase + '.ts', resolvedBase + '.tsx', resolvedBase + '/index.ts']
          if (!candidates.some((c) => availableFiles.has(c))) {
            const likelyPath = resolvedBase + '.ts'
            missingPathsSet.add(likelyPath)
            fileImports.push(`@/${importPath}`)
          }
        }

        // Check relative imports
        const relRegex = /from\s+['"](\.\.?\/[^'"]+)['"]/g
        while ((match = relRegex.exec(content)) !== null) {
          const importPath = match[1]
          const fileDir = path.dirname(relativePath)
          const resolvedBase = path.posix.normalize(path.posix.join(fileDir, importPath))
          const candidates = [resolvedBase, resolvedBase + '.ts', resolvedBase + '.tsx', resolvedBase + '/index.ts']
          if (!candidates.some((c) => availableFiles.has(c))) {
            const likelyPath = resolvedBase + '.ts'
            missingPathsSet.add(likelyPath)
            fileImports.push(importPath)
          }
        }

        if (fileImports.length > 0) {
          sampleImports.push({ file: relativePath, imports: fileImports })
        }

        // Collect required exports
        const imports = extractNamedImports(content)
        for (const imp of imports) {
          let likelyPath: string | null = null
          if (imp.source.startsWith('@/')) {
            likelyPath = 'src/' + imp.source.slice(2) + '.ts'
          } else if (imp.source.startsWith('.')) {
            const fileDir = path.dirname(relativePath)
            likelyPath = path.posix.normalize(path.posix.join(fileDir, imp.source)) + '.ts'
          }
          if (likelyPath && missingPathsSet.has(likelyPath)) {
            if (!requiredExportsMap.has(likelyPath)) {
              requiredExportsMap.set(likelyPath, { exports: new Set(), importedBy: new Set() })
            }
            const entry = requiredExportsMap.get(likelyPath)!
            for (const name of imp.names) {
              if (name !== 'default') entry.exports.add(name)
            }
            entry.importedBy.add(relativePath)
          }
        }
      }

      if (missingPathsSet.size === 0) {
        if (pass === 1) {
          await appendLog(assembly._id, 'No missing imports detected')
        }
        break
      }

      const missingPaths = Array.from(missingPathsSet)
      await appendLog(assembly._id, `Pass ${pass}/${MAX_PASSES}: Found ${missingPaths.length} missing files`)

      const requiredExports = Array.from(requiredExportsMap.entries()).map(([p, info]) => ({
        path: p,
        exports: Array.from(info.exports),
        importedBy: Array.from(info.importedBy),
      }))

      const result = await generateMissingFiles({
        techStack,
        missingPaths: missingPaths.slice(0, 20),
        existingFileTree: Array.from(availableFiles),
        sampleImports,
        requiredExports,
        stackHandler: stack,
      })

      for (const file of result.files) {
        const filePath = path.join(outputPath, file.path)
        await mkdir(path.dirname(filePath), { recursive: true })
        await writeFile(filePath, file.content, 'utf-8')
      }
      totalGenerated += result.files.length
      await appendLog(assembly._id, `Pass ${pass}: Generated ${result.files.length} files`)
    }

    // Stage 4: Generate wiring (barrel files, root router)
    await appendLog(assembly._id, 'Generating wiring files...')
    const modules: Array<{ dir: string; file: string; exports: string[] }> = []
    const allFilesForWiring = await walkDir(outputPath)

    for (const file of allFilesForWiring) {
      if (!isSourceFile(file)) continue
      const content = await readFile(file, 'utf-8')
      const relativePath = path.relative(outputPath, file).replace(/\\/g, '/')
      const exports = Array.from(extractFileExports(content))
      if (exports.length > 0) {
        modules.push({
          dir: path.dirname(relativePath),
          file: path.basename(relativePath),
          exports,
        })
      }
    }

    const wiringResult = await generateWiring({
      techStack,
      modules,
      fileTree: allFilesForWiring.map((f) => path.relative(outputPath, f).replace(/\\/g, '/')),
      stackHandler: stack,
    })

    for (const file of wiringResult.files) {
      const filePath = path.join(outputPath, file.path)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, file.content, 'utf-8')
    }
    await appendLog(assembly._id, `Generated ${wiringResult.files.length} wiring files`)

    // Stage 4.5: Lint + Format
    await appendLog(assembly._id, 'Running linter and formatter...')
    try {
      await execAsync('npx eslint --fix "src/**/*.{ts,tsx}" --no-error-on-unmatched-pattern 2>&1 || true', {
        cwd: outputPath,
        timeout: 60000,
      })
      await execAsync('npx prettier --write "src/**/*.{ts,tsx}" 2>&1 || true', {
        cwd: outputPath,
        timeout: 60000,
      })
      await appendLog(assembly._id, 'Linting and formatting complete')
    } catch (lintError) {
      await appendLog(assembly._id, `Lint/format warning: ${lintError instanceof Error ? lintError.message : 'unknown'}`)
    }

    // Stage 5: Validation with auto-fixes
    await Assembly.findByIdAndUpdate(assembly._id, { status: 'validating' })
    await appendLog(assembly._id, 'Validating imports and exports...')

    let errors = await validateProject(outputPath)
    let fixAttempts = 0

    // Run deterministic auto-fixes first
    if (errors.length > 0) {
      const autoFixResult = await runAutoFixes(outputPath, errors)
      if (autoFixResult.fixed > 0) {
        await appendLog(assembly._id, `Auto-fixed ${autoFixResult.fixed} export issues`)
        errors = await validateProject(outputPath)
      }
    }

    // AI-assisted fixes (up to 3 attempts)
    while (errors.length > 0 && fixAttempts < 3) {
      fixAttempts++
      await appendLog(assembly._id, `Validation found ${errors.length} errors — AI fix attempt ${fixAttempts}/3`)

      const uniqueFiles = [...new Set(errors.map((e) => e.file))]
      const affectedFiles: Array<{ path: string; content: string }> = []

      for (const filePath of uniqueFiles.slice(0, 10)) {
        try {
          const content = await readFile(path.join(outputPath, filePath), 'utf-8')
          affectedFiles.push({ path: filePath, content })
        } catch { /* skip */ }
      }

      // Collect sibling files for barrel/index file fixes
      const siblingFiles: Array<{ dir: string; files: string[] }> = []
      const dirsWithErrors = new Set(uniqueFiles.map((f) => path.dirname(f)))
      for (const dir of dirsWithErrors) {
        try {
          const dirPath = path.join(outputPath, dir)
          const entries = await readdir(dirPath)
          const tsFiles = entries.filter((e) => /\.(ts|tsx|js|jsx)$/.test(e))
          if (tsFiles.length > 0) {
            siblingFiles.push({ dir, files: tsFiles })
          }
        } catch { /* skip */ }
      }

      // Collect importing context - what imports are expected from erroring files
      const importingContext: Array<{ file: string; imports: string[] }> = []
      const erroringPaths = new Set(uniqueFiles)
      const currentAllFiles = await walkDir(outputPath)

      for (const file of currentAllFiles) {
        if (!isSourceFile(file)) continue
        const content = await readFile(file, 'utf-8')
        const relativePath = path.relative(outputPath, file).replace(/\\/g, '/')
        const imports = extractNamedImports(content)

        for (const imp of imports) {
          let resolvedPath: string | null = null
          if (imp.source.startsWith('@/')) {
            const withoutAlias = imp.source.replace('@/', 'src/')
            const candidates = [withoutAlias + '.ts', withoutAlias + '.tsx', withoutAlias + '/index.ts']
            resolvedPath = candidates.find((c) => erroringPaths.has(c)) || null
          } else if (imp.source.startsWith('.')) {
            const fileDir = path.dirname(relativePath)
            const resolvedBase = path.posix.normalize(path.posix.join(fileDir, imp.source))
            const candidates = [resolvedBase + '.ts', resolvedBase + '.tsx', resolvedBase + '/index.ts']
            resolvedPath = candidates.find((c) => erroringPaths.has(c)) || null
          }

          if (resolvedPath && imp.names.length > 0) {
            importingContext.push({ file: relativePath, imports: imp.names })
          }
        }
      }

      const fixResult = await generateValidationFixes({
        errors: errors.slice(0, 20),
        affectedFiles,
        techStack,
        siblingFiles: siblingFiles.slice(0, 10),
        importingContext: importingContext.slice(0, 15),
        stackHandler: stack,
      })

      for (const fix of fixResult.fixes) {
        const fixPath = path.join(outputPath, fix.path)
        await mkdir(path.dirname(fixPath), { recursive: true })
        await writeFile(fixPath, fix.content, 'utf-8')
      }

      await appendLog(assembly._id, `Applied ${fixResult.fixes.length} fixes`)
      errors = await validateProject(outputPath)

      // Re-run auto-fixes
      const reAutoFix = await runAutoFixes(outputPath, errors)
      if (reAutoFix.fixed > 0) {
        await appendLog(assembly._id, `Re-applied auto-fix to ${reAutoFix.fixed} files`)
        errors = await validateProject(outputPath)
      }
    }

    // Stage 6: TypeScript validation
    let tsErrors: TypeScriptError[] = []
    if (errors.length === 0) {
      await Assembly.findByIdAndUpdate(assembly._id, { status: 'typescript-validation' })
      await appendLog(assembly._id, 'Running TypeScript compilation check...')

      try {
        await execAsync('npm install --legacy-peer-deps', { cwd: outputPath, timeout: 180000 })
      } catch (e) {
        await appendLog(assembly._id, `npm install warning: ${e instanceof Error ? e.message : 'unknown'}`)
      }

      tsErrors = await runTypeScriptValidation(outputPath)

      if (tsErrors.length === 0) {
        await appendLog(assembly._id, 'TypeScript compilation passed!')
      } else {
        await appendLog(assembly._id, `TypeScript found ${tsErrors.length} errors`)

        // TypeScript fix loop (up to 2 attempts)
        let tsFixAttempts = 0
        while (tsErrors.length > 0 && tsFixAttempts < 2) {
          tsFixAttempts++
          await appendLog(assembly._id, `TypeScript fix attempt ${tsFixAttempts}/2...`)

          const uniqueTsFiles = [...new Set(tsErrors.map((e) => e.file))]
          const affectedTsFiles: Array<{ path: string; content: string }> = []

          for (const filePath of uniqueTsFiles.slice(0, 10)) {
            try {
              const content = await readFile(path.join(outputPath, filePath), 'utf-8')
              affectedTsFiles.push({ path: filePath, content })
            } catch { /* skip */ }
          }

          // Read package.json for dependency fixes
          let packageJsonContent: string | undefined
          try {
            packageJsonContent = await readFile(path.join(outputPath, 'package.json'), 'utf-8')
          } catch { /* skip */ }

          const tsFixResult = await generateTypeScriptFixes({
            errors: tsErrors.slice(0, 30).map((e) => ({
              file: e.file,
              line: e.line,
              code: e.code,
              message: e.message,
            })),
            affectedFiles: affectedTsFiles,
            techStack,
            packageJson: packageJsonContent,
            stackHandler: stack,
          })

          // Apply file fixes
          for (const fix of tsFixResult.fixes) {
            const fixPath = path.join(outputPath, fix.path)
            await mkdir(path.dirname(fixPath), { recursive: true })
            await writeFile(fixPath, fix.content, 'utf-8')
          }

          // Apply package.json fixes if any
          if (tsFixResult.packageJsonFixes && packageJsonContent) {
            try {
              const pkg = JSON.parse(packageJsonContent)
              if (tsFixResult.packageJsonFixes.dependencies) {
                pkg.dependencies = { ...pkg.dependencies, ...tsFixResult.packageJsonFixes.dependencies }
              }
              if (tsFixResult.packageJsonFixes.devDependencies) {
                pkg.devDependencies = { ...pkg.devDependencies, ...tsFixResult.packageJsonFixes.devDependencies }
              }
              await writeFile(path.join(outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8')

              // Re-run npm install if packages were added
              try {
                await execAsync('npm install --legacy-peer-deps', { cwd: outputPath, timeout: 180000 })
              } catch { /* ignore */ }
            } catch { /* skip */ }
          }

          await appendLog(assembly._id, `Applied ${tsFixResult.fixes.length} TypeScript fixes`)
          tsErrors = await runTypeScriptValidation(outputPath)
        }

        if (tsErrors.length === 0) {
          await appendLog(assembly._id, 'TypeScript errors resolved!')
        } else {
          await appendLog(assembly._id, `${tsErrors.length} TypeScript errors remain after fixes`)
        }
      }
    }

    // Stage 7: Finalize
    const totalErrors = errors.length + tsErrors.length
    if (totalErrors > 0) {
      await appendLog(assembly._id, `Assembly completed with ${totalErrors} remaining errors`)
      await Assembly.findByIdAndUpdate(assembly._id, {
        status: 'completed',  // Still completed, just with warnings
        validationErrors: [...errors, ...tsErrors.map((e) => ({ file: e.file, line: e.line, message: `${e.code}: ${e.message}` }))],
        fixAttempts,
        completedAt: new Date(),
      })
    } else {
      await appendLog(assembly._id, 'Assembly completed successfully — all validations passed!')
      await Assembly.findByIdAndUpdate(assembly._id, {
        status: 'completed',
        validationErrors: [],
        fixAttempts,
        completedAt: new Date(),
      })
    }

    return Assembly.findById(assembly._id)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await appendLog(assembly._id, `Assembly error: ${errorMessage}`)
    await Assembly.findByIdAndUpdate(assembly._id, {
      status: 'failed',
      error: errorMessage,
      completedAt: new Date(),
    })
    throw error
  }
}

// =============================================================================
// Query Helpers
// =============================================================================

export async function getAssemblyForBlueprint(projectId: string, blueprintId: string) {
  await connectDB()
  return Assembly.findOne({ projectId, blueprintId }).sort({ createdAt: -1 })
}

export async function getAssemblyById(assemblyId: string) {
  await connectDB()
  return Assembly.findById(assemblyId)
}

// =============================================================================
// Dry Run Assembly (Preview Mode)
// =============================================================================

export interface PreviewAssemblyInput {
  projectId: string
  blueprintId: string
  orgId: string
  userId: string
  stackId?: string
}

export async function previewAssembly(input: PreviewAssemblyInput): Promise<DryRunResult> {
  await connectDB()

  const project = await Project.findById(input.projectId)
  if (!project) throw new Error('Project not found')

  const blueprint = await Blueprint.findById(input.blueprintId)
  if (!blueprint) throw new Error('Blueprint not found')

  const workOrders = await WorkOrder.find({
    blueprintId: input.blueprintId,
    status: 'completed',
  }).sort({ completedAt: 1 })

  if (workOrders.length === 0) {
    throw new Error('No completed work orders to assemble')
  }

  const stackId = input.stackId || blueprint.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)

  // Use temp directory for preview
  const tempPath = path.join(TEMP_ASSEMBLED_DIR, input.projectId, input.blueprintId, Date.now().toString())
  const logs: string[] = []

  const log = (message: string) => {
    console.log(`[Assembly Preview] ${message}`)
    logs.push(message)
  }

  let fixesApplied = 0
  let validationErrors: Array<{ file: string; line: number; message: string }> = []
  let tsErrorCount = 0

  try {
    // Stage 1: Collect files from work orders
    log(`Starting preview for "${project.name}" with ${workOrders.length} work orders`)

    const allFiles = new Map<string, string>()
    const existingFilePaths: string[] = []

    for (const wo of workOrders) {
      for (const file of wo.files || []) {
        if (file.action === 'delete') {
          allFiles.delete(file.path)
        } else if (file.content) {
          allFiles.set(file.path, file.content)
          existingFilePaths.push(file.path)
        }
      }
    }

    log(`Collected ${allFiles.size} files from work orders`)

    // Extract dependencies
    const extractedDeps: string[] = []
    for (const [, content] of allFiles) {
      const deps = stack.parsePackageDependencies(content)
      extractedDeps.push(...deps)
    }
    const uniqueDeps = [...new Set(extractedDeps)]

    // Stage 2: Generate scaffold
    const techStack = (project.metadata?.techStack as string[]) || ['Next.js', 'MongoDB', 'tRPC']

    const scaffoldResult = await generateScaffold({
      projectName: project.name,
      techStack,
      extractedDeps: uniqueDeps,
      existingFilePaths,
      stackHandler: stack,
    })

    log(`Generated ${scaffoldResult.files.length} scaffold files`)

    // Write all files to temp output
    if (await dirExists(tempPath)) {
      await rm(tempPath, { recursive: true, force: true })
    }
    await mkdir(tempPath, { recursive: true })

    // Write scaffold files
    for (const file of scaffoldResult.files) {
      const filePath = path.join(tempPath, file.path)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, file.content, 'utf-8')
    }

    // Write work order files (overwrites scaffold)
    for (const [filePath, content] of allFiles) {
      const fullPath = path.join(tempPath, filePath)
      await mkdir(path.dirname(fullPath), { recursive: true })
      await writeFile(fullPath, content, 'utf-8')
    }

    log(`Merged ${allFiles.size} files`)

    // Stage 2.5: Deduplication
    const duplicatesRemoved = await deduplicateFiles(tempPath)
    if (duplicatesRemoved.length > 0) {
      log(`Removed ${duplicatesRemoved.length} duplicate files`)
    }

    // Stage 2.7: Post-merge package.json fix
    const packageJsonPath = path.join(tempPath, 'package.json')
    try {
      const allFilesAfterMerge = await walkDir(tempPath)
      const allFilePathsAfterMerge = allFilesAfterMerge.map((f) => path.relative(tempPath, f).replace(/\\/g, '/'))
      const packageContent = await readFile(packageJsonPath, 'utf-8')
      const fixedPackageContent = fixPackageJson(packageContent, allFilePathsAfterMerge)
      if (fixedPackageContent !== packageContent) {
        await writeFile(packageJsonPath, fixedPackageContent, 'utf-8')
        log('Updated package.json with detected dependencies')
      }
    } catch { /* package.json might not exist */ }

    // Stage 3: Generate missing files (3-pass iterative)
    const MAX_PASSES = 3
    let totalGenerated = 0

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const currentFiles = await walkDir(tempPath)
      const availableFiles = new Set(currentFiles.map((f) => path.relative(tempPath, f).replace(/\\/g, '/')))

      const missingPathsSet = new Set<string>()
      const sampleImports: Array<{ file: string; imports: string[] }> = []
      const requiredExportsMap = new Map<string, { exports: Set<string>; importedBy: Set<string> }>()

      for (const file of currentFiles) {
        if (!isSourceFile(file)) continue
        const content = await readFile(file, 'utf-8')
        const relativePath = path.relative(tempPath, file).replace(/\\/g, '/')
        const fileImports: string[] = []

        // Check alias imports
        const aliasRegex = /from\s+['"]@\/([^'"]+)['"]/g
        let match
        while ((match = aliasRegex.exec(content)) !== null) {
          const importPath = match[1]
          const resolvedBase = 'src/' + importPath
          const candidates = [resolvedBase, resolvedBase + '.ts', resolvedBase + '.tsx', resolvedBase + '/index.ts']
          if (!candidates.some((c) => availableFiles.has(c))) {
            const likelyPath = resolvedBase + '.ts'
            missingPathsSet.add(likelyPath)
            fileImports.push(`@/${importPath}`)
          }
        }

        // Check relative imports
        const relRegex = /from\s+['"](\.\.?\/[^'"]+)['"]/g
        while ((match = relRegex.exec(content)) !== null) {
          const importPath = match[1]
          const fileDir = path.dirname(relativePath)
          const resolvedBase = path.posix.normalize(path.posix.join(fileDir, importPath))
          const candidates = [resolvedBase, resolvedBase + '.ts', resolvedBase + '.tsx', resolvedBase + '/index.ts']
          if (!candidates.some((c) => availableFiles.has(c))) {
            const likelyPath = resolvedBase + '.ts'
            missingPathsSet.add(likelyPath)
            fileImports.push(importPath)
          }
        }

        if (fileImports.length > 0) {
          sampleImports.push({ file: relativePath, imports: fileImports })
        }

        // Collect required exports
        const imports = extractNamedImports(content)
        for (const imp of imports) {
          let likelyPath: string | null = null
          if (imp.source.startsWith('@/')) {
            likelyPath = 'src/' + imp.source.slice(2) + '.ts'
          } else if (imp.source.startsWith('.')) {
            const fileDir = path.dirname(relativePath)
            likelyPath = path.posix.normalize(path.posix.join(fileDir, imp.source)) + '.ts'
          }
          if (likelyPath && missingPathsSet.has(likelyPath)) {
            if (!requiredExportsMap.has(likelyPath)) {
              requiredExportsMap.set(likelyPath, { exports: new Set(), importedBy: new Set() })
            }
            const entry = requiredExportsMap.get(likelyPath)!
            for (const name of imp.names) {
              if (name !== 'default') entry.exports.add(name)
            }
            entry.importedBy.add(relativePath)
          }
        }
      }

      if (missingPathsSet.size === 0) {
        if (pass === 1) {
          log('No missing imports detected')
        }
        break
      }

      const missingPaths = Array.from(missingPathsSet)
      log(`Pass ${pass}/${MAX_PASSES}: Found ${missingPaths.length} missing files`)

      const requiredExports = Array.from(requiredExportsMap.entries()).map(([p, info]) => ({
        path: p,
        exports: Array.from(info.exports),
        importedBy: Array.from(info.importedBy),
      }))

      const result = await generateMissingFiles({
        techStack,
        missingPaths: missingPaths.slice(0, 20),
        existingFileTree: Array.from(availableFiles),
        sampleImports,
        requiredExports,
        stackHandler: stack,
      })

      for (const file of result.files) {
        const filePath = path.join(tempPath, file.path)
        await mkdir(path.dirname(filePath), { recursive: true })
        await writeFile(filePath, file.content, 'utf-8')
      }
      totalGenerated += result.files.length
      fixesApplied += result.files.length
      log(`Pass ${pass}: Generated ${result.files.length} files`)
    }

    // Stage 4: Generate wiring (barrel files, root router)
    log('Generating wiring files...')
    const modules: Array<{ dir: string; file: string; exports: string[] }> = []
    const allFilesForWiring = await walkDir(tempPath)

    for (const file of allFilesForWiring) {
      if (!isSourceFile(file)) continue
      const content = await readFile(file, 'utf-8')
      const relativePath = path.relative(tempPath, file).replace(/\\/g, '/')
      const exports = Array.from(extractFileExports(content))
      if (exports.length > 0) {
        modules.push({
          dir: path.dirname(relativePath),
          file: path.basename(relativePath),
          exports,
        })
      }
    }

    const wiringResult = await generateWiring({
      techStack,
      modules,
      fileTree: allFilesForWiring.map((f) => path.relative(tempPath, f).replace(/\\/g, '/')),
      stackHandler: stack,
    })

    for (const file of wiringResult.files) {
      const filePath = path.join(tempPath, file.path)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, file.content, 'utf-8')
    }
    log(`Generated ${wiringResult.files.length} wiring files`)

    // Stage 5: Validation with auto-fixes
    log('Validating imports and exports...')

    let errors = await validateProject(tempPath)
    let fixAttempts = 0

    // Run deterministic auto-fixes first
    if (errors.length > 0) {
      const autoFixResult = await runAutoFixes(tempPath, errors)
      if (autoFixResult.fixed > 0) {
        log(`Auto-fixed ${autoFixResult.fixed} export issues`)
        fixesApplied += autoFixResult.fixed
        errors = await validateProject(tempPath)
      }
    }

    // AI-assisted fixes (up to 2 attempts for preview - faster)
    while (errors.length > 0 && fixAttempts < 2) {
      fixAttempts++
      log(`Validation found ${errors.length} errors — AI fix attempt ${fixAttempts}/2`)

      const uniqueFiles = [...new Set(errors.map((e) => e.file))]
      const affectedFiles: Array<{ path: string; content: string }> = []

      for (const filePath of uniqueFiles.slice(0, 10)) {
        try {
          const content = await readFile(path.join(tempPath, filePath), 'utf-8')
          affectedFiles.push({ path: filePath, content })
        } catch { /* skip */ }
      }

      const fixResult = await generateValidationFixes({
        errors: errors.slice(0, 20),
        affectedFiles,
        techStack,
        stackHandler: stack,
      })

      for (const fix of fixResult.fixes) {
        const fixPath = path.join(tempPath, fix.path)
        await mkdir(path.dirname(fixPath), { recursive: true })
        await writeFile(fixPath, fix.content, 'utf-8')
      }

      fixesApplied += fixResult.fixes.length
      log(`Applied ${fixResult.fixes.length} fixes`)
      errors = await validateProject(tempPath)
    }

    validationErrors = errors

    // Stage 6: TypeScript validation (quick check for preview)
    let tsErrors: TypeScriptError[] = []
    if (errors.length === 0) {
      log('Running TypeScript compilation check...')

      try {
        await execAsync('npm install --legacy-peer-deps', { cwd: tempPath, timeout: 180000 })
      } catch (e) {
        log(`npm install warning: ${e instanceof Error ? e.message : 'unknown'}`)
      }

      tsErrors = await runTypeScriptValidation(tempPath)
      tsErrorCount = tsErrors.length

      if (tsErrors.length === 0) {
        log('TypeScript compilation passed!')
      } else {
        log(`TypeScript found ${tsErrors.length} errors`)
        // Add TS errors to validation errors for display
        for (const tsErr of tsErrors.slice(0, 10)) {
          validationErrors.push({
            file: tsErr.file,
            line: tsErr.line,
            message: `${tsErr.code}: ${tsErr.message}`,
          })
        }
      }
    }

    // Collect final file list
    const finalFiles = await walkDir(tempPath)
    const fileList = await Promise.all(
      finalFiles.map(async (f) => {
        const relativePath = path.relative(tempPath, f).replace(/\\/g, '/')
        const stats = await stat(f)
        return {
          path: relativePath,
          action: 'create' as const,
          size: stats.size,
        }
      })
    )

    log(`Preview complete: ${fileList.length} files, ${validationErrors.length} errors`)

    return {
      success: validationErrors.length === 0,
      files: fileList.sort((a, b) => a.path.localeCompare(b.path)),
      totalFiles: fileList.length,
      validationErrors,
      fixesApplied,
      tsErrors: tsErrorCount,
      logs,
      tempPath,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log(`Preview error: ${errorMessage}`)

    // Clean up temp on error
    try {
      await rm(tempPath, { recursive: true, force: true })
    } catch { /* ignore */ }

    throw error
  }
}

// =============================================================================
// Confirm Dry Run (Move temp to final, save to DB)
// =============================================================================

export interface ConfirmAssemblyInput {
  projectId: string
  blueprintId: string
  tempPath: string
  orgId: string
  userId: string
}

export async function confirmAssembly(input: ConfirmAssemblyInput) {
  await connectDB()

  const project = await Project.findById(input.projectId)
  if (!project) throw new Error('Project not found')

  const blueprint = await Blueprint.findById(input.blueprintId)
  if (!blueprint) throw new Error('Blueprint not found')

  const workOrders = await WorkOrder.find({
    blueprintId: input.blueprintId,
    status: 'completed',
  })

  // Verify temp path exists
  if (!(await dirExists(input.tempPath))) {
    throw new Error('Preview files not found. Please run preview again.')
  }

  // Final output path
  const outputPath = path.join(ASSEMBLED_DIR, input.projectId, input.blueprintId)

  // Move temp to final
  if (await dirExists(outputPath)) {
    await rm(outputPath, { recursive: true, force: true })
  }
  await mkdir(path.dirname(outputPath), { recursive: true })

  // Copy files from temp to final
  const tempFiles = await walkDir(input.tempPath)
  const mergedFiles: string[] = []

  for (const file of tempFiles) {
    const relativePath = path.relative(input.tempPath, file).replace(/\\/g, '/')
    const destPath = path.join(outputPath, relativePath)
    await mkdir(path.dirname(destPath), { recursive: true })
    const content = await readFile(file, 'utf-8')
    await writeFile(destPath, content, 'utf-8')
    mergedFiles.push(relativePath)
  }

  // Clean up temp
  await rm(input.tempPath, { recursive: true, force: true })

  // Create Assembly record
  const assembly = await Assembly.create({
    projectId: input.projectId,
    blueprintId: input.blueprintId,
    status: 'completed',
    outputPath,
    workOrderIds: workOrders.map((wo) => wo._id),
    scaffold: { techStack: [], files: [] },
    mergedFiles,
    validationErrors: [],
    fixAttempts: 0,
    startedAt: new Date(),
    completedAt: new Date(),
    createdBy: input.userId,
    logs: [{ timestamp: new Date(), message: 'Assembly confirmed from preview' }],
  })

  return assembly
}

// =============================================================================
// Cancel Dry Run (Clean up temp files)
// =============================================================================

export async function cancelDryRun(tempPath: string): Promise<void> {
  if (await dirExists(tempPath)) {
    await rm(tempPath, { recursive: true, force: true })
  }
}
