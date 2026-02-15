'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Boxes, ListChecks, Package, ArrowRight, CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react'

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const { data: project, isLoading } = trpc.project.get.useQuery({ id: projectId })
  const { data: requirement } = trpc.requirement.get.useQuery({ projectId })
  const { data: blueprint } = trpc.blueprint.get.useQuery({ projectId })
  const { data: workOrders } = trpc.workOrder.list.useQuery({ projectId })
  const { data: assembly } = trpc.assembly.get.useQuery({ projectId })

  // Calculate pipeline status
  const prdStatus = requirement?.status === 'approved' ? 'complete' : requirement ? 'in-progress' : 'pending'
  const blueprintStatus = blueprint?.status === 'approved' ? 'complete' : blueprint ? 'in-progress' : 'pending'

  const workOrdersTotal = workOrders?.length ?? 0
  const workOrdersCompleted = workOrders?.filter(wo => wo.status === 'completed').length ?? 0
  // Consider complete if all done, or "ready" if >80% done (can proceed to assembly)
  const workOrdersStatus = workOrdersTotal === 0 ? 'pending' :
    workOrdersCompleted === workOrdersTotal ? 'complete' :
    workOrdersCompleted >= workOrdersTotal * 0.8 ? 'ready' :
    workOrdersCompleted > 0 ? 'in-progress' : 'pending'

  const assemblyStatus = assembly?.status === 'completed' ? 'complete' :
    assembly?.status === 'in-progress' ? 'in-progress' : 'pending'

  const pipelineSteps = [
    {
      id: 'prd',
      name: 'PRD',
      description: 'Product Requirements Document',
      icon: FileText,
      href: '/prd',
      status: prdStatus,
      detail: requirement?.status === 'approved' ? 'Approved' : requirement ? 'Draft' : null,
    },
    {
      id: 'blueprint',
      name: 'Blueprint',
      description: 'Technical architecture & design',
      icon: Boxes,
      href: '/blueprint',
      status: blueprintStatus,
      detail: blueprint?.status === 'approved' ? 'Approved' : blueprint ? 'Draft' : null,
    },
    {
      id: 'work-orders',
      name: 'Work Orders',
      description: 'Code generation tasks',
      icon: ListChecks,
      href: '/work-orders',
      status: workOrdersStatus,
      detail: workOrdersTotal > 0 ? `${workOrdersCompleted}/${workOrdersTotal} executed` : null,
    },
    {
      id: 'assembly',
      name: 'Assembly',
      description: 'Build & validate output',
      icon: Package,
      href: '/assembly',
      status: assemblyStatus,
      detail: assembly ? (assembly.status === 'completed' ? 'Complete' : 'In Progress') : null,
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-48 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Project not found</h2>
        <Link href="/dashboard/projects">
          <Button className="mt-4">Back to Projects</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground mt-1">
          {project.description || 'No description'}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {project.techStack?.map((tech) => (
            <span
              key={tech}
              className="rounded-full bg-secondary px-3 py-1 text-sm"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline Steps */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Pipeline</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pipelineSteps.map((step) => {
            const isComplete = step.status === 'complete'
            const isReady = step.status === 'ready'  // >80% complete, can proceed
            const isInProgress = step.status === 'in-progress'

            return (
              <Link
                key={step.id}
                href={`/dashboard/projects/${projectId}${step.href}`}
              >
                <Card
                  className={`h-full transition-colors hover:border-primary ${
                    isComplete ? 'border-green-500/50' :
                    isReady ? 'border-green-500/30' :
                    isInProgress ? 'border-primary' : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <step.icon className={`h-8 w-8 ${isComplete || isReady ? 'text-green-500' : 'text-primary'}`} />
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : isReady ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500/70" />
                      ) : isInProgress ? (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <CardTitle className="text-lg">{step.name}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {step.detail && (
                        <p className="text-sm text-muted-foreground">{step.detail}</p>
                      )}
                      <Button variant="ghost" className="w-full justify-between">
                        {isComplete ? 'View' : isReady ? 'Continue' : isInProgress ? 'Continue' : 'Start'}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Project Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="capitalize">{project.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(project.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/dashboard/projects/${projectId}/prd`}>
              <Button className="w-full" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Generate PRD
              </Button>
            </Link>
            <Link href={`/dashboard/projects/${projectId}/assembly`}>
              <Button className="w-full" variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Run Assembly
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
