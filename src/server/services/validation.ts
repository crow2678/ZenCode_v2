/**
 * ZenCode V2 - Pre-Assembly Validation Service
 *
 * Operates on in-memory file map (no disk I/O, no AI).
 * Checks import/export consistency before assembly.
 */

import path from 'path'

export interface QuickValidationError {
  file: string
  line: number
  message: string
  severity: 'error' | 'warning'
}

export interface QuickValidationResult {
  valid: boolean
  errors: QuickValidationError[]
  fileCount: number
  importCount: number
}

/**
 * Quick validation of work order files.
 * Checks imports resolve within the file set.
 */
export function quickValidate(
  files: Map<string, string>,
  aliases: Record<string, string> = { '@/': 'src/' }
): QuickValidationResult {
  const errors: QuickValidationError[] = []
  let importCount = 0

  // Build set of available file paths (with extension variants)
  const availableFiles = new Set<string>()
  for (const filePath of files.keys()) {
    availableFiles.add(filePath)
    // Also add without extension for resolution
    const ext = path.extname(filePath)
    if (ext) {
      availableFiles.add(filePath.slice(0, -ext.length))
    }
  }

  for (const [filePath, content] of files) {
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check alias imports (e.g., @/lib/utils)
      for (const [prefix, target] of Object.entries(aliases)) {
        const aliasRegex = new RegExp(`from\\s+['"]${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^'"]+)['"]`)
        const match = line.match(aliasRegex)
        if (!match) continue

        importCount++
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
            file: filePath,
            line: i + 1,
            message: `Unresolved import: ${prefix}${importPath}`,
            severity: 'warning',
          })
        }
      }

      // Check relative imports
      const relImportMatch = line.match(/from\s+['"](\.\.?\/[^'"]+)['"]/)
      if (relImportMatch) {
        importCount++
        const importPath = relImportMatch[1]
        const fileDir = path.dirname(filePath)
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
            file: filePath,
            line: i + 1,
            message: `Unresolved relative import: ${importPath}`,
            severity: 'warning',
          })
        }
      }
    }

    // Check named imports vs exports
    const namedImports = extractNamedImports(content)
    for (const imp of namedImports) {
      if (!imp.source.startsWith('.') && !imp.source.startsWith('@/')) continue

      let resolvedPath: string | null = null
      if (imp.source.startsWith('@/')) {
        const withoutAlias = imp.source.replace('@/', 'src/')
        const candidates = [withoutAlias + '.ts', withoutAlias + '.tsx', withoutAlias + '/index.ts']
        resolvedPath = candidates.find((c) => files.has(c)) || null
      } else {
        const fileDir = path.dirname(filePath)
        const resolvedBase = path.posix.normalize(path.posix.join(fileDir, imp.source))
        const candidates = [resolvedBase + '.ts', resolvedBase + '.tsx', resolvedBase + '/index.ts']
        resolvedPath = candidates.find((c) => files.has(c)) || null
      }

      if (!resolvedPath) continue

      const targetContent = files.get(resolvedPath)
      if (!targetContent) continue

      const targetExports = extractFileExports(targetContent)
      for (const name of imp.names) {
        if (name === 'default') continue
        if (!targetExports.has(name)) {
          errors.push({
            file: filePath,
            line: imp.line,
            message: `Named import '${name}' not found in exports of ${resolvedPath}`,
            severity: 'error',
          })
        }
      }
    }
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    fileCount: files.size,
    importCount,
  }
}

// ============================================================================
// Import/Export Extraction (shared with assembly.ts)
// ============================================================================

function extractNamedImports(content: string): Array<{
  names: string[]
  source: string
  line: number
}> {
  const results: Array<{ names: string[]; source: string; line: number }> = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
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
