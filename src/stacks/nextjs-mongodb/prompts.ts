/**
 * ZenCode V2 - Next.js + MongoDB Prompt Templates
 *
 * AI prompts optimized for Next.js 14+ with App Router and MongoDB/Mongoose
 */

import type { PromptSection, PromptContext } from '../types'

/**
 * Get a specific prompt section for Next.js + MongoDB stack
 */
export function getPromptSection(section: PromptSection): string {
  switch (section) {
    case 'project-structure':
      return PROJECT_STRUCTURE

    case 'code-patterns':
      return CODE_PATTERNS

    case 'component-patterns':
      return COMPONENT_PATTERNS

    case 'model-patterns':
      return MODEL_PATTERNS

    case 'service-patterns':
      return SERVICE_PATTERNS

    case 'route-patterns':
      return ROUTE_PATTERNS

    case 'auth-patterns':
      return AUTH_PATTERNS

    case 'validation-checklist':
      return VALIDATION_CHECKLIST

    case 'prd':
      return PRD_GENERATION

    case 'blueprint':
      return BLUEPRINT_GENERATION

    case 'work-orders':
      return WORK_ORDER_GENERATION

    case 'agent-execution':
      return AGENT_EXECUTION

    case 'scaffold':
      return SCAFFOLD_PATTERNS

    case 'missing_files':
      return MISSING_FILES_PATTERNS

    case 'validation_fixes':
      return VALIDATION_FIX_PATTERNS

    case 'wiring':
      return WIRING_PATTERNS

    default:
      return ''
  }
}

/**
 * Build complete system prompt for Next.js + MongoDB
 */
export function buildSystemPrompt(context: PromptContext): string {
  const parts: string[] = [
    '# Next.js + MongoDB Application',
    '',
    '## Tech Stack',
    '- **Framework**: Next.js 14+ (App Router)',
    '- **Language**: TypeScript',
    '- **Database**: MongoDB with Mongoose ODM',
    '- **API**: tRPC v10 (type-safe RPC)',
    '- **Styling**: Tailwind CSS with shadcn/ui components',
    '- **State**: React Query (via tRPC)',
    '',
  ]

  // Add project name if provided
  if (context.projectName) {
    parts.push(`## Project: ${context.projectName}`, '')
  }

  // Add auth section
  if (context.authType && context.authType !== 'none') {
    parts.push('## Authentication', `- Using: ${context.authType}`, '')
    parts.push(AUTH_PATTERNS, '')
  }

  // Add all sections
  parts.push(PROJECT_STRUCTURE, '')
  parts.push(CODE_PATTERNS, '')
  parts.push(MODEL_PATTERNS, '')
  parts.push(SERVICE_PATTERNS, '')
  parts.push(ROUTE_PATTERNS, '')
  parts.push(COMPONENT_PATTERNS, '')
  parts.push(VALIDATION_CHECKLIST)

  return parts.join('\n')
}

// =============================================================================
// Prompt Sections
// =============================================================================

const PROJECT_STRUCTURE = `## Project Structure

\`\`\`
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Route group for authenticated pages
│   │   ├── layout.tsx      # Dashboard layout with sidebar
│   │   └── [feature]/      # Feature pages
│   ├── api/
│   │   └── trpc/[trpc]/route.ts  # tRPC endpoint
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── providers.tsx       # Client-side providers
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── [feature]/          # Feature-specific components
├── lib/
│   ├── db/
│   │   ├── connection.ts   # MongoDB connection
│   │   └── models/         # Mongoose models
│   │       └── index.ts    # Barrel exports
│   ├── trpc/
│   │   └── client.ts       # tRPC React client
│   └── utils.ts            # Utility functions (cn, etc.)
└── server/
    ├── services/           # Business logic
    └── trpc/
        ├── context.ts      # tRPC context
        ├── trpc.ts         # tRPC setup + procedures
        ├── root.ts         # Root router
        └── procedures/     # Feature routers
            └── index.ts    # Barrel exports
\`\`\``

