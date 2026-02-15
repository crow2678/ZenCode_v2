/**
 * ZenCode V2 - Test Prompts API
 *
 * Test the prompt builder
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPromptBuilder } from '@/ai'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const stackId = searchParams.get('stack') || undefined
  const section = searchParams.get('section') as
    | 'prd'
    | 'blueprint'
    | 'work-orders'
    | 'project-structure'
    | 'code-patterns'
    | 'validation-checklist'
    | null

  const builder = createPromptBuilder(stackId)
  const stackInfo = builder.getStackInfo()

  let prompt: string

  switch (section) {
    case 'prd':
      prompt = builder.buildPRDPrompt()
      break
    case 'blueprint':
      prompt = builder.buildBlueprintPrompt({
        prd: {
          projectName: 'Sample Project',
          description: 'A sample project for testing',
          features: ['User auth', 'Dashboard', 'Settings'],
          authType: 'clerk',
        },
        features: [
          { name: 'Authentication', description: 'User login/signup with Clerk' },
          { name: 'Dashboard', description: 'Main dashboard with stats' },
        ],
      })
      break
    case 'work-orders':
      prompt = builder.buildWorkOrderPrompt({
        blueprint: {
          projectName: 'Sample Project',
          features: ['Authentication', 'Dashboard'],
          models: ['User', 'Session'],
          services: ['userService', 'authService'],
          components: ['LoginForm', 'Dashboard'],
        },
        existingFiles: ['src/app/page.tsx', 'src/lib/utils.ts'],
      })
      break
    case 'project-structure':
      prompt = builder.getSection('project-structure')
      break
    case 'code-patterns':
      prompt = builder.getSection('code-patterns')
      break
    case 'validation-checklist':
      prompt = builder.getSection('validation-checklist')
      break
    default:
      prompt = builder.buildFullSystemPrompt({
        projectName: 'Sample Project',
        authType: 'clerk',
        features: ['Authentication', 'Dashboard'],
      })
  }

  return NextResponse.json({
    stack: stackInfo,
    section: section || 'full',
    promptLength: prompt.length,
    prompt,
  })
}
