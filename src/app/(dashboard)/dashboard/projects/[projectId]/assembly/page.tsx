'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Download,
  FileCode,
  Layers,
  Eye,
  Wrench,
  TestTube2,
} from 'lucide-react'

const STACK_OPTIONS = [
  { id: 'nextjs-mongodb', name: 'Next.js + MongoDB', icon: '⚡' },
  { id: 'fastapi-postgres', name: 'FastAPI + PostgreSQL', icon: '🐍' },
  { id: 'express-postgres', name: 'Express + PostgreSQL', icon: '🚀' },
]

export default function AssemblyPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [selectedStack, setSelectedStack] = useState('nextjs-mongodb')
  const [showFiles, setShowFiles] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showTests, setShowTests] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingTests, setIsDownloadingTests] = useState(false)
  const [isGeneratingTests, setIsGeneratingTests] = useState(false)
  const [previewData, setPreviewData] = useState<{
    success: boolean
    files: Array<{ path: string; action: 'create' | 'modify'; size: number }>
    totalFiles: number
    validationErrors: Array<{ file: string; line: number; message: string }>
    fixesApplied: number
    tsErrors: number
    logs: string[]
    tempPath: string
    blueprintId: string
  } | null>(null)

  const { data: project } = trpc.project.get.useQuery({ id: projectId })
  const { data: workOrders } = trpc.workOrder.list.useQuery({ projectId })
  const { data: assembly, isLoading } = trpc.assembly.get.useQuery({ projectId })
  const { data: files } = trpc.assembly.getFiles.useQuery(
    { projectId },
    { enabled: showFiles }
  )

  const runMutation = trpc.assembly.run.useMutation({
    onSuccess: (data) => {
      utils.assembly.get.invalidate({ projectId })
      if (data.success) {
        toast({ title: 'Assembly completed!' })
      } else {
        toast({
          title: 'Assembly completed with errors',
          description: `${data.errorsCount} validation errors found`,
          variant: 'destructive',
        })
      }
    },
    onError: (err) => {
      toast({ title: 'Assembly failed', description: err.message, variant: 'destructive' })
    },
  })

  const previewMutation = trpc.assembly.preview.useMutation({
    onSuccess: (data) => {
      setPreviewData(data)
      setShowPreview(true)
    },
    onError: (err) => {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' })
    },
  })

  const confirmMutation = trpc.assembly.confirm.useMutation({
    onSuccess: (data) => {
      setShowPreview(false)
      setPreviewData(null)
      utils.assembly.get.invalidate({ projectId })
      if (data.success) {
        toast({ title: 'Assembly confirmed and saved!' })
      } else {
        toast({
          title: 'Assembly saved with errors',
          description: `${data.errorsCount} validation errors`,
          variant: 'destructive',
        })
      }
    },
    onError: (err) => {
      toast({ title: 'Confirm failed', description: err.message, variant: 'destructive' })
    },
  })

  const generateTestsMutation = trpc.assembly.generateTests.useMutation({
    onSuccess: (data) => {
      toast({
        title: `${data.totalGenerated} tests generated!`,
        description: data.tests.map((t) => t.path).join(', '),
      })
      setIsGeneratingTests(false)
      utils.assembly.getFiles.invalidate({ projectId })
    },
    onError: (err) => {
      toast({ title: 'Test generation failed', description: err.message, variant: 'destructive' })
      setIsGeneratingTests(false)
    },
  })

  const cancelMutation = trpc.assembly.cancel.useMutation({
    onSuccess: () => {
      setShowPreview(false)
      setPreviewData(null)
      toast({ title: 'Preview cancelled' })
    },
    onError: (err) => {
      toast({ title: 'Cancel failed', description: err.message, variant: 'destructive' })
    },
  })

  const handlePreview = () => {
    if (!workOrders || workOrders.length === 0) {
      toast({ title: 'No work orders found', variant: 'destructive' })
      return
    }
    previewMutation.mutate({ projectId, stackId: selectedStack })
  }

  const handleConfirm = () => {
    if (!previewData) return
    confirmMutation.mutate({
      projectId,
      blueprintId: previewData.blueprintId,
      tempPath: previewData.tempPath,
    })
  }

  const handleCancel = () => {
    if (!previewData) {
      setShowPreview(false)
      return
    }
    cancelMutation.mutate({ tempPath: previewData.tempPath })
  }

  const handleRun = () => {
    if (!workOrders || workOrders.length === 0) {
      toast({ title: 'No work orders found', variant: 'destructive' })
      return
    }

    runMutation.mutate({ projectId, stackId: selectedStack })
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      // Fetch all files
      const filesData = await utils.assembly.getFiles.fetch({ projectId })

      if (!filesData || filesData.length === 0) {
        toast({ title: 'No files to download', variant: 'destructive' })
        return
      }

      // Dynamically import JSZip
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      // Add each file to the zip
      for (const file of filesData) {
        zip.file(file.path, file.content)
      }

      // Generate the zip
      const blob = await zip.generateAsync({ type: 'blob' })

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'assembly'}-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({ title: 'Download started!' })
    } catch (error) {
      console.error('Download error:', error)
      toast({ title: 'Download failed', description: (error as Error).message, variant: 'destructive' })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDownloadTests = async () => {
    setIsDownloadingTests(true)
    try {
      const filesData = await utils.assembly.getFiles.fetch({ projectId })
      const testFiles = filesData?.filter((f) => f.path.endsWith('.test.ts')) || []

      if (testFiles.length === 0) {
        toast({ title: 'No test files found', description: 'Generate tests first', variant: 'destructive' })
        return
      }

      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (const file of testFiles) {
        zip.file(file.path, file.content)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'tests'}-tests-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({ title: `${testFiles.length} test files downloaded!` })
    } catch (error) {
      console.error('Download tests error:', error)
      toast({ title: 'Download failed', description: (error as Error).message, variant: 'destructive' })
    } finally {
      setIsDownloadingTests(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Check if work orders exist
  if (!workOrders || workOrders.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Assembly</h1>
            <p className="text-muted-foreground">Build and validate output</p>
          </div>
        </div>

        <Card className="p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Work Orders Required</h3>
          <p className="text-muted-foreground mt-2">
            Please generate work orders before running assembly.
          </p>
          <Link href={`/dashboard/projects/${projectId}/work-orders`}>
            <Button className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Work Orders
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Assembly</h1>
          <p className="text-muted-foreground">Build and validate output</p>
        </div>
      </div>

      {/* Stack Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Target Stack
          </CardTitle>
          <CardDescription>Select the tech stack for code generation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {STACK_OPTIONS.map((stack) => (
              <button
                key={stack.id}
                onClick={() => setSelectedStack(stack.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  selectedStack === stack.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-xl">{stack.icon}</span>
                <span className="font-medium">{stack.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Run Assembly */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Run Assembly
          </CardTitle>
          <CardDescription>
            Process {workOrders.length} work orders and generate code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={handlePreview}
              disabled={previewMutation.isLoading || runMutation.isLoading}
              size="lg"
              variant="outline"
            >
              {previewMutation.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Preview (Dry Run)
            </Button>
            <Button onClick={handleRun} disabled={runMutation.isLoading || previewMutation.isLoading} size="lg">
              {runMutation.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Assembly
            </Button>
          </div>

          {/* Running Logs Panel */}
          {(previewMutation.isLoading || runMutation.isLoading) && (
            <AssemblyProgress isPreview={previewMutation.isLoading} />
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewData?.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : previewData?.validationErrors.length ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
              Assembly Preview
            </DialogTitle>
            <DialogDescription>
              Review the assembly results before committing
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="flex-1 overflow-y-auto pr-4">
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold">{previewData.totalFiles}</div>
                    <div className="text-xs text-muted-foreground">Files</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{previewData.fixesApplied}</div>
                    <div className="text-xs text-muted-foreground">Auto-Fixes</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className={`text-2xl font-bold ${previewData.validationErrors.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {previewData.validationErrors.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Validation Errors</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className={`text-2xl font-bold ${previewData.tsErrors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {previewData.tsErrors}
                    </div>
                    <div className="text-xs text-muted-foreground">TS Errors</div>
                  </div>
                </div>

                {/* Validation Errors */}
                {previewData.validationErrors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Validation Errors
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {previewData.validationErrors.map((err, i) => (
                        <div key={i} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                          <code className="font-medium">{err.file}:{err.line}</code>
                          <span className="text-muted-foreground ml-2">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated Files */}
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    Files to Generate ({previewData.files.length})
                  </h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {previewData.files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            file.action === 'create' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                          }`}>
                            {file.action}
                          </span>
                          <code>{file.path}</code>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logs */}
                {previewData.logs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Assembly Logs
                    </h4>
                    <div className="bg-slate-950 text-slate-100 p-3 rounded-lg text-xs font-mono max-h-40 overflow-y-auto">
                      {previewData.logs.map((log, i) => (
                        <div key={i} className="py-0.5">{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelMutation.isLoading || confirmMutation.isLoading}
            >
              {cancelMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmMutation.isLoading || cancelMutation.isLoading}
            >
              {confirmMutation.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assembly Result */}
      {assembly && (
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {assembly.status === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : assembly.status === 'failed' ? (
                    <XCircle className="h-6 w-6 text-red-500" />
                  ) : (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  )}
                  <div>
                    <CardTitle className="capitalize">{assembly.status}</CardTitle>
                    <CardDescription>
                      {assembly.mergedFiles?.length || 0} files generated
                    </CardDescription>
                  </div>
                </div>
                {assembly.status === 'completed' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsGeneratingTests(true)
                        generateTestsMutation.mutate({ projectId, stackId: selectedStack })
                      }}
                      disabled={isGeneratingTests}
                    >
                      {isGeneratingTests ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube2 className="mr-2 h-4 w-4" />
                      )}
                      Generate Tests
                    </Button>
                    <Button variant="outline" onClick={handleDownloadTests} disabled={isDownloadingTests}>
                      {isDownloadingTests ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube2 className="mr-2 h-4 w-4" />
                      )}
                      Download Tests
                    </Button>
                    <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
                      {isDownloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {isDownloading ? 'Downloading...' : 'Download All'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Validation Errors */}
          {assembly.validationErrors && assembly.validationErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-5 w-5" />
                  Validation Errors ({assembly.validationErrors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {assembly.validationErrors.map((err, i) => (
                    <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                      <code className="font-medium">{err.file}:{err.line}</code>
                      <p className="text-muted-foreground mt-1">{err.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Files */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  Generated Files
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFiles(!showFiles)}
                >
                  {showFiles ? 'Hide' : 'Show'} Content
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showFiles && files ? (
                <div className="space-y-4">
                  {files.map((file, i) => (
                    <div key={i} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted px-3 py-2 font-mono text-sm">
                        {file.path}
                      </div>
                      <pre className="p-3 text-xs overflow-x-auto max-h-64">
                        {file.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {assembly.mergedFiles?.map((path, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <code>{path}</code>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Files */}
          {showFiles && files && files.some((f) => f.path.endsWith('.test.ts')) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TestTube2 className="h-5 w-5" />
                    Test Files ({files.filter((f) => f.path.endsWith('.test.ts')).length})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTests(!showTests)}
                  >
                    {showTests ? 'Hide' : 'Show'} Content
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showTests ? (
                  <div className="space-y-4">
                    {files
                      .filter((f) => f.path.endsWith('.test.ts'))
                      .map((file, i) => (
                        <div key={i} className="border rounded-lg overflow-hidden">
                          <div className="bg-muted px-3 py-2 font-mono text-sm flex items-center gap-2">
                            <TestTube2 className="h-3 w-3 text-green-500" />
                            {file.path}
                          </div>
                          <pre className="p-3 text-xs overflow-x-auto max-h-64">
                            {file.content}
                          </pre>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {files
                      .filter((f) => f.path.endsWith('.test.ts'))
                      .map((file, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <TestTube2 className="h-4 w-4 text-green-500" />
                          <code>{file.path}</code>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Logs */}
          {assembly.logs && assembly.logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 font-mono text-xs">
                  {assembly.logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// Assembly Progress Component - shows animated steps while running
function AssemblyProgress({ isPreview }: { isPreview: boolean }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [dots, setDots] = useState('')

  const steps = [
    { label: 'Collecting files from work orders', duration: 2000 },
    { label: 'Generating scaffold files', duration: 3000 },
    { label: 'Merging all files', duration: 2000 },
    { label: 'Detecting missing files (Pass 1/3)', duration: 5000 },
    { label: 'Generating missing files (Pass 1)', duration: 8000 },
    { label: 'Detecting missing files (Pass 2/3)', duration: 4000 },
    { label: 'Generating missing files (Pass 2)', duration: 6000 },
    { label: 'Detecting missing files (Pass 3/3)', duration: 3000 },
    { label: 'Generating wiring files', duration: 4000 },
    { label: 'Validating imports and exports', duration: 3000 },
    { label: 'Running TypeScript compilation', duration: 5000 },
    { label: 'Finalizing assembly', duration: 2000 },
  ]

  useEffect(() => {
    // Animate dots
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 400)

    // Progress through steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => prev < steps.length - 1 ? prev + 1 : prev)
    }, 3000)

    return () => {
      clearInterval(dotsInterval)
      clearInterval(stepInterval)
    }
  }, [])

  return (
    <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm">
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{isPreview ? 'Running Preview' : 'Running Assembly'}{dots}</span>
      </div>
      <div className="space-y-1">
        {steps.slice(0, currentStep + 1).map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 ${
              i === currentStep ? 'text-blue-400' : 'text-green-400'
            }`}
          >
            {i === currentStep ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            <span>{step.label}{i === currentStep ? dots : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
