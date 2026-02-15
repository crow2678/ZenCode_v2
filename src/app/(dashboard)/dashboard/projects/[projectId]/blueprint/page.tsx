'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, ArrowRight, Loader2, Boxes, CheckCircle2, Sparkles, Database, Server, Layout, Zap, Layers, History } from 'lucide-react'

type BlueprintMode = 'lean' | 'detailed'

export default function BlueprintPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [isGenerating, setIsGenerating] = useState(false)
  const [mode, setMode] = useState<BlueprintMode>('lean')

  const { data: project } = trpc.project.get.useQuery({ id: projectId })
  const { data: requirement } = trpc.requirement.get.useQuery({ projectId })
  const { data: blueprint, isLoading } = trpc.blueprint.get.useQuery({ projectId })

  const generateMutation = trpc.blueprint.generate.useMutation({
    onSuccess: () => {
      utils.blueprint.get.invalidate({ projectId })
      toast({ title: 'Blueprint generated!' })
      setIsGenerating(false)
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setIsGenerating(false)
    },
  })

  const approveMutation = trpc.blueprint.approve.useMutation({
    onSuccess: () => {
      utils.blueprint.get.invalidate({ projectId })
      toast({ title: 'Blueprint approved!' })
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  const handleGenerate = async () => {
    if (!requirement || requirement.status !== 'approved') {
      toast({ title: 'Please approve the PRD first', variant: 'destructive' })
      return
    }

    setIsGenerating(true)

    generateMutation.mutate({
      projectId,
      requirementId: requirement.id,
      stackId: 'nextjs-mongodb',
      mode,
    })
  }

  const handleApprove = () => {
    approveMutation.mutate({ projectId })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Check if PRD is approved
  if (!requirement || requirement.status !== 'approved') {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Blueprint</h1>
            <p className="text-muted-foreground">Technical architecture design</p>
          </div>
        </div>

        <Card className="p-8 text-center">
          <Boxes className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">PRD Required</h3>
          <p className="text-muted-foreground mt-2">
            Please create and approve a PRD before generating a blueprint.
          </p>
          <Link href={`/dashboard/projects/${projectId}/prd`}>
            <Button className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to PRD
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Blueprint</h1>
            <p className="text-muted-foreground">Technical architecture design</p>
          </div>
        </div>
        {blueprint?.status === 'approved' && (
          <Link href={`/dashboard/projects/${projectId}/work-orders`}>
            <Button>
              Next: Work Orders
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {blueprint ? (
        <div className="space-y-6">
          {/* Status & Name */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                      {blueprint.name || `Blueprint v${blueprint.version}`}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">({blueprint.stackId})</span>
                  </div>
                  {blueprint.description && (
                    <CardDescription className="mt-1">{blueprint.description}</CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/projects/${projectId}/blueprint/versions`}>
                    <Button variant="outline" size="sm">
                      <History className="mr-2 h-4 w-4" />
                      Version History
                    </Button>
                  </Link>
                  {blueprint.status === 'approved' ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      Approved
                    </span>
                  ) : (
                    <Button onClick={handleApprove} disabled={approveMutation.isLoading}>
                      {approveMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Approve Blueprint
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {blueprint.estimatedWorkOrders && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  Estimated work orders: <strong>{blueprint.estimatedWorkOrders}</strong>
                </p>
              </CardContent>
            )}
          </Card>

          {/* Architecture Overview */}
          {blueprint.architecture?.overview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Architecture Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{blueprint.architecture.overview}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Components */}
          {blueprint.architecture?.components && blueprint.architecture.components.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Components ({blueprint.architecture.components.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {blueprint.architecture.components.map((component: { id?: string; name: string; type: string; description: string; techStack?: string[]; dependencies?: string[] }, i: number) => (
                    <div key={component.id || i} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{component.name}</h4>
                        <span className="text-xs bg-muted px-2 py-1 rounded">{component.type}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{component.description}</p>
                      {component.techStack && component.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {component.techStack.map((tech: string, j: number) => (
                            <span key={j} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                      {component.dependencies && component.dependencies.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Depends on: {component.dependencies.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Flow */}
          {blueprint.architecture?.dataFlow && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Flow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{blueprint.architecture.dataFlow}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Considerations */}
          {blueprint.architecture?.securityConsiderations && blueprint.architecture.securityConsiderations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Security Considerations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {blueprint.architecture.securityConsiderations.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Detailed: Models */}
          {blueprint.models && blueprint.models.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Models ({blueprint.models.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {blueprint.models.map((model: { name: string; description?: string; fields: Array<{ name: string; type: string; required?: boolean }>; relationships?: string[] }, i: number) => (
                    <div key={i} className="border rounded-lg p-4">
                      <h4 className="font-medium">{model.name}</h4>
                      {model.description && <p className="text-sm text-muted-foreground mt-1">{model.description}</p>}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        {model.fields.map((field, j: number) => (
                          <div key={j} className="flex items-center gap-2">
                            <code className="bg-muted px-1 rounded">{field.name}</code>
                            <span className="text-muted-foreground">{field.type}</span>
                            {field.required && <span className="text-red-500">*</span>}
                          </div>
                        ))}
                      </div>
                      {model.relationships && model.relationships.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Relationships: {model.relationships.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed: Services */}
          {blueprint.services && blueprint.services.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Services ({blueprint.services.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {blueprint.services.map((service: { name: string; description?: string; methods: Array<{ name: string; description: string; inputs?: string[]; outputs?: string }> }, i: number) => (
                    <div key={i} className="border rounded-lg p-4">
                      <h4 className="font-medium">{service.name}</h4>
                      {service.description && <p className="text-sm text-muted-foreground mt-1">{service.description}</p>}
                      <ul className="mt-2 space-y-1 text-sm">
                        {service.methods.map((method, j: number) => (
                          <li key={j} className="flex items-center gap-2">
                            <code className="bg-muted px-1 rounded">{method.name}()</code>
                            <span className="text-muted-foreground">{method.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed: Routes */}
          {blueprint.routes && blueprint.routes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>tRPC Routes ({blueprint.routes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {blueprint.routes.map((route: { name: string; description?: string; endpoints: Array<{ method: string; name: string; description: string }> }, i: number) => (
                    <div key={i} className="border rounded-lg p-4">
                      <h4 className="font-medium">{route.name}</h4>
                      <div className="mt-2 space-y-1 text-sm">
                        {route.endpoints.map((endpoint, j: number) => (
                          <div key={j} className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              endpoint.method === 'query' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            }`}>
                              {endpoint.method}
                            </span>
                            <code className="bg-muted px-1 rounded">{endpoint.name}</code>
                            <span className="text-muted-foreground">{endpoint.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed: UI Components */}
          {blueprint.components && blueprint.components.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>UI Components ({blueprint.components.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {blueprint.components.map((comp: { name: string; type: string; description: string; props?: string[] }, i: number) => (
                    <div key={i} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{comp.name}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{comp.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{comp.description}</p>
                      {comp.props && comp.props.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Props: {comp.props.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed: File Structure */}
          {blueprint.fileStructure && blueprint.fileStructure.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>File Structure ({blueprint.fileStructure.length} files)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {blueprint.fileStructure.join('\n')}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Regenerate */}
          <div className="flex items-center gap-4">
            <Button onClick={handleGenerate} variant="outline" disabled={isGenerating}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-2 h-4 w-4" />
              Regenerate Blueprint
            </Button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('lean')}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  mode === 'lean' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <Zap className="h-3 w-3 inline mr-1" />
                Lean
              </button>
              <button
                onClick={() => setMode('detailed')}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  mode === 'detailed' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <Layers className="h-3 w-3 inline mr-1" />
                Detailed
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Generate new Blueprint */
        <div className="space-y-6">
          <Card className="p-8 text-center">
            <Boxes className="mx-auto h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold">Generate Blueprint</h3>
            <p className="text-muted-foreground mt-2 mb-6">
              Create a technical architecture based on your PRD.
            </p>

            {/* Mode Selector */}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setMode('lean')}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all w-48 ${
                  mode === 'lean'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <Zap className={`h-8 w-8 mb-2 ${mode === 'lean' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-medium">Lean</span>
                <span className="text-xs text-muted-foreground mt-1">~5K tokens • 10-20s</span>
                <span className="text-xs text-muted-foreground">High-level architecture</span>
              </button>
              <button
                onClick={() => setMode('detailed')}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all w-48 ${
                  mode === 'detailed'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <Layers className={`h-8 w-8 mb-2 ${mode === 'detailed' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-medium">Detailed</span>
                <span className="text-xs text-muted-foreground mt-1">~25K tokens • 40-80s</span>
                <span className="text-xs text-muted-foreground">Full model/service specs</span>
              </button>
            </div>

            <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-2 h-4 w-4" />
              Generate {mode === 'detailed' ? 'Detailed ' : ''}Blueprint
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
