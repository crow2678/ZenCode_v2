/**
 * ZenCode V2 - AI Prompt Builder
 *
 * Builds context-aware prompts using stack handlers for stack-specific knowledge.
 */

import { getStack } from '@/stacks'
import type { IStackHandler, PromptContext, PromptSection } from '@/stacks/types'
import type { WorkOrder, MissingFileInfo } from '@/engine/types'

// =============================================================================
// Types
// =============================================================================

export interface PRDContext {
  projectName: string
  description: string
  features: string[]
  authType?: 'none' | 'clerk' | 'auth0' | 'firebase' | 'custom'
  techStack?: string[]
}

export interface BlueprintContext {
  prd: PRDContext
  features: Array<{
    name: string
    description: string
    userStories?: string[]
  }>
}

export interface WorkOrderContext {
  blueprint: {
    projectName: string
    features: string[]
    models: string[]
    services: string[]
    components: string[]
  }
  existingFiles?: string[]
  phase?: string
}

export interface AssemblyContext {
  workOrders: WorkOrder[]
  existingFiles: string[]
  missingFiles?: MissingFileInfo[]
  validationErrors?: Array<{
    file: string
    line: number
    message: string
  }>
}

// =============================================================================
// Prompt Builder
// =============================================================================

export class PromptBuilder {
  private stack: IStackHandler

  constructor(stackId?: string) {
    this.stack = getStack(stackId)
  }

  /**
   * Build system prompt for PRD generation
   */
  buildPRDPrompt(): string {
    return `You are an expert software architect creating a Product Requirements Document (PRD).

## Output Format
Generate a structured PRD with:
1. Project Overview
2. Goals and Objectives
3. User Personas
4. Functional Requirements (user stories)
5. Non-Functional Requirements
6. Data Models (high-level)
7. API Endpoints (high-level)
8. UI/UX Requirements
9. Security Considerations
10. Success Metrics

## Tech Stack
${this.stack.name}

${this.stack.getPromptSection('project-structure')}

## Guidelines
- Be specific and actionable
- Include acceptance criteria for each feature
- Consider edge cases and error states
- Focus on user value, not implementation details
- Keep scope realistic and achievable`
  }

  /**
   * Build system prompt for blueprint generation
   */
  buildBlueprintPrompt(context: BlueprintContext): string {
    const parts: string[] = [
      `You are an expert software architect creating a technical blueprint.`,
      ``,
      `## Project: ${context.prd.projectName}`,
      `${context.prd.description}`,
      ``,
      `## Tech Stack`,
      this.stack.name,
      ``,
      this.stack.getPromptSection('project-structure'),
      ``,
      `## Features to Implement`,
    ]

    for (const feature of context.features) {
      parts.push(`### ${feature.name}`)
      parts.push(feature.description)
      if (feature.userStories?.length) {
        parts.push(`User Stories:`)
        for (const story of feature.userStories) {
          parts.push(`- ${story}`)
        }
      }
      parts.push(``)
    }

    parts.push(`## Output Format`)
    parts.push(`Generate a technical blueprint with:`)
    parts.push(`1. System Architecture Overview`)
    parts.push(`2. Data Models (Mongoose schemas)`)
    parts.push(`3. API Routes (tRPC procedures)`)
    parts.push(`4. Services (business logic)`)
    parts.push(`5. UI Components (React)`)
    parts.push(`6. File Structure`)
    parts.push(`7. Dependencies`)
    parts.push(``)
    parts.push(this.stack.getPromptSection('model-patterns'))
    parts.push(``)
    parts.push(this.stack.getPromptSection('service-patterns'))
    parts.push(``)
    parts.push(this.stack.getPromptSection('route-patterns'))

    return parts.join('\n')
  }

