/**
 * ZenCode V2 - Scaffold & Fix Generation
 *
 * AI-powered file generation and validation fixing.
 * Ported from V1 with stack-aware improvements.
 */

import { chat, parseAiJson } from './anthropic'
import type { IStackHandler } from '@/stacks/types'

interface FileEntry {
  path: string
  content: string
}

// =============================================================================
// Package.json Fixing
// =============================================================================

// Known non-existent npm packages that AI commonly hallucinates
const INVALID_NPM_PACKAGES = new Set([
  '@radix-ui/react-button',
  '@radix-ui/react-input',
  '@radix-ui/react-textarea',
  '@radix-ui/react-card',
  '@radix-ui/react-badge',
  '@radix-ui/react-form',
  '@radix-ui/react-table',
  '@radix-ui/react-spinner',
  '@radix-ui/react-loading',
  '@radix-ui/react-modal',
])

// Required dependencies for common patterns
const REQUIRED_DEPS_BY_PATTERN: Record<string, Record<string, string>> = {
  'sonner': { 'next-themes': '^0.3.0' },
  'calendar': { 'react-day-picker': '^8.10.0', 'date-fns': '^3.0.0' },
  '@trpc/client': { 'superjson': '^2.2.1' },
  '@trpc/react-query': { '@tanstack/react-query': '^4.36.1' },
}

// Map of shadcn/ui component files to their required Radix packages
const SHADCN_RADIX_DEPS: Record<string, string> = {
  'accordion': '@radix-ui/react-accordion',
  'alert-dialog': '@radix-ui/react-alert-dialog',
  'avatar': '@radix-ui/react-avatar',
  'checkbox': '@radix-ui/react-checkbox',
  'dialog': '@radix-ui/react-dialog',
  'dropdown-menu': '@radix-ui/react-dropdown-menu',
  'label': '@radix-ui/react-label',
  'popover': '@radix-ui/react-popover',
  'progress': '@radix-ui/react-progress',
  'select': '@radix-ui/react-select',
  'separator': '@radix-ui/react-separator',
  'sheet': '@radix-ui/react-dialog',
  'switch': '@radix-ui/react-switch',
  'tabs': '@radix-ui/react-tabs',
  'toast': '@radix-ui/react-toast',
  'tooltip': '@radix-ui/react-tooltip',
}

/**
 * Fix package.json: remove invalid packages, add missing dependencies
 */
export function fixPackageJson(content: string, existingFilePaths: string[]): string {
  try {
    const pkg = JSON.parse(content)

    // Remove invalid packages
    if (pkg.dependencies) {
      for (const dep of Object.keys(pkg.dependencies)) {
        if (INVALID_NPM_PACKAGES.has(dep)) {
          delete pkg.dependencies[dep]
        }
      }
    }

    // Enforce required dependency versions based on detected patterns
    // AI often hallucinate newer versions (e.g. react-query v5) that are incompatible
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    for (const [pattern, requiredDeps] of Object.entries(REQUIRED_DEPS_BY_PATTERN)) {
      if (allDeps[pattern]) {
        for (const [dep, version] of Object.entries(requiredDeps)) {
          pkg.dependencies = pkg.dependencies || {}
          pkg.dependencies[dep] = version
        }
      }
    }

    // Detect shadcn/ui components and add required Radix packages
    const uiComponents = existingFilePaths
      .filter((f) => f.includes('components/ui/'))
      .map((f) => {
        const match = f.match(/components\/ui\/([^./]+)/)
        return match ? match[1] : null
      })
      .filter(Boolean) as string[]

    for (const component of uiComponents) {
      const radixPkg = SHADCN_RADIX_DEPS[component]
      if (radixPkg && !pkg.dependencies?.[radixPkg]) {
        pkg.dependencies = pkg.dependencies || {}
        pkg.dependencies[radixPkg] = '^1.0.0'
      }
    }

    return JSON.stringify(pkg, null, 2)
  } catch (error) {
    console.warn('fixPackageJson: Failed to parse package.json, returning original content:', error)
    return content
  }
}

// =============================================================================
// File Extension Fixing
// =============================================================================

