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

This is one of the most impactful ways to contribute. ZenCode uses a plugin system where each stack implements the `IStackHandler` interface.

**Steps to add a new stack:**

1. Create a new directory under `src/stacks/` (e.g., `src/stacks/django-postgres/`)
2. Implement the `IStackHandler` interface from `src/stacks/types.ts`
3. Your handler must provide:
   - **Identity**: `id`, `name`, `description`, `icon`, `language`, `framework`, `runtime`
   - **File structure**: paths for models, services, routes, pages, components, utils
   - **Parsing**: import/export parsing for the stack's language
   - **Prompts**: AI prompt sections for PRD, blueprint, work orders, and code generation
   - **Templates**: scaffold templates and required files
4. Register your handler in `src/stacks/registry.ts`
5. Use the [New Stack](https://github.com/crow2678/ZenCode_v2/issues/new?template=new_stack.md) issue template to propose your stack first

**Reference implementations:**
- `src/stacks/nextjs-mongodb/` — TypeScript + Node.js stack
- `src/stacks/fastapi-postgres/` — Python stack
- `src/stacks/express-postgres/` — TypeScript + Express stack

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