const CODE_PATTERNS = `## Core Code Patterns

### Path Aliases
- \`@/\` maps to \`src/\` (configured in tsconfig.json)

### tRPC v10 Setup
\`\`\`typescript
// src/server/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(/* auth middleware */)
\`\`\`

### tRPC Client (CRITICAL)
\`\`\`typescript
// src/lib/trpc/client.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/trpc/root'

export const trpc = createTRPCReact<AppRouter>()

// Provider must create transformer at createClient level, NOT in httpBatchLink
export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson, // <-- HERE, not in links
      links: [httpBatchLink({ url: '/api/trpc' })],
    })
  )
  // ...
}
\`\`\``

const COMPONENT_PATTERNS = `## React Component Patterns

### Client Components
\`\`\`typescript
'use client'

import { trpc } from '@/lib/trpc/client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'

export function FeatureList() {
  const utils = trpc.useUtils()
  const { toast } = useToast()

  const { data, isLoading } = trpc.feature.list.useQuery()

  const createMutation = trpc.feature.create.useMutation({
    onSuccess: () => {
      utils.feature.list.invalidate()
      toast({ title: 'Created successfully' })
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  if (isLoading) return <LoadingSkeleton />

  return (/* ... */)
}
\`\`\`

### Server Components (Default in App Router)
\`\`\`typescript
// No 'use client' directive = server component
import { connectDB } from '@/lib/db/connection'
import { Feature } from '@/lib/db/models'

export default async function FeaturePage() {
  await connectDB()
  const features = await Feature.find().lean()
  return <FeatureList initialData={features} />
}
\`\`\``

const MODEL_PATTERNS = `## Mongoose Model Patterns

### Model Definition
\`\`\`typescript
// src/lib/db/models/feature.ts
import mongoose, { Schema, Document } from 'mongoose'

export interface IFeature extends Document {
  name: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

const FeatureSchema = new Schema<IFeature>(
  {
    name: { type: String, required: true },
    userId: { type: String, required: true, index: true },
  },
  { timestamps: true }
)

// Check if model exists (hot reload safety)
export const Feature = mongoose.models.Feature ||
  mongoose.model<IFeature>('Feature', FeatureSchema)
\`\`\`

### Barrel Export (CRITICAL)
\`\`\`typescript
// src/lib/db/models/index.ts
export { Feature, type IFeature } from './feature'
export { User, type IUser } from './user'
// Export ALL models here
\`\`\`

### Connection
\`\`\`typescript
// src/lib/db/connection.ts
let cached = global.mongoose
if (!cached) cached = global.mongoose = { conn: null, promise: null }

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI!)
  }
  cached.conn = await cached.promise
  return cached.conn
}
\`\`\``

const SERVICE_PATTERNS = `## Service Layer Patterns

### Service Function
\`\`\`typescript
// src/server/services/feature.ts
import { connectDB } from '@/lib/db/connection'
import { Feature, type IFeature } from '@/lib/db/models'

export async function createFeature(
  userId: string,
  data: { name: string }
): Promise<IFeature> {
  await connectDB()

  const feature = await Feature.create({
    ...data,
    userId,
  })

  return feature.toObject()  // <-- Always .toObject() for serialization
}

export async function listFeatures(userId: string): Promise<IFeature[]> {
  await connectDB()
  return Feature.find({ userId }).lean()  // <-- .lean() for read-only
}
\`\`\``

const ROUTE_PATTERNS = `## tRPC Router Patterns

### Procedure Definition
\`\`\`typescript
// src/server/trpc/procedures/feature.ts
import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import * as featureService from '@/server/services/feature'

export const featureRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return featureService.listFeatures(ctx.userId)
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      return featureService.createFeature(ctx.userId, input)
    }),
})
\`\`\`

### Root Router (CRITICAL)
\`\`\`typescript
// src/server/trpc/root.ts
import { createTRPCRouter } from './trpc'
import { featureRouter } from './procedures/feature'
import { userRouter } from './procedures/user'

export const appRouter = createTRPCRouter({
  feature: featureRouter,
  user: userRouter,
})

export type AppRouter = typeof appRouter
\`\`\``

const AUTH_PATTERNS = `## Authentication Patterns (Clerk)

### Context with Auth
\`\`\`typescript
// src/server/trpc/context.ts
import { auth } from '@clerk/nextjs/server'

export async function createContext() {
  const { userId, orgId } = auth()
  return { userId, orgId }
}

export type Context = Awaited<ReturnType<typeof createContext>>
\`\`\`

### Protected Procedure
\`\`\`typescript
export const protectedProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({ ctx: { ...ctx, userId: ctx.userId } })
  })
)
\`\`\``

