'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { useSSE } from '@/hooks/use-sse'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  ListChecks,
  CheckCircle2,
  Circle,
  Sparkles,
  FileCode,
  ChevronDown,
  ChevronRight,
  Play,
  AlertCircle,
  ShieldCheck,
  Download,
} from 'lucide-react'

export default function WorkOrdersPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // SSE for real-time execution updates (falls back to polling)
  const sseUrl = isExecuting ? `/api/stream/execution?projectId=${projectId}` : null
  const { lastMessage: sseMessage } = useSSE(sseUrl)

  const { data: blueprint } = trpc.blueprint.get.useQuery({ projectId })
  const { data: workOrders, isLoading } = trpc.workOrder.list.useQuery(
    { projectId },
    { refetchInterval: isExecuting ? (sseMessage ? 5000 : 3000) : false } // Slower polling with SSE
  )

  // Refetch on SSE completion/failure events
  useEffect(() => {
    if (sseMessage && (sseMessage.status === 'completed' || sseMessage.status === 'failed')) {
      utils.workOrder.list.refetch({ projectId })
    }
  }, [sseMessage, projectId, utils.workOrder.list])

  const generateMutation = trpc.workOrder.generate.useMutation({
    onSuccess: async (result) => {
      // Force refetch to get new work orders
      await utils.workOrder.list.refetch({ projectId })
      toast({ title: `${result.count} work orders generated!` })
      setIsGenerating(false)
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setIsGenerating(false)
    },
  })

  const executeAllMutation = trpc.workOrder.executeAll.useMutation({
    onSuccess: async (result) => {
      await utils.workOrder.list.refetch({ projectId })
      toast({
        title: `Execution complete!`,
        description: `${result.completed} completed, ${result.failed} failed`,
      })
      setIsExecuting(false)
      setSelectedIds(new Set())
    },
    onError: (err) => {
      toast({ title: 'Execution failed', description: err.message, variant: 'destructive' })
      setIsExecuting(false)
    },
  })

  const [includeCompleted, setIncludeCompleted] = useState(false)

  // Helper functions for selection
  // Include: pending, failed, executing (stuck), and optionally completed
  const executableWorkOrders = workOrders?.filter(wo =>
    wo.status === 'pending' ||
    wo.status === 'failed' ||
    wo.status === 'executing' ||  // Stuck work orders
    (includeCompleted && wo.status === 'completed')
  ) ?? []

  const selectedExecutable = executableWorkOrders.filter(wo => selectedIds.has(wo.id))

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === executableWorkOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(executableWorkOrders.map(wo => wo.id)))
    }
  }

  const handleGenerate = async () => {
    if (!blueprint || blueprint.status !== 'approved') {
      toast({ title: 'Please approve the blueprint first', variant: 'destructive' })
      return
    }

    setIsGenerating(true)
    console.log('[WorkOrders] Generating work orders for blueprint:', blueprint.id)

    generateMutation.mutate({
      projectId,
      blueprintId: blueprint.id,
      stackId: 'nextjs-mongodb',
    })
  }

  const handleExecuteSelected = () => {
    if (selectedIds.size === 0) {
      toast({ title: 'No work orders selected', variant: 'destructive' })
      return
    }
    setIsExecuting(true)
    const ids = Array.from(selectedIds)
    console.log('[WorkOrders] Executing selected work orders:', ids)
    executeAllMutation.mutate({ projectId, workOrderIds: ids, stackId: 'nextjs-mongodb' })
  }

  const handleExecuteAll = () => {
    setIsExecuting(true)
    console.log('[WorkOrders] Executing all work orders for project:', projectId)
    executeAllMutation.mutate({ projectId, stackId: 'nextjs-mongodb' })
  }

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      const result = await utils.workOrder.validate.fetch({ projectId })
      if (result.valid) {
        toast({
          title: 'Validation passed',
          description: `${result.fileCount} files, ${result.importCount} imports checked — no errors`,
        })
      } else {
        const errorCount = result.errors.filter((e: { severity: string }) => e.severity === 'error').length
        const warningCount = result.errors.filter((e: { severity: string }) => e.severity === 'warning').length
        toast({
          title: 'Validation issues found',
          description: `${errorCount} errors, ${warningCount} warnings across ${result.fileCount} files`,
          variant: errorCount > 0 ? 'destructive' : 'default',
        })
      }
    } catch (err) {
      toast({
        title: 'Validation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsValidating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Check if Blueprint is approved
  if (!blueprint || blueprint.status !== 'approved') {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Work Orders</h1>
            <p className="text-muted-foreground">Code generation tasks</p>
          </div>
        </div>

        <Card className="p-8 text-center">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Blueprint Required</h3>
          <p className="text-muted-foreground mt-2">
            Please create and approve a blueprint before generating work orders.
          </p>
          <Link href={`/dashboard/projects/${projectId}/blueprint`}>
            <Button className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Blueprint
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  const phases = ['models', 'services', 'procedures', 'components', 'pages', 'integration']

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
            <h1 className="text-2xl font-bold">Work Orders</h1>
            <p className="text-muted-foreground">Code generation tasks</p>
          </div>
        </div>
        {workOrders && workOrders.length > 0 && (() => {
          const completedCount = workOrders.filter(wo => wo.status === 'completed').length
          const allCompleted = completedCount === workOrders.length
          const mostCompleted = completedCount > 0 && completedCount >= workOrders.length * 0.5

          if (allCompleted) {
            return (
              <Link href={`/dashboard/projects/${projectId}/assembly`}>
                <Button>
                  Next: Assembly
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )
          } else if (mostCompleted) {
            return (
              <Link href={`/dashboard/projects/${projectId}/assembly`}>
                <Button variant="outline">
                  Assembly ({completedCount}/{workOrders.length} ready)
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )
          }
          return null
        })()}
      </div>

      {workOrders && workOrders.length > 0 ? (
        <div className="space-y-6">
          {/* Summary */}
          {(() => {
            const pendingCount = workOrders.filter(wo => wo.status === 'pending').length
            const failedCount = workOrders.filter(wo => wo.status === 'failed').length
            const completedCount = workOrders.filter(wo => wo.status === 'completed').length
            const allCompleted = completedCount === workOrders.length

            return (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{workOrders.length} Work Orders</CardTitle>
                      <span className="text-sm text-muted-foreground">
                        ({completedCount} executed
                        {pendingCount > 0 && `, ${pendingCount} pending`}
                        {failedCount > 0 && `, ${failedCount} failed`})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {completedCount > 0 && (
                        <>
                          <Button onClick={handleValidate} variant="outline" disabled={isValidating || isExecuting}>
                            {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                            Validate
                          </Button>
                          <a href={`/api/download/work-orders?projectId=${projectId}`} download>
                            <Button variant="outline">
                              <Download className="mr-2 h-4 w-4" />
                              Download All
                            </Button>
                          </a>
                        </>
                      )}
                      <Button onClick={handleGenerate} variant="outline" disabled={isGenerating || isExecuting}>
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Sparkles className="mr-2 h-4 w-4" />
                        Regenerate
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {/* Selection controls */}
                <CardContent className="pt-0 border-t">
                  <div className="flex items-center justify-between pt-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all"
                          checked={selectedIds.size === executableWorkOrders.length && executableWorkOrders.length > 0}
                          onCheckedChange={toggleSelectAll}
                          disabled={isExecuting || executableWorkOrders.length === 0}
                        />
                        <label htmlFor="select-all" className="text-sm cursor-pointer">
                          Select all ({executableWorkOrders.length})
                        </label>
                      </div>
                      <div className="flex items-center gap-2 border-l pl-4">
                        <Checkbox
                          id="include-completed"
                          checked={includeCompleted}
                          onCheckedChange={(checked) => {
                            setIncludeCompleted(!!checked)
                            setSelectedIds(new Set()) // Clear selection when toggling
                          }}
                          disabled={isExecuting}
                        />
                        <label htmlFor="include-completed" className="text-sm cursor-pointer text-muted-foreground">
                          Include completed (re-run)
                        </label>
                      </div>
                      {selectedIds.size > 0 && (
                        <span className="text-sm text-primary font-medium">
                          {selectedIds.size} selected
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={handleExecuteSelected}
                      disabled={isExecuting || isGenerating || selectedIds.size === 0}
                      size="sm"
                    >
                      {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Play className="mr-2 h-4 w-4" />
                      Execute ({selectedIds.size})
                    </Button>
                  </div>
                </CardContent>
                {isExecuting && (
                  <CardContent className="pt-0">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating code for {selectedIds.size || executableWorkOrders.length} work orders...
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })()}

          {/* Work Order List */}
          <div className="space-y-3">
            {workOrders.map((wo) => {
              const isExecutable =
                wo.status === 'pending' ||
                wo.status === 'failed' ||
                wo.status === 'executing' ||
                (includeCompleted && wo.status === 'completed')
              const isSelected = selectedIds.has(wo.id)

              return (
                <Card key={wo.id} className={`overflow-hidden ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                  <div className="flex items-center">
                    {/* Checkbox */}
                    {isExecutable && (
                      <div className="pl-4 pr-2 py-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(wo.id)}
                          disabled={isExecuting}
                        />
                      </div>
                    )}
                    {/* Work order content */}
                    <button
                      onClick={() => setExpandedId(expandedId === wo.id ? null : wo.id)}
                      className={`flex-1 p-4 ${!isExecutable ? 'pl-4' : 'pl-2'} flex items-center justify-between text-left hover:bg-muted/50 transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        {wo.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : wo.status === 'failed' ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : wo.status === 'executing' ? (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{wo.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {wo.phase} • {wo.filesCount} files
                            {wo.status === 'failed' && <span className="text-red-500 ml-2">• Failed</span>}
                            {wo.status === 'executing' && <span className="text-yellow-500 ml-2">• Stuck</span>}
                          </p>
                        </div>
                      </div>
                      {expandedId === wo.id ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  {expandedId === wo.id && (
                    <CardContent className="border-t bg-muted/30 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-muted-foreground">{wo.description}</p>
                        {wo.status === 'completed' && (
                          <a href={`/api/download/work-orders?projectId=${projectId}&workOrderId=${wo.id}`} download>
                            <Button variant="ghost" size="sm">
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                          </a>
                        )}
                      </div>
                      <WorkOrderFiles workOrderId={wo.id} />
                      {wo.executionLogs && wo.executionLogs.length > 0 && (
                        <ExecutionLogs logs={wo.executionLogs} />
                      )}
                      {wo.error && (
                        <div className="mt-3 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-600 dark:text-red-400">
                          {wo.error}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        /* Generate work orders */
        <Card className="p-8 text-center">
          <ListChecks className="mx-auto h-12 w-12 text-primary mb-4" />
          <h3 className="text-lg font-semibold">Generate Work Orders</h3>
          <p className="text-muted-foreground mt-2 mb-6">
            Create code generation tasks based on your blueprint.
          </p>
          <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Work Orders
          </Button>
        </Card>
      )}
    </div>
  )
}

function WorkOrderFiles({ workOrderId }: { workOrderId: string }) {
  const { data: workOrder, isLoading } = trpc.workOrder.get.useQuery({ id: workOrderId })

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />
  }

  if (!workOrder) {
    return null
  }

  return (
    <div className="space-y-2">
      {workOrder.files.map((file: { path: string; action: string }, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <code className="bg-background px-2 py-0.5 rounded">{file.path}</code>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            file.action === 'create' ? 'bg-green-100 text-green-700' :
            file.action === 'modify' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {file.action}
          </span>
        </div>
      ))}
    </div>
  )
}

function ExecutionLogs({ logs }: { logs: Array<{ timestamp: string; message: string; type: string; filePath?: string }> }) {
  return (
    <div className="mt-4 border rounded bg-background">
      <div className="px-3 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
        Execution Log
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1 font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-muted-foreground whitespace-nowrap">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={
              log.type === 'success' ? 'text-green-600 dark:text-green-400' :
              log.type === 'error' ? 'text-red-600 dark:text-red-400' :
              log.type === 'progress' ? 'text-blue-600 dark:text-blue-400' :
              'text-muted-foreground'
            }>
              {log.type === 'success' ? '✓' : log.type === 'error' ? '✗' : log.type === 'progress' ? '→' : '·'}
            </span>
            <span className={
              log.type === 'error' ? 'text-red-600 dark:text-red-400' :
              log.type === 'success' ? 'text-green-600 dark:text-green-400' :
              ''
            }>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