  /**
   * Build system prompt for work order generation
   */
  buildWorkOrderPrompt(context: WorkOrderContext): string {
    const parts: string[] = [
      `You are an expert ${this.stack.framework} developer generating work orders.`,
      ``,
      `## Project: ${context.blueprint.projectName}`,
      ``,
      `## Tech Stack`,
      this.stack.name,
      ``,
    ]

    if (context.phase) {
      parts.push(`## Current Phase: ${context.phase}`)
      parts.push(``)
    }

    parts.push(`## Blueprint Overview`)
    parts.push(`Features: ${context.blueprint.features.join(', ')}`)
    parts.push(`Models: ${context.blueprint.models.join(', ')}`)
    parts.push(`Services: ${context.blueprint.services.join(', ')}`)
    parts.push(`Components: ${context.blueprint.components.join(', ')}`)
    parts.push(``)

    if (context.existingFiles?.length) {
      parts.push(`## Existing Files`)
      for (const file of context.existingFiles.slice(0, 50)) {
        parts.push(`- ${file}`)
      }
      if (context.existingFiles.length > 50) {
        parts.push(`... and ${context.existingFiles.length - 50} more`)
      }
      parts.push(``)
    }

    parts.push(this.stack.getPromptSection('code-patterns'))
    parts.push(``)
    parts.push(this.stack.getPromptSection('validation-checklist'))
    parts.push(``)
    parts.push(`## Output Format`)
    parts.push(`Generate work orders as JSON array:`)
    parts.push(`\`\`\`json`)
    parts.push(`[`)
    parts.push(`  {`)
    parts.push(`    "id": "wo-1",`)
    parts.push(`    "title": "Create User model",`)
    parts.push(`    "description": "...",`)
    parts.push(`    "phase": "models",`)
    parts.push(`    "files": [`)
    parts.push(`      {`)
    parts.push(`        "path": "src/lib/db/models/user.ts",`)
    parts.push(`        "action": "create",`)
    parts.push(`        "content": "..."`)
    parts.push(`      }`)
    parts.push(`    ]`)
    parts.push(`  }`)
    parts.push(`]`)
    parts.push(`\`\`\``)

    return parts.join('\n')
  }

  /**
   * Build prompt for generating missing files
   */
  buildMissingFilesPrompt(context: AssemblyContext): string {
    const parts: string[] = [
      `You are an expert ${this.stack.framework} developer generating missing files.`,
      ``,
      `## Tech Stack`,
      this.stack.name,
      ``,
      this.stack.getPromptSection('code-patterns'),
      ``,
    ]

    if (context.missingFiles?.length) {
      parts.push(`## Missing Files to Generate`)
      parts.push(``)
      for (const file of context.missingFiles) {
        parts.push(`### ${file.path}`)
        parts.push(`Required exports: ${file.requiredExports.join(', ')}`)
        parts.push(`Imported by: ${file.importedBy.join(', ')}`)
        parts.push(``)
      }
    }

    parts.push(`## Existing Files (context)`)
    for (const file of context.existingFiles.slice(0, 30)) {
      parts.push(`- ${file}`)
    }
    if (context.existingFiles.length > 30) {
      parts.push(`... and ${context.existingFiles.length - 30} more`)
    }
    parts.push(``)

    parts.push(this.stack.getPromptSection('validation-checklist'))
    parts.push(``)
    parts.push(`## CRITICAL`)
    parts.push(`- Generate files that export ALL required exports listed above`)
    parts.push(`- For barrel/index files, re-export ALL sibling modules`)
    parts.push(`- Match existing code patterns exactly`)
    parts.push(``)
    parts.push(`## Output Format`)
    parts.push(`\`\`\`json`)
    parts.push(`{`)
    parts.push(`  "files": [`)
    parts.push(`    { "path": "...", "content": "..." }`)
    parts.push(`  ]`)
    parts.push(`}`)
    parts.push(`\`\`\``)

    return parts.join('\n')
  }

  /**
   * Build prompt for fixing validation errors
   */
  buildValidationFixPrompt(context: AssemblyContext): string {
    const parts: string[] = [
      `You are an expert ${this.stack.framework} developer fixing validation errors.`,
      ``,
      `## Tech Stack`,
      this.stack.name,
      ``,
    ]

    if (context.validationErrors?.length) {
      parts.push(`## Errors to Fix`)
      parts.push(``)
      for (const error of context.validationErrors) {
        parts.push(`- ${error.file}:${error.line} - ${error.message}`)
      }
      parts.push(``)
    }

    parts.push(this.stack.getPromptSection('validation-checklist'))
    parts.push(``)
    parts.push(`## Guidelines`)
    parts.push(`- Fix ONLY the errors listed, don't refactor unrelated code`)
    parts.push(`- Ensure all named imports match named exports`)
    parts.push(`- For barrel files, export ALL sibling modules`)
    parts.push(`- Check that exported names match what other files import`)
    parts.push(``)
    parts.push(`## Output Format`)
    parts.push(`\`\`\`json`)
    parts.push(`{`)
    parts.push(`  "fixes": [`)
    parts.push(`    { "path": "...", "content": "..." }`)
    parts.push(`  ]`)
    parts.push(`}`)
    parts.push(`\`\`\``)

    return parts.join('\n')
  }

  /**
   * Get a specific prompt section from the stack
   */
  getSection(section: PromptSection): string {
    return this.stack.getPromptSection(section)
  }

  /**
   * Build full system prompt using stack's buildSystemPrompt
   */
  buildFullSystemPrompt(context: PromptContext): string {
    return this.stack.buildSystemPrompt(context)
  }

  /**
   * Get the current stack info
   */
  getStackInfo(): { id: string; name: string } {
    return {
      id: this.stack.id,
      name: this.stack.name,
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createPromptBuilder(stackId?: string): PromptBuilder {
  return new PromptBuilder(stackId)
}