const VALIDATION_CHECKLIST = `## PRE-SUBMIT CHECKLIST (CRITICAL)

Before finalizing any file, verify:

1. **Imports resolve**
   - [ ] All \`@/\` paths map to \`src/\`
   - [ ] Imported names exist in target file exports
   - [ ] No circular imports

2. **Exports match usage**
   - [ ] Barrel files (index.ts) export ALL sibling modules
   - [ ] Named exports match what other files import
   - [ ] \`export type { }\` for interface re-exports

3. **tRPC correctness**
   - [ ] transformer at createClient level, NOT httpBatchLink
   - [ ] AppRouter imported from root.ts, NOT procedures
   - [ ] All routers registered in root.ts

4. **Mongoose safety**
   - [ ] Models check for existing model before creating
   - [ ] Use \`.toObject()\` when returning from mutations
   - [ ] Use \`.lean()\` for read-only queries
   - [ ] \`await connectDB()\` before all operations

5. **React patterns**
   - [ ] Client components have \`'use client'\` directive
   - [ ] Providers in separate client component, not layout
   - [ ] QueryClient created with useState to prevent re-creation

6. **No duplicates**
   - [ ] No both .ts and .tsx of same file
   - [ ] No duplicate export names in barrels`

// =============================================================================
// Generation Pipeline Prompts
// =============================================================================

const PRD_GENERATION = `## PRD Generation for Next.js + MongoDB

You are generating a Product Requirements Document for a Next.js 14+ application with MongoDB.

### Tech Stack Context
- **Frontend**: Next.js 14+ App Router, React 18+, TypeScript
- **Backend**: tRPC v10 for type-safe APIs
- **Database**: MongoDB with Mongoose ODM
- **Auth**: Clerk (unless specified otherwise)
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: React Query (via tRPC)

### PRD Structure
Generate a comprehensive PRD with these sections:
1. **Overview**: Brief description of the application
2. **Goals**: Key objectives the application should achieve
3. **User Personas**: Target users and their needs
4. **Functional Requirements**: Core features and behaviors
5. **Non-Functional Requirements**: Performance, security, scalability
6. **Data Models**: Entities, relationships, key fields
7. **API Endpoints**: tRPC procedures (queries/mutations)
8. **UI Requirements**: Pages, components, user flows
9. **Authentication**: Auth requirements (Clerk integration)
10. **Success Metrics**: How to measure success

### Guidelines
- Be specific about data relationships (one-to-many, many-to-many)
- Include validation rules for user inputs
- Consider edge cases and error states
- Specify real-time features if needed (subscriptions)
- Include mobile responsiveness requirements`

const BLUEPRINT_GENERATION = `## Blueprint Generation for Next.js + MongoDB

You are generating a technical blueprint from a PRD for a Next.js 14+ application.

### Architecture Patterns
- **App Router**: All pages in src/app/ directory
- **Server Components**: Default, use 'use client' only when needed
- **API Layer**: tRPC procedures in src/server/trpc/procedures/
- **Services**: Business logic in src/server/services/
- **Models**: Mongoose schemas in src/lib/db/models/

### Blueprint Structure

#### Models (Mongoose Schemas)
\`\`\`typescript
{
  name: "User",
  fields: [
    { name: "email", type: "String", required: true, unique: true },
    { name: "name", type: "String", required: true },
    { name: "orgId", type: "String", required: true, index: true }
  ],
  relationships: ["has many Posts", "has many Comments"]
}
\`\`\`

#### Services (Business Logic)
\`\`\`typescript
{
  name: "user",
  methods: [
    { name: "create", description: "Create new user", inputs: ["email", "name"], outputs: "IUser" },
    { name: "list", description: "List users for org", inputs: ["orgId"], outputs: "IUser[]" }
  ]
}
\`\`\`

#### Routes (tRPC Procedures)
\`\`\`typescript
{
  name: "user",
  endpoints: [
    { method: "query", path: "list", description: "List all users" },
    { method: "mutation", path: "create", description: "Create user" }
  ]
}
\`\`\`

#### Components (React)
\`\`\`typescript
{
  name: "UserList",
  type: "component",
  description: "Displays list of users with pagination",
  props: ["initialData?"]
}
\`\`\`

### File Structure
\`\`\`
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   └── [feature]/page.tsx
│   ├── api/trpc/[trpc]/route.ts
│   ├── layout.tsx
│   └── providers.tsx
├── components/
│   ├── ui/           # shadcn/ui
│   └── [feature]/    # feature components
├── lib/
│   ├── db/
│   │   ├── connection.ts
│   │   └── models/
│   └── trpc/client.ts
└── server/
    ├── services/
    └── trpc/
        ├── procedures/
        ├── root.ts
        └── trpc.ts
\`\`\``