function containsJSX(content: string): boolean {
  const jsxPatterns = [
    /<[A-Z][a-zA-Z0-9]*[\s/>]/,
    /<\/[A-Za-z]/,
    /className=/,
    /onClick=/,
    /\breturn\s*\(\s*</,
  ]
  return jsxPatterns.some((pattern) => pattern.test(content))
}

function fixFileExtension(file: FileEntry): FileEntry {
  if (file.path.endsWith('.ts') && !file.path.endsWith('.d.ts')) {
    if (containsJSX(file.content)) {
      return { ...file, path: file.path.replace(/\.ts$/, '.tsx') }
    }
  }
  return file
}

function fixFileExtensions(files: FileEntry[]): FileEntry[] {
  return files.map(fixFileExtension)
}

// =============================================================================
// Generate Scaffold Files
// =============================================================================

export interface ScaffoldInput {
  projectName: string
  techStack: string[]
  extractedDeps: string[]
  existingFilePaths: string[]
  stackHandler: IStackHandler
}

export async function generateScaffold(input: ScaffoldInput): Promise<{ files: FileEntry[] }> {
  const systemPrompt = input.stackHandler.getPromptSection('scaffold')
  const baseSystem = `You are an expert at scaffolding software projects. Generate appropriate project configuration files.

Return your response as a JSON object with this exact structure:
{
  "files": [
    { "path": "relative/path/to/file", "content": "file content" }
  ]
}

${systemPrompt}

Rules:
- Generate ONLY config/setup files — do NOT generate application source files
- package.json must include all detected import dependencies
- CRITICAL: Only use packages that actually exist. Do NOT use fake Radix packages.
- When using tRPC, include superjson and @tanstack/react-query
- Include .env.example, Dockerfile, docker-compose.yml, README.md
- IMPORTANT: Escape all special characters in JSON strings properly
- Return ONLY the JSON object`

  const userPrompt = `Generate scaffold files for this project:

**Project:** ${input.projectName}
**Tech Stack:** ${input.techStack.join(', ')}
**Detected dependencies:** ${input.extractedDeps.join(', ') || 'none'}
**Existing source files:**
${input.existingFilePaths.slice(0, 50).join('\n')}

Return only the JSON object.`

  const result = await parseAiJson<{ files: FileEntry[] }>(
    () => chat([{ role: 'user', content: userPrompt }], { system: baseSystem, maxTokens: 16384 }),
    'generateScaffold'
  )

  const processedFiles = fixFileExtensions(result.files).map((file) => {
    if (file.path === 'package.json') {
      return { ...file, content: fixPackageJson(file.content, input.existingFilePaths) }
    }
    return file
  })

  return { files: processedFiles }
}

// =============================================================================
// Generate Missing Files
// =============================================================================

export interface MissingFilesInput {
  techStack: string[]
  missingPaths: string[]
  existingFileTree: string[]
  sampleImports: Array<{ file: string; imports: string[] }>
  requiredExports?: Array<{ path: string; exports: string[]; importedBy: string[] }>
  stackHandler: IStackHandler
}

export async function generateMissingFiles(
  input: MissingFilesInput
): Promise<{ files: FileEntry[] }> {
  const stackPrompt = input.stackHandler.getPromptSection('missing_files')

  const system = `You are an expert at generating framework boilerplate files. The assembled project has code that imports from files that don't exist yet. Generate these missing files.

Return your response as a JSON object:
{
  "files": [
    { "path": "relative/path/to/file", "content": "complete file content" }
  ]
}

${stackPrompt}

CRITICAL FILES THAT MUST EXIST:
- **src/lib/utils.ts**: cn() helper for Tailwind class merging
- **src/lib/trpc/client.tsx**: tRPC React client (imports AppRouter from @/server/trpc/root)
- **src/server/trpc/trpc.ts**: tRPC initialization with context and procedures
- **src/server/trpc/root.ts**: Root router registering all procedure routers
- **src/app/api/trpc/[trpc]/route.ts**: tRPC API handler (WITHOUT THIS, tRPC CALLS 404!)
- **src/lib/db/connection.ts**: Database connection utility
- **src/app/providers.tsx**: Client component wrapping ThemeProvider + TRPCReactProvider

TypeScript requirements:
- EVERY function parameter MUST have explicit type annotations
- EVERY callback (.map, .filter) MUST have explicit parameter types
- Define interfaces for all data shapes

Rules:
- Generate ONLY the files listed as missing
- Each file must be complete and functional
- CRITICAL: When "Required exports" are listed, the generated file MUST export ALL those names
- Use singular file names: clip.ts not clips.ts
- Use kebab-case for components: clip-form.tsx not ClipForm.tsx
- Escape all special characters properly in JSON strings
- Return ONLY the JSON object`

  const missingList = input.missingPaths.slice(0, 30).join('\n- ')
  const sampleList = input.sampleImports.slice(0, 10).map((s) => `- ${s.file} imports: ${s.imports.join(', ')}`).join('\n')

  const requiredExportsList = input.requiredExports?.length
    ? '\n\n**Required Exports (MUST be exported):**\n' +
      input.requiredExports.map((r) => `- ${r.path}: ${r.exports.join(', ')}`).join('\n')
    : ''

  const userPrompt = `Generate these missing files:

**Tech Stack:** ${input.techStack.join(', ')}

**Missing Files (${input.missingPaths.length} total):**
- ${missingList}
${requiredExportsList}

**Sample imports showing how they're used:**
${sampleList}

**Existing files:**
${input.existingFileTree.slice(0, 40).join('\n')}

Generate all missing files. Return only the JSON object.`

  const result = await parseAiJson<{ files: FileEntry[] }>(
    () => chat([{ role: 'user', content: userPrompt }], { system, maxTokens: 32768 }),
    'generateMissingFiles'
  )

  return { files: fixFileExtensions(result.files) }
}

// =============================================================================
// Generate Validation Fixes
// =============================================================================

export interface ValidationFixInput {
  errors: Array<{ file: string; line: number; message: string }>
  affectedFiles: Array<{ path: string; content: string }>
  techStack: string[]
  siblingFiles?: Array<{ dir: string; files: string[] }>
  importingContext?: Array<{ file: string; imports: string[] }>
  stackHandler: IStackHandler
}

export async function generateValidationFixes(
  input: ValidationFixInput
): Promise<{ fixes: FileEntry[] }> {
  const stackPrompt = input.stackHandler.getPromptSection('validation_fixes')

  const system = `You are an expert at fixing import and export errors. Given validation errors and affected file contents, fix ONLY the listed errors.

Return your response as a JSON object:
{
  "fixes": [
    { "path": "relative/path/to/file", "content": "the complete fixed file content" }
  ]
}

${stackPrompt}

Rules:
- Fix only the specific errors listed
- Return complete file contents (not diffs)
- Preserve existing code structure
- When fixing barrel files, look at "Sibling Files" to know what to re-export
- When fixing export mismatches, look at "Importing Context" for expected exports
- CRITICAL: When "MUST add named exports" is listed, ADD fully implemented functions
- TypeScript interfaces: use export type { IModel } from './model'
- Return ONLY the JSON object`

  const errorList = input.errors.slice(0, 20).map((e) => `- ${e.file}:${e.line} — ${e.message}`).join('\n')
  const fileContents = input.affectedFiles.slice(0, 10).map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')

  const siblingSection = input.siblingFiles?.length
    ? `\n**Sibling Files:**\n${input.siblingFiles.map((s) => `- ${s.dir}/: ${s.files.join(', ')}`).join('\n')}`
    : ''

  const importingSection = input.importingContext?.length
    ? `\n**Importing Context:**\n${input.importingContext.slice(0, 10).map((c) => `- ${c.file} expects: ${c.imports.join(', ')}`).join('\n')}`
    : ''

  const userPrompt = `Fix these validation errors:

**Tech Stack:** ${input.techStack.join(', ')}

**Errors:**
${errorList}

**Affected Files:**
${fileContents}
${siblingSection}${importingSection}

Return only the JSON object.`

  const result = await parseAiJson<{ fixes: FileEntry[] }>(
    () => chat([{ role: 'user', content: userPrompt }], { system, maxTokens: 32768 }),
    'generateValidationFixes'
  )

  return { fixes: fixFileExtensions(result.fixes) }
}

// =============================================================================
// Generate TypeScript Fixes
// =============================================================================

export interface TypeScriptFixInput {
  errors: Array<{ file: string; line: number; code: string; message: string }>
  affectedFiles: Array<{ path: string; content: string }>
  techStack: string[]
  packageJson?: string
  stackHandler: IStackHandler
}

export async function generateTypeScriptFixes(
  input: TypeScriptFixInput
): Promise<{ fixes: FileEntry[]; packageJsonFixes?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } }> {
  const system = `You are an expert TypeScript developer fixing compilation errors. Fix ALL the listed errors.

Return your response as a JSON object:
{
  "fixes": [
    { "path": "relative/path/to/file", "content": "the complete fixed file content" }
  ],
  "packageJsonFixes": {
    "dependencies": { "package-name": "^version" },
    "devDependencies": { "package-name": "^version" }
  }
}

Common fixes:
- TS2307 "Cannot find module 'X'": Add missing package to packageJsonFixes
- TS7006 "Parameter implicitly has 'any' type": Add explicit type annotations
- TS2339 "Property 'X' does not exist": Fix property access or update interface
- TS2322 "Type 'X' is not assignable": Fix type mismatch

Rules:
- Fix ALL errors in a file
- Return complete file contents
- For missing packages, add to packageJsonFixes
- Prefer proper types over 'any'
- Return ONLY the JSON object`

  const errorList = input.errors.slice(0, 30).map((e) => `${e.file}:${e.line} ${e.code}: ${e.message}`).join('\n')
  const fileContents = input.affectedFiles.slice(0, 10).map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')

  const userPrompt = `Fix these TypeScript errors:

**Tech Stack:** ${input.techStack.join(', ')}

**Errors (${input.errors.length} total):**
${errorList}

**Affected Files:**
${fileContents}
${input.packageJson ? `\n**Current package.json:**\n${input.packageJson}` : ''}

Fix all errors. Return only the JSON object.`

  const result = await parseAiJson<{
    fixes: FileEntry[]
    packageJsonFixes?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  }>(
    () => chat([{ role: 'user', content: userPrompt }], { system, maxTokens: 65536 }),
    'generateTypeScriptFixes'
  )

  return { fixes: fixFileExtensions(result.fixes), packageJsonFixes: result.packageJsonFixes }
}

