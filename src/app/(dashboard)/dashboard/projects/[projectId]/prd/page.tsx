'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  FileText,
  CheckCircle2,
  Sparkles,
  Upload,
  X,
  File,
  AlertCircle,
  RefreshCw,
  Eye,
  History,
} from 'lucide-react'
import { DocumentPreview } from '@/components/ui/document-preview'

interface UploadedDocument {
  id: string
  name: string
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  error?: string
  selected: boolean
}

export default function PRDPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string
  const templateId = searchParams.get('template')
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [input, setInput] = useState('')

  // Pre-fill from template if ?template= is in the URL
  useEffect(() => {
    if (templateId && !input) {
      import('@/lib/templates').then(({ getTemplate }) => {
        const template = getTemplate(templateId)
        if (template) {
          setInput(template.prdText)
        }
      })
    }
  }, [templateId])
  const [isGenerating, setIsGenerating] = useState(false)
  const [localDocuments, setLocalDocuments] = useState<UploadedDocument[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)

  const { data: project } = trpc.project.get.useQuery({ id: projectId })
  const { data: requirement, isLoading } = trpc.requirement.get.useQuery({ projectId })

  // Fetch existing documents with refetch interval for processing docs
  const { data: existingDocs, refetch: refetchDocs } = trpc.document.list.useQuery(
    { projectId },
    { refetchInterval: (data) => {
      // Auto-refetch every 3s if any doc is processing
      const hasProcessing = data?.some(d => d.status === 'uploading' || d.status === 'processing')
      return hasProcessing ? 3000 : false
    }}
  )

  // Sync existing docs to local state for selection
  useEffect(() => {
    if (existingDocs) {
      setLocalDocuments(prev => {
        const existingIds = new Set(prev.map(d => d.id))
        const newDocs = existingDocs
          .filter(d => !existingIds.has(d.id) && !d.id.startsWith('temp-'))
          .map(d => ({
            id: d.id,
            name: d.originalName,
            status: d.status as UploadedDocument['status'],
            error: d.error,
            selected: true, // Default selected
          }))

        // Update status of existing docs
        const updated = prev.map(doc => {
          const serverDoc = existingDocs.find(d => d.id === doc.id)
          if (serverDoc) {
            return {
              ...doc,
              status: serverDoc.status as UploadedDocument['status'],
              error: serverDoc.error,
            }
          }
          return doc
        })

        return [...updated, ...newDocs]
      })
    }
  }, [existingDocs])

  const generateMutation = trpc.requirement.generate.useMutation({
    onSuccess: () => {
      utils.requirement.get.invalidate({ projectId })
      setIsGenerating(false)
      toast({ title: 'PRD generated successfully!' })
    },
    onError: (err) => {
      setIsGenerating(false)
      toast({ title: 'Error generating PRD', description: err.message, variant: 'destructive' })
    },
  })

  const approveMutation = trpc.requirement.approve.useMutation({
    onSuccess: () => {
      utils.requirement.get.invalidate({ projectId })
      toast({ title: 'PRD approved!' })
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  const deleteDocMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      utils.document.list.invalidate({ projectId })
    },
  })

  // Upload file handler
  const uploadFile = async (file: File) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setLocalDocuments(prev => [...prev, {
      id: tempId,
      name: file.name,
      status: 'uploading',
      selected: true
    }])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()

      // Replace temp with real document
      setLocalDocuments(prev =>
        prev.map(d =>
          d.id === tempId
            ? { id: data.id, name: file.name, status: 'processing', selected: true }
            : d
        )
      )

      // Refetch to get updated status
      setTimeout(() => refetchDocs(), 1000)
    } catch (error) {
      setLocalDocuments(prev =>
        prev.map(d =>
          d.id === tempId
            ? { ...d, status: 'failed', error: error instanceof Error ? error.message : 'Upload failed' }
            : d
        )
      )
    }
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(f =>
      ['.pdf', '.docx', '.txt', '.md'].some(ext => f.name.toLowerCase().endsWith(ext))
    )

    if (validFiles.length !== files.length) {
      toast({
        title: 'Some files skipped',
        description: 'Only PDF, DOCX, TXT, and MD files are supported',
        variant: 'destructive',
      })
    }

    validFiles.forEach(uploadFile)
  }, [projectId, toast])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(uploadFile)
    e.target.value = ''
  }

  const toggleDocumentSelection = (docId: string) => {
    setLocalDocuments(prev =>
      prev.map(d => d.id === docId ? { ...d, selected: !d.selected } : d)
    )
  }

  const removeDocument = (docId: string) => {
    setLocalDocuments(prev => prev.filter(d => d.id !== docId))
    if (!docId.startsWith('temp-')) {
      deleteDocMutation.mutate({ documentId: docId })
    }
  }

  const handleRefreshStatus = () => {
    refetchDocs()
    toast({ title: 'Refreshing document status...' })
  }

  // Get selected ready documents
  const selectedReadyDocs = localDocuments.filter(d => d.selected && d.status === 'ready')
  const hasSelectedDocs = selectedReadyDocs.length > 0
  const hasDescription = input.trim().length > 0

  // Can generate if we have description OR selected documents
  const canGenerate = hasDescription || hasSelectedDocs

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast({
        title: 'Please provide input',
        description: 'Enter a description or select uploaded documents',
        variant: 'destructive'
      })
      return
    }

    setIsGenerating(true)

    const documentIds = selectedReadyDocs.map(d => d.id)

    generateMutation.mutate({
      projectId,
      rawText: input.trim() || 'Generate PRD based on the uploaded reference documents.',
      documentIds: documentIds.length > 0 ? documentIds : undefined,
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

  const hasProcessingDocs = localDocuments.some(d => d.status === 'uploading' || d.status === 'processing')

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
            <h1 className="text-2xl font-bold">Product Requirements</h1>
            <p className="text-muted-foreground">Define what you want to build</p>
          </div>
        </div>
        {requirement?.status === 'approved' && (
          <Link href={`/dashboard/projects/${projectId}/blueprint`}>
            <Button>
              Next: Blueprint
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {requirement ? (
        /* Show existing PRD */
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">PRD v{requirement.version}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/projects/${projectId}/prd/versions`}>
                    <Button variant="outline" size="sm">
                      <History className="mr-2 h-4 w-4" />
                      Version History
                    </Button>
                  </Link>
                  {requirement.status === 'approved' ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      Approved
                    </span>
                  ) : (
                    <Button onClick={handleApprove} disabled={approveMutation.isLoading}>
                      {approveMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Approve PRD
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{requirement.content?.overview || requirement.rawText}</p>
            </CardContent>
          </Card>

          {requirement.content?.goals && requirement.content.goals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {requirement.content.goals.map((goal: string, i: number) => (
                    <li key={i}>{goal}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {requirement.features && requirement.features.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {requirement.features.map((feature: { name: string; description: string; priority?: string }, i: number) => (
                    <div key={i} className="border-b pb-4 last:border-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{feature.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          feature.priority === 'high' ? 'bg-red-100 text-red-700' :
                          feature.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {feature.priority}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regenerate */}
          <Card>
            <CardHeader>
              <CardTitle>Regenerate PRD</CardTitle>
              <CardDescription>Update the requirements with new input</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe what you want to change..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={4}
              />
              <Button onClick={handleGenerate} disabled={isGenerating || !input}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Sparkles className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Create new PRD */
        <div className="space-y-6">
          {/* Document Upload */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Reference Documents
                  </CardTitle>
                  <CardDescription>
                    Upload specs, wireframes, or research documents. Select which ones to include in PRD generation.
                  </CardDescription>
                </div>
                {hasProcessingDocs && (
                  <Button variant="outline" size="sm" onClick={handleRefreshStatus}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  PDF, DOCX, TXT, MD (max 10MB each)
                </p>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileSelect}
                />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Browse Files
                  </label>
                </Button>
              </div>

              {/* Document List with Selection */}
              {localDocuments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>Select documents to include:</span>
                    <span>{selectedReadyDocs.length} of {localDocuments.filter(d => d.status === 'ready').length} selected</span>
                  </div>
                  {localDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        doc.selected && doc.status === 'ready'
                          ? 'bg-primary/10 border border-primary/20'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {doc.status === 'ready' ? (
                          <Checkbox
                            checked={doc.selected}
                            onCheckedChange={() => toggleDocumentSelection(doc.id)}
                          />
                        ) : (
                          <div className="w-4" />
                        )}
                        <File className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium truncate max-w-[200px]">{doc.name}</span>
                        {doc.status === 'uploading' && (
                          <span className="text-xs text-blue-600 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Uploading...
                          </span>
                        )}
                        {doc.status === 'processing' && (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing...
                          </span>
                        )}
                        {doc.status === 'ready' && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready
                          </span>
                        )}
                        {doc.status === 'failed' && (
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {doc.error || 'Failed'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {doc.status === 'ready' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setPreviewDocId(doc.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeDocument(doc.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Description */}
          <Card>
            <CardHeader>
              <CardTitle>Describe Your Project</CardTitle>
              <CardDescription>
                {hasSelectedDocs
                  ? 'Optional: Add additional context or leave empty to generate from documents only.'
                  : 'Tell us what you want to build. Be as detailed as possible.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={hasSelectedDocs
                  ? "Optional: Add any additional requirements or context..."
                  : `I want to build an app that...

Include details like:
- What problem does it solve?
- Who are the users?
- What are the main features?
- Any specific requirements?`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={hasSelectedDocs ? 4 : 10}
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>Stack: {project?.techStack?.join(', ') || 'Next.js, MongoDB, tRPC, Tailwind CSS'}</p>
                  {hasSelectedDocs && (
                    <p className="text-green-600 mt-1">
                      ✓ {selectedReadyDocs.length} document{selectedReadyDocs.length > 1 ? 's' : ''} will be included
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !canGenerate}
                  size="lg"
                >
                  {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate PRD
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Document Preview Dialog */}
      <DocumentPreview
        documentId={previewDocId}
        open={!!previewDocId}
        onOpenChange={(open) => { if (!open) setPreviewDocId(null) }}
      />
    </div>
  )
}