const WORK_ORDER_GENERATION = `## Work Order Generation for Next.js + MongoDB

Generate work order METADATA only (title, description, file paths). DO NOT generate file content — code is generated later during execution.

### Work Order Phases (in order)
1. **models**: Mongoose schemas and model files
2. **services**: Business logic functions
3. **procedures**: tRPC routers and procedures
4. **components**: React components (UI + feature)
5. **pages**: Next.js pages and layouts
6. **integration**: Wiring, barrel exports, final touches

### Work Order Structure (METADATA ONLY — no content field)
\`\`\`json
{
  "title": "Create User model",
  "description": "Mongoose schema for User with fields: email (String, required, unique), name (String, required), orgId (String, required, indexed). Include timestamps. Export IUser interface and User model.",
  "phase": "models",
  "files": [
    {
      "path": "src/lib/db/models/user.ts",
      "action": "create",
      "description": "User model with IUser interface, UserSchema, indexes on email and orgId"
    }
  ]
}
\`\`\`

### Description Guidelines
- For models: list all fields with types, required/unique/index flags
- For services: list all method names with brief input/output descriptions
- For procedures: list all query/mutation endpoint names
- For components: describe props and key behavior
- For pages: describe what the page displays and its route`

const AGENT_EXECUTION = `## Agent Code Generation for Next.js + MongoDB

You are generating production-ready code files for a Next.js application.

### TypeScript Requirements
- EVERY function parameter MUST have explicit types
- EVERY callback MUST have typed parameters: \`.map((item: Type) => ...)\`
- Define interfaces for all data shapes
- Use strict null checks

### Import Patterns
\`\`\`typescript
// Models
import { User, type IUser } from '@/lib/db/models'

// Services
import { connectDB } from '@/lib/db/connection'

// tRPC
import { createTRPCRouter, orgProcedure } from '../trpc'

// Components
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
\`\`\`

### Mongoose Model Template
\`\`\`typescript
import mongoose, { Schema, Document } from 'mongoose'

export interface IExample extends Document {
  name: string
  orgId: string
  createdAt: Date
  updatedAt: Date
}

const ExampleSchema = new Schema<IExample>(
  {
    name: { type: String, required: true },
    orgId: { type: String, required: true, index: true },
  },
  { timestamps: true }
)

export const Example = mongoose.models.Example ||
  mongoose.model<IExample>('Example', ExampleSchema)
\`\`\`

### Service Template
\`\`\`typescript
import { connectDB } from '@/lib/db/connection'
import { Example, type IExample } from '@/lib/db/models'

export async function createExample(
  orgId: string,
  data: { name: string }
): Promise<IExample> {
  await connectDB()
  const doc = await Example.create({ ...data, orgId })
  return doc.toObject()
}

export async function listExamples(orgId: string): Promise<IExample[]> {
  await connectDB()
  return Example.find({ orgId }).lean()
}
\`\`\`

### tRPC Procedure Template
\`\`\`typescript
import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import * as exampleService from '@/server/services/example'

export const exampleRouter = createTRPCRouter({
  list: orgProcedure.query(async ({ ctx }) => {
    return exampleService.listExamples(ctx.orgId)
  }),

  create: orgProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return exampleService.createExample(ctx.orgId, input)
    }),
})
\`\`\`

### React Component Template
\`\`\`typescript
'use client'

import { trpc } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

export function ExampleList() {
  const utils = trpc.useUtils()
  const { toast } = useToast()

  const { data, isLoading } = trpc.example.list.useQuery()

  const createMutation = trpc.example.create.useMutation({
    onSuccess: () => {
      utils.example.list.invalidate()
      toast({ title: 'Created!' })
    },
    onError: (err: { message: string }) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  if (isLoading) return <div>Loading...</div>

  return (/* JSX */)
}
\`\`\``