// =============================================================================
// Generate Wiring Files
// =============================================================================

export interface WiringInput {
  techStack: string[]
  modules: Array<{ dir: string; file: string; exports: string[] }>
  fileTree: string[]
  stackHandler: IStackHandler
}

export async function generateWiring(input: WiringInput): Promise<{ files: FileEntry[] }> {
  const stackPrompt = input.stackHandler.getPromptSection('wiring')

  const system = `You are an expert at wiring software projects. Generate barrel export files and router registration files.

Return your response as a JSON object:
{
  "files": [
    { "path": "relative/path/to/file", "content": "file content" }
  ]
}

${stackPrompt}

Rules:
- Generate barrel index.ts files for module directories
- For tRPC root.ts: use SINGULAR router keys (board, not boards)
- TypeScript interface re-exports: export type { IModel } from './model'
- Only export from singular files (clip.ts not clips.ts)
- Return ONLY the JSON object`

  const moduleList = input.modules.slice(0, 50).map((m) => `- ${m.dir}/${m.file}: [${m.exports.join(', ')}]`).join('\n')

  const userPrompt = `Generate wiring files:

**Tech Stack:** ${input.techStack.join(', ')}

**Modules:**
${moduleList || 'None found'}

**File Tree:**
${input.fileTree.slice(0, 60).join('\n')}

Return only the JSON object.`

  const result = await parseAiJson<{ files: FileEntry[] }>(
    () => chat([{ role: 'user', content: userPrompt }], { system, maxTokens: 16384 }),
    'generateWiring'
  )

  return { files: fixFileExtensions(result.files) }
}
