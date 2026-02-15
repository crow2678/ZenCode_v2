import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Layers, Zap, Package } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            Z
          </div>
          <span className="text-2xl font-bold">ZenCode</span>
          <span className="text-sm text-muted-foreground">v2</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Stack-Agnostic
            <br />
            <span className="text-primary">Code Generation</span>
          </h1>
          <p className="mt-6 text-xl text-muted-foreground">
            Generate production-ready applications from natural language.
            Choose your tech stack, describe your vision, and let AI build it for you.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Start Building
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid gap-8 md:grid-cols-3">
          <div className="text-center p-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Layers className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">Multi-Stack Support</h3>
            <p className="mt-2 text-muted-foreground">
              Choose from Next.js, FastAPI, and more. Each stack has optimized patterns and prompts.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">AI-Powered Pipeline</h3>
            <p className="mt-2 text-muted-foreground">
              PRD to Blueprint to Work Orders to Assembly. Each step is validated and refined.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">Production Ready</h3>
            <p className="mt-2 text-muted-foreground">
              Generated code is validated, type-checked, and follows best practices.
            </p>
          </div>
        </div>

        {/* Stacks Preview */}
        <div className="mt-32 text-center">
          <h2 className="text-3xl font-bold">Available Stacks</h2>
          <p className="mt-4 text-muted-foreground">
            Plugin architecture makes adding new stacks easy
          </p>
          <div className="mt-10 flex justify-center gap-6">
            <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
              <span className="text-3xl">⚡</span>
              <div className="text-left">
                <p className="font-semibold">Next.js + MongoDB</p>
                <p className="text-sm text-muted-foreground">Default stack</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
              <span className="text-3xl">🐍</span>
              <div className="text-left">
                <p className="font-semibold">FastAPI + PostgreSQL</p>
                <p className="text-sm text-muted-foreground">Python stack</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        <p>ZenCode V2 - Stack-Agnostic Assembly Engine</p>
      </footer>
    </div>
  )
}
