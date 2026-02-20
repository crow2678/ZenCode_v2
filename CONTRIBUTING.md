# Contributing to ZenCode V2

Thanks for your interest in contributing to ZenCode V2! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)
- Anthropic API key
- Clerk account (for authentication)

### Setup

```bash
# Fork and clone the repo
git clone https://github.com/<your-username>/zencode-v2.git
cd zencode-v2

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Fill in your keys in .env.local

# Start the dev server
npm run dev
```

The app runs at [http://localhost:3001](http://localhost:3001).

## How to Contribute

### Reporting Bugs

- Use the [Bug Report](https://github.com/crow2678/ZenCode_v2/issues/new?template=bug_report.md) issue template
- Include steps to reproduce, expected vs actual behavior, and screenshots if applicable

### Suggesting Features

- Use the [Feature Request](https://github.com/crow2678/ZenCode_v2/issues/new?template=feature_request.md) issue template
- Describe the problem your feature solves and any alternatives you've considered

### Adding a New Stack

This is one of the most impactful ways to contribute. ZenCode uses a plugin system where each stack extends the `BaseStackHandler` class and implements the `IStackHandler` interface.

> Before starting, please open an issue using the [New Stack](https://github.com/crow2678/ZenCode_v2/issues/new?template=new_stack.md) template to discuss your proposed stack.

#### Stack File Structure

Each stack lives in its own directory under `src/stacks/` with three files:

```
src/stacks/your-stack/
├── index.ts       # Handler class (extends BaseStackHandler)
├── prompts.ts     # AI prompt sections for all pipeline stages
└── templates.ts   # Scaffold templates and required files
```

#### Step 1: Create the Handler (`index.ts`)

Your handler class extends `BaseStackHandler` and must provide:

**Identity & Language:**

```typescript
import { BaseStackHandler } from '../base'
import { stackRegistry } from '../registry'
import type { PromptSection, PromptContext, /* ... */ } from '../types'

class DjangoPostgresHandler extends BaseStackHandler {
  // Identity
  readonly id = 'django-postgres'
  readonly name = 'Django + PostgreSQL'
  readonly description = 'Django with PostgreSQL, DRF, and Celery'
  readonly icon = '🐍'
  readonly version = '1.0.0'

  // Language
  readonly language = 'python' as const
  readonly framework = 'django'
  readonly runtime = 'python' as const

  // File extensions
  readonly sourceExtensions = ['.py']
  readonly configFiles = ['pyproject.toml', 'manage.py']
  readonly indexFileNames = ['__init__.py']

  // Where generated files go (used by AI for correct paths)
  readonly fileStructure = {
    models: 'app/models',
    services: 'app/services',
    routes: 'app/views',
    pages: 'templates',
    components: 'app/templatetags',
    utils: 'app/utils',
  }

  // Dependency management
  readonly dependencyFile = 'pyproject.toml'
  readonly lockFile = 'requirements.lock'
```

**Required Methods:**

| Method | Purpose |
|--------|---------|
| `parseImports(content, filePath)` | Parse `import` / `from ... import` statements into `ImportInfo[]` |
| `parseExports(content, filePath)` | Parse module-level definitions into `ExportInfo[]` |
| `parsePackageDependencies(content)` | Extract external package names from imports |
| `getPathAliases(projectDir)` | Return path alias map (e.g., `{}` for Python) |
| `resolveImportPath(source, fromFile, projectDir, availableFiles)` | Resolve an import to a file path, or `null` for external packages |
| `parseDependencyFile(content)` | Parse `pyproject.toml` / `requirements.txt` into `DependencyInfo[]` |
| `serializeDependencyFile(deps, existing?)` | Serialize dependencies back to file format |
| `getInstallCommand(deps)` | Return install command (e.g., `pip install pkg1 pkg2`) |
| `getTypeCheckCommand()` | Return type-check command or `null` |
| `getLintCommand()` | Return lint command or `null` |
| `validateFile(content, filePath)` | Return `ValidationError[]` for stack-specific issues |
| `getPromptSection(section)` | Delegate to `prompts.ts` |
| `buildSystemPrompt(context)` | Delegate to `prompts.ts` |
| `getScaffoldTemplates()` | Delegate to `templates.ts` |
| `getRequiredFiles()` | Delegate to `templates.ts` |

See `src/stacks/types.ts` for the full type definitions of `ImportInfo`, `ExportInfo`, `ValidationError`, `DependencyInfo`, and `PromptSection`.

**Auto-register at the bottom of the file:**

```typescript
const handler = new DjangoPostgresHandler()
stackRegistry.register(handler)
export { handler as djangoPostgresHandler }
```

#### Step 2: Create AI Prompts (`prompts.ts`)

This file contains all the prompt text the AI uses when generating code for your stack. You must provide a `getPromptSection(section: PromptSection): string` function that returns content for each section:

| Section | Stage | What to include |
|---------|-------|-----------------|
| `project-structure` | All | Directory tree showing where files go |
| `code-patterns` | All | Framework setup, config, common patterns |
| `component-patterns` | All | UI component patterns (templates, views) |
| `model-patterns` | All | ORM model definitions, migrations |
| `service-patterns` | All | Business logic layer patterns |
| `route-patterns` | All | URL routing, views, serializers |
| `auth-patterns` | All | Authentication/authorization patterns |
| `validation-checklist` | All | Pre-submit checklist for the AI |
| `prd` | PRD | Stack-specific PRD generation instructions |
| `blueprint` | Blueprint | Blueprint generation instructions |
| `work-orders` | Work Orders | Work order format (metadata only, NO code) |
| `agent-execution` | Assembly | Full code templates for each file type |
| `scaffold` | Assembly | Required config/boilerplate files |
| `missing_files` | Assembly | Critical files to generate if missing |
| `validation_fixes` | Assembly | Patterns for fixing common issues |
| `wiring` | Assembly | Barrel files, router wiring, naming |

Also provide `buildSystemPrompt(context: PromptContext): string` that assembles the relevant sections into a complete system prompt.

> **Important**: Prompt sections are stage-specific. The `agent-execution` section (with full code templates) is only used during code generation, NOT during work order generation. Mixing stages wastes tokens and causes errors.

#### Step 3: Create Templates (`templates.ts`)

Provide two exports:

```typescript
// Returns a Map<filePath, fileContent> of all scaffold/boilerplate files
// Use {{projectName}} as a placeholder
export function getScaffoldTemplates(): Map<string, string> {
  const templates = new Map<string, string>()
  templates.set('pyproject.toml', `[project]\nname = "{{projectName}}"...`)
  templates.set('manage.py', `#!/usr/bin/env python...`)
  // ... all boilerplate files
  return templates
}

// Returns file paths that MUST exist in a valid generated project
export function getRequiredFiles(): string[] {
  return ['pyproject.toml', 'manage.py', 'app/__init__.py', ...]
}
```

#### Step 4: Register in the Entry Point

Add a side-effect import to `src/stacks/index.ts`:

```typescript
// Built-in stacks
import './nextjs-mongodb'
import './fastapi-postgres'
import './express-postgres'
import './django-postgres'    // <-- add your stack
```

#### Step 5: Update Stack Detection (Optional)

If you want ZenCode to auto-detect your stack from PRDs, update the keyword matching in `src/stacks/factory.ts` inside the `resolveFromPRD()` method.

#### Reference Implementations

Study these existing stacks to understand the patterns:

| Stack | Language | Directory |
|-------|----------|-----------|
| Next.js + MongoDB | TypeScript | `src/stacks/nextjs-mongodb/` |
| FastAPI + PostgreSQL | Python | `src/stacks/fastapi-postgres/` |
| Express + PostgreSQL | TypeScript | `src/stacks/express-postgres/` |

#### Testing Your Stack

1. Run the dev server: `npm run dev`
2. Create a new project and select your stack
3. Generate a PRD, blueprint, work orders, and assembly
4. Verify the generated code is syntactically correct and follows your framework's conventions
5. Download the assembled project and confirm it runs

### Pull Request Process

1. Fork the repo and create a feature branch from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes following the coding conventions below
3. Run lint and tests before submitting
   ```bash
   npm run lint
   npm test
   ```
4. Push to your fork and open a Pull Request against `main`
5. Fill out the PR template with a description of your changes

## Coding Conventions

- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **File naming**: singular kebab-case (`task-form.tsx`, `user.ts`)
- **Folder structure**: follow the existing patterns in `src/`
  - Models: `src/lib/db/models/`
  - Services: `src/server/services/`
  - tRPC procedures: `src/server/trpc/procedures/`
  - Components: `src/components/`
  - Pages: `src/app/`
- **Imports**: use `@/` path alias (maps to `src/`)
- **API**: tRPC for all client-server communication
- **AI prompts**: stage-specific — don't mix prompts between pipeline stages (e.g., agent-execution prompts belong in code generation, not work order generation)

## Project Architecture

```
PRD → Blueprint → Work Orders → Assembly
```

Each stage in the pipeline has its own service under `src/server/services/`:
- `document.ts` — PRD management
- `requirement.ts` — Requirements extraction
- `blueprint.ts` — Technical architecture generation
- `work-orders.ts` — Task breakdown (metadata only, no code)
- `agent.ts` — Code generation per work order
- `assembly.ts` — File merging, import validation, project scaffolding

The AI integration lives in `src/lib/ai/anthropic.ts` with prompt caching and streaming support.

## Questions?

Open an issue or start a discussion. We're happy to help you get started!
