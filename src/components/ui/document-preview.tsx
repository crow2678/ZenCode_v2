'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, FileText, Layers, Tag, BarChart3 } from 'lucide-react'

interface DocumentPreviewProps {
  documentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const tabs = [
  { id: 'text', label: 'Extracted Text', icon: FileText },
  { id: 'chunks', label: 'Chunks', icon: Layers },
  { id: 'metadata', label: 'Metadata', icon: Tag },
  { id: 'relevance', label: 'Relevance', icon: BarChart3 },
] as const

type TabId = typeof tabs[number]['id']

export function DocumentPreview({ documentId, open, onOpenChange }: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('text')

  const { data: doc, isLoading } = trpc.document.get.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId && open }
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{doc?.originalName || 'Document Preview'}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !doc ? (
            <div className="text-center text-muted-foreground p-8">Document not found</div>
          ) : (
            <>
              {activeTab === 'text' && (
                <div className="p-4">
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg max-h-[60vh] overflow-y-auto">
                    {doc.extractedText || 'No text extracted'}
                  </pre>
                </div>
              )}

              {activeTab === 'chunks' && (
                <div className="p-4 space-y-3">
                  {doc.chunks && doc.chunks.length > 0 ? (
                    doc.chunks.map((chunk, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Chunk {chunk.index + 1}
                            {chunk.heading && ` — ${chunk.heading}`}
                          </span>
                          {chunk.relevance && (
                            <div className="flex gap-2 text-xs">
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                PRD: {(chunk.relevance.prd * 100).toFixed(0)}%
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                BP: {(chunk.relevance.blueprint * 100).toFixed(0)}%
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                WO: {(chunk.relevance.workOrders * 100).toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm">{chunk.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground p-8">No chunks available</div>
                  )}
                </div>
              )}

              {activeTab === 'metadata' && (
                <div className="p-4 space-y-4">
                  {doc.metadata ? (
                    <>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Document Type</h4>
                        <span className="px-2 py-1 rounded bg-muted text-sm">{doc.metadata.documentType}</span>
                      </div>

                      {doc.metadata.summary && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Summary</h4>
                          <p className="text-sm text-muted-foreground">{doc.metadata.summary}</p>
                        </div>
                      )}

                      {doc.metadata.topics && doc.metadata.topics.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Topics</h4>
                          <div className="flex flex-wrap gap-1">
                            {doc.metadata.topics.map((topic: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-full bg-secondary text-xs">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {doc.metadata.keyInsights && doc.metadata.keyInsights.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Key Insights</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {doc.metadata.keyInsights.map((insight: string, i: number) => (
                              <li key={i}>{insight}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {doc.metadata.entities && (
                        <div className="grid grid-cols-2 gap-4">
                          {doc.metadata.entities.features?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-1">Features</h4>
                              <div className="flex flex-wrap gap-1">
                                {doc.metadata.entities.features.map((f: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs">{f}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {doc.metadata.entities.techStack?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-1">Tech Stack</h4>
                              <div className="flex flex-wrap gap-1">
                                {doc.metadata.entities.techStack.map((t: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-xs">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground p-8">No metadata available</div>
                  )}
                </div>
              )}

              {activeTab === 'relevance' && (
                <div className="p-4 space-y-4">
                  {doc.metadata?.stageRelevance ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Stage Relevance Scores</h4>
                      {Object.entries(doc.metadata.stageRelevance).map(([stage, score]) => (
                        <div key={stage} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{stage}</span>
                            <span className="text-muted-foreground">{((score as number) * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary rounded-full h-2 transition-all"
                              style={{ width: `${(score as number) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground p-8">No relevance data available</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