// =============================================================================
// Assembly Pipeline Prompts
// =============================================================================

const SCAFFOLD_PATTERNS = `## Next.js + MongoDB Scaffold Files

Required configuration files:
- **package.json**: Include all dependencies (next, react, mongoose, @trpc/*, superjson, @tanstack/react-query, tailwindcss, etc.)
- **tsconfig.json**: With \`@/*\` path alias pointing to \`src/*\`
- **next.config.js**: Standard Next.js config
- **tailwind.config.js**: With shadcn/ui CSS variable colors
- **.env.example**: MONGODB_URI, CLERK keys, etc.
- **Dockerfile**: Multi-stage build for production
- **docker-compose.yml**: App + MongoDB services

Framework detection:
- If existing files under src/app/ → Next.js APP ROUTER (no src/pages/)
- If existing files import from src/server/trpc/ → use that path
- If existing files import from src/lib/trpc/ → use that path`

const MISSING_FILES_PATTERNS = `## Next.js + MongoDB Missing File Generation

CRITICAL FILES TO GENERATE:

1. **src/lib/utils.ts** (cn helper)
\`\`\`typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
\`\`\`

2. **src/lib/db/connection.ts** (MongoDB connection)
\`\`\`typescript
import mongoose from 'mongoose'

declare global {
  // eslint-disable-next-line no-var
  var mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
}

let cached = global.mongoose
if (!cached) cached = global.mongoose = { conn: null, promise: null }

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI!)
  }
  cached.conn = await cached.promise
  return cached.conn
}

export { connectDB as connectToDatabase }
\`\`\`

3. **src/server/trpc/trpc.ts** (tRPC setup)
- MUST export: createTRPCRouter, publicProcedure, protectedProcedure
- Use superjson transformer
- Context with userId and orgId

4. **src/app/api/trpc/[trpc]/route.ts** (API handler)
- Without this file, ALL tRPC calls will 404!

5. **src/app/providers.tsx** (Client component with providers)
- ThemeProvider from next-themes
- TRPCReactProvider with QueryClient

6. **Barrel files (index.ts)** for:
- src/lib/db/models/index.ts
- src/server/trpc/procedures/index.ts
- src/server/services/index.ts`

const VALIDATION_FIX_PATTERNS = `## Validation Fix Patterns

### Export Mismatch Fixes
When file X imports { foo } from './bar' but bar.ts doesn't export foo:
1. Check if bar.ts uses export default — if so, add: export { foo }
2. Check sibling files for foo definition
3. Generate the missing function based on how it's called in X

### Barrel File Fixes
When models/index.ts is incomplete:
1. Look at all .ts files in models/ directory
2. Add: export { Model, type IModel } from './model' for each
3. Use export type for interfaces

### TypeScript Interface Re-exports
CORRECT: export { Model, type IModel } from './model'
WRONG: export { IModel } from './model' — interfaces are type-only!

### Mongoose Serialization Fixes
Error: Unable to transform response
Fix: Change return doc to return doc.toObject() or add .lean() to query`

const WIRING_PATTERNS = `## Wiring Generation Patterns

### Barrel Files (index.ts)
For each directory with 3+ modules:
\`\`\`typescript
// src/lib/db/models/index.ts
export { Clip, type IClip } from './clip'
export { Board, type IBoard } from './board'
export { Tag, type ITag } from './tag'
\`\`\`

### tRPC Root Router
Router keys MUST be SINGULAR:
\`\`\`typescript
// src/server/trpc/root.ts
import { createTRPCRouter } from './trpc'
import { clipRouter } from './procedures/clip'
import { boardRouter } from './procedures/board'

export const appRouter = createTRPCRouter({
  clip: clipRouter,    // SINGULAR!
  board: boardRouter,  // SINGULAR!
})

export type AppRouter = typeof appRouter
\`\`\`

### File Naming Preference
- Services/Routers/Models: SINGULAR (clip.ts, not clips.ts)
- Components: kebab-case (clip-form.tsx, not ClipForm.tsx)
- If both exist, only export from singular`
