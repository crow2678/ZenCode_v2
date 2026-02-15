/**
 * ZenCode V2 - Next.js + MongoDB Scaffold Templates
 *
 * Template files for scaffolding new Next.js + MongoDB projects
 */

/**
 * Get all scaffold templates as a Map
 */
export function getScaffoldTemplates(): Map<string, string> {
  const templates = new Map<string, string>()

  templates.set('package.json', PACKAGE_JSON)
  templates.set('tsconfig.json', TSCONFIG_JSON)
  templates.set('next.config.js', NEXT_CONFIG)
  templates.set('tailwind.config.js', TAILWIND_CONFIG)
  templates.set('postcss.config.js', POSTCSS_CONFIG)
  templates.set('.env.local.example', ENV_LOCAL)
  templates.set('.gitignore', GITIGNORE)
  templates.set('src/app/globals.css', GLOBALS_CSS)
  templates.set('src/app/layout.tsx', LAYOUT_TSX)
  templates.set('src/app/page.tsx', HOME_PAGE)
  templates.set('src/app/providers.tsx', PROVIDERS)
  templates.set('src/lib/utils.ts', UTILS)
  templates.set('src/lib/db/connection.ts', DB_CONNECTION)
  templates.set('src/lib/trpc/client.ts', TRPC_CLIENT)
  templates.set('src/server/trpc/context.ts', TRPC_CONTEXT)
  templates.set('src/server/trpc/trpc.ts', TRPC_SETUP)
  templates.set('src/server/trpc/root.ts', TRPC_ROOT)
  templates.set('src/app/api/trpc/[trpc]/route.ts', TRPC_ROUTE)
  templates.set('.eslintrc.json', ESLINTRC)
  templates.set('.prettierrc', PRETTIERRC)

  return templates
}

/**
 * Get list of required files for a valid project
 */
export function getRequiredFiles(): string[] {
  return [
    'package.json',
    'tsconfig.json',
    'src/app/layout.tsx',
    'src/app/page.tsx',
    'src/app/providers.tsx',
    'src/lib/db/connection.ts',
    'src/lib/trpc/client.ts',
    'src/server/trpc/context.ts',
    'src/server/trpc/trpc.ts',
    'src/server/trpc/root.ts',
    'src/app/api/trpc/[trpc]/route.ts',
  ]
}

// =============================================================================
// Template Content
// =============================================================================

const PACKAGE_JSON = `{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@trpc/client": "^10.45.0",
    "@trpc/react-query": "^10.45.0",
    "@trpc/server": "^10.45.0",
    "@tanstack/react-query": "^4.36.1",
    "mongoose": "^8.0.0",
    "superjson": "^2.2.1",
    "zod": "^3.22.0",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}`

const TSCONFIG_JSON = `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{"name": "next"}],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`

const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
}

module.exports = nextConfig`

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {},
  },
  plugins: [],
}`

const POSTCSS_CONFIG = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`

const ENV_LOCAL = `# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/{{projectName}}

# Add auth keys if using Clerk/Auth0
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
# CLERK_SECRET_KEY=`

const GITIGNORE = `# Dependencies
node_modules/
.pnp
.pnp.js

# Next.js
.next/
out/

# Production
build/
dist/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local
.env*.local
.env

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# TypeScript
*.tsbuildinfo
next-env.d.ts`

const GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`

const LAYOUT_TSX = `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '{{projectName}}',
  description: 'Built with ZenCode',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}`

const HOME_PAGE = `export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to {{projectName}}</h1>
      <p className="mt-4 text-muted-foreground">
        Get started by editing <code className="font-mono">src/app/page.tsx</code>
      </p>
    </main>
  )
}`

const PROVIDERS = `'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { trpc } from '@/lib/trpc/client'
import superjson from 'superjson'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            retry: 1,
          },
        },
      })
  )

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}`

const UTILS = `import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`

const DB_CONNECTION = `import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable')
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

// Alias for compatibility
export const connectToDatabase = connectDB`

const TRPC_CLIENT = `import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/trpc/root'

export const trpc = createTRPCReact<AppRouter>()`

const TRPC_CONTEXT = `export async function createContext() {
  // Add auth here if needed
  // const { userId } = auth()
  return {
    userId: null as string | null,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>`

const TRPC_SETUP = `import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
      },
    })
  })
)`

const TRPC_ROOT = `import { createTRPCRouter } from './trpc'

export const appRouter = createTRPCRouter({
  // Add routers here:
  // feature: featureRouter,
})

export type AppRouter = typeof appRouter`

const TRPC_ROUTE = `import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/trpc/root'
import { createContext } from '@/server/trpc/context'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  })

export { handler as GET, handler as POST }`

// ============================================================================
// Lint/Format Config Templates
// ============================================================================

const ESLINTRC = `{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn"
  }
}`

const PRETTIERRC = `{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}`
