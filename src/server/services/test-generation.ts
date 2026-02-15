/**
 * ZenCode V2 - Test Generation Service
 *
 * Reads assembled service files and prompts Claude to generate Vitest tests.
 */

import { connectDB } from '@/lib/db/connection'
import { Assembly, Project } from '@/lib/db/models'
import { chat, parseAiJson, getAnthropicKey } from '@/lib/ai/anthropic'
import { getStack } from '@/stacks'
import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises'
import path from 'path'

// =============================================================================
// Types
// =============================================================================

export interface GenerateTestsInput {
  projectId: string
  orgId: string
  stackId?: string
}

export interface GenerateTestsResult {
  tests: Array<{
    path: string
    content: string
    targetFile: string
  }>
  totalGenerated: number
}

// =============================================================================
// Test Generation
// =============================================================================

export async function generateTests(
  input: GenerateTestsInput
): Promise<GenerateTestsResult> {
  await connectDB()

  const project = await Project.findById(input.projectId)
  if (!project) throw new Error('Project not found')

  // Get latest assembly
  const assembly = await Assembly.findOne({
    projectId: input.projectId,
    status: 'completed',
  }).sort({ createdAt: -1 }).lean()

  if (!assembly?.outputPath) {
    throw new Error('No completed assembly found')
  }

  const stackId = input.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)
  const apiKey = await getAnthropicKey(input.orgId)

  // Find service files to test
  const servicesDir = path.join(assembly.outputPath, stack.fileStructure.services)
  const serviceFiles = await findSourceFiles(servicesDir)

  if (serviceFiles.length === 0) {
    return { tests: [], totalGenerated: 0 }
  }

  const tests: Array<{ path: string; content: string; targetFile: string }> = []

  for (const filePath of serviceFiles.slice(0, 10)) {
    const content = await readFile(filePath, 'utf-8')
    const relativePath = path.relative(assembly.outputPath, filePath).replace(/\\/g, '/')
    const testPath = relativePath.replace(/\.ts$/, '.test.ts')

    const systemPrompt = `You are an expert at writing Vitest unit tests.

Generate comprehensive unit tests for the given TypeScript service file.

Rules:
- Use Vitest (import { describe, it, expect, vi } from 'vitest')
- Mock external dependencies (database, AI calls) using vi.mock()
- Test each exported function
- Include happy path and error cases
- Use descriptive test names

Return JSON:
{
  "path": "test/file/path.test.ts",
  "content": "// Complete test file"
}

Return ONLY valid JSON.`

    const userPrompt = `Generate Vitest tests for this file:

**File:** ${relativePath}

**Content:**
\`\`\`typescript
${content.slice(0, 6000)}
\`\`\`

Generate comprehensive tests.`

    try {
      const result = await parseAiJson<{ path: string; content: string }>(
        () => chat([{ role: 'user', content: userPrompt }], {
          system: systemPrompt,
          maxTokens: 4096,
          apiKey,
          trackUsage: { orgId: input.orgId, projectId: input.projectId, operation: 'test.generate' },
        }),
        `generateTest:${relativePath}`
      )

      const resolvedTestPath = result.path || testPath
      tests.push({
        path: resolvedTestPath,
        content: result.content || '',
        targetFile: relativePath,
      })

      // Write test file to assembly output
      const fullTestPath = path.join(assembly.outputPath, resolvedTestPath)
      await mkdir(path.dirname(fullTestPath), { recursive: true })
      await writeFile(fullTestPath, result.content, 'utf-8')
    } catch (error) {
      console.error(`[TestGen] Failed to generate test for ${relativePath}:`, error)
    }
  }

  return {
    tests,
    totalGenerated: tests.length,
  }
}

// =============================================================================
// Helpers
// =============================================================================

async function findSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await findSourceFiles(fullPath)))
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files
}
