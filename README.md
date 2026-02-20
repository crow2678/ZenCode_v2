# ZenCode V2

AI-powered, stack-agnostic code generation platform. Describe your vision in natural language, choose your tech stack, and let AI build production-ready applications.

## Pipeline

```
PRD → Blueprint → Work Orders → Assembly
```

1. **PRD** — Generate a Product Requirements Document from natural language
2. **Blueprint** — AI creates technical architecture (models, services, routes, components)
3. **Work Orders** — Break the blueprint into executable code generation tasks
4. **Assembly** — Execute work orders, merge files, validate imports, and build the project

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **API:** tRPC
- **Database:** MongoDB / Mongoose
- **Auth:** Clerk
- **UI:** Tailwind CSS + shadcn/ui
- **AI:** Anthropic Claude

## Supported Code Generation Stacks

| Stack | Language | Database |
|-------|----------|----------|
| Next.js + MongoDB | TypeScript | MongoDB |
| FastAPI + PostgreSQL | Python | PostgreSQL |
| Express + PostgreSQL | TypeScript | PostgreSQL |

New stacks can be added via the plugin system in `src/stacks/`.

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance
- Anthropic API key
- Clerk account

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys

# Run dev server
npm run dev
```

The app runs at [http://localhost:3001](http://localhost:3001).

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Dashboard layout & pages
│   └── api/trpc/           # tRPC API handler
├── stacks/                 # Stack plugin system
│   ├── nextjs-mongodb/     # Next.js + MongoDB stack
│   ├── fastapi-postgres/   # FastAPI + PostgreSQL stack
│   └── express-postgres/   # Express + PostgreSQL stack
├── server/
│   ├── services/           # Business logic (agent, assembly, blueprint, etc.)
│   └── trpc/               # tRPC router & procedures
├── lib/
│   ├── ai/                 # Anthropic Claude integration
│   └── db/                 # MongoDB models & connection
└── components/             # React components (shadcn/ui)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |

## License

[MIT](LICENSE)
