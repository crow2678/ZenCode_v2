'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2, Building, ShoppingCart, PenSquare } from 'lucide-react'
import Link from 'next/link'

const TEMPLATE_OPTIONS = [
  {
    id: 'saas',
    name: 'SaaS Starter',
    description: 'User management, teams, subscriptions, settings',
    icon: Building,
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Products, cart, checkout, orders, admin',
    icon: ShoppingCart,
  },
  {
    id: 'blog-cms',
    name: 'Blog / CMS',
    description: 'Rich editor, categories, media, comments',
    icon: PenSquare,
  },
]

const STACK_OPTIONS = [
  {
    id: 'nextjs-mongodb',
    name: 'Next.js + MongoDB',
    icon: '⚡',
    description: 'Full-stack with tRPC, Mongoose, shadcn/ui',
    techStack: ['Next.js', 'MongoDB', 'tRPC', 'Tailwind CSS'],
  },
  {
    id: 'fastapi-postgres',
    name: 'FastAPI + PostgreSQL',
    icon: '🐍',
    description: 'Python backend with SQLAlchemy, Pydantic v2',
    techStack: ['FastAPI', 'PostgreSQL', 'SQLAlchemy', 'Pydantic'],
  },
]

export default function NewProjectPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedStack, setSelectedStack] = useState(STACK_OPTIONS[0].id)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (data) => {
      toast({ title: 'Project created!' })
      // If template selected, redirect to PRD with template pre-filled
      if (selectedTemplate) {
        router.push(`/dashboard/projects/${data.id}/prd?template=${selectedTemplate}`)
      } else {
        router.push(`/dashboard/projects/${data.id}`)
      }
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  const handleSelectTemplate = (templateId: string) => {
    if (selectedTemplate === templateId) {
      setSelectedTemplate(null)
      return
    }
    const prevTmpl = TEMPLATE_OPTIONS.find((t) => t.id === selectedTemplate)
    setSelectedTemplate(templateId)
    const tmpl = TEMPLATE_OPTIONS.find((t) => t.id === templateId)
    if (tmpl) {
      // Pre-fill if empty or still showing previous template's values
      if (!name || (prevTmpl && name === prevTmpl.name)) {
        setName(tmpl.name)
      }
      if (!description || (prevTmpl && description === prevTmpl.description)) {
        setDescription(tmpl.description)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const stack = STACK_OPTIONS.find((s) => s.id === selectedStack)
    createMutation.mutate({
      name,
      description,
      techStack: stack?.techStack,
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Project</h1>
          <p className="text-muted-foreground">Create a new ZenCode project</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Start from Template */}
        <Card>
          <CardHeader>
            <CardTitle>Start from Template</CardTitle>
            <CardDescription>Choose a template to pre-fill the PRD, or start blank</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {TEMPLATE_OPTIONS.map((tmpl) => {
                const Icon = tmpl.icon
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                      selectedTemplate === tmpl.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="font-medium">{tmpl.name}</span>
                    <p className="text-sm text-muted-foreground">{tmpl.description}</p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Basic information about your project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome App"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of what you want to build..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stack Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Tech Stack</CardTitle>
            <CardDescription>Choose the technology stack for your project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {STACK_OPTIONS.map((stack) => (
                <button
                  key={stack.id}
                  type="button"
                  onClick={() => setSelectedStack(stack.id)}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                    selectedStack === stack.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{stack.icon}</span>
                    <span className="font-medium">{stack.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{stack.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {stack.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link href="/dashboard/projects">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={!name || createMutation.isLoading}>
            {createMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Project
          </Button>
        </div>
      </form>
    </div>
  )
}
