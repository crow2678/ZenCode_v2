'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { DiffViewer } from '@/components/ui/diff-viewer'
import {
  ArrowLeft,
  Loader2,
  History,
  CheckCircle2,
  Circle,
  Archive,
  RotateCcw,
} from 'lucide-react'

export default function BlueprintVersionsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  const { data: versions, isLoading } = trpc.blueprint.listVersions.useQuery({ projectId })

  const { data: oldVersion } = trpc.blueprint.getVersion.useQuery(
    { id: compareIds?.[0] || '' },
    { enabled: !!compareIds?.[0] }
  )
  const { data: newVersion } = trpc.blueprint.getVersion.useQuery(
    { id: compareIds?.[1] || '' },
    { enabled: !!compareIds?.[1] }
  )

  const rollbackMutation = trpc.blueprint.rollback.useMutation({
    onSuccess: () => {
      utils.blueprint.get.invalidate({ projectId })
      utils.blueprint.listVersions.invalidate({ projectId })
      toast({ title: 'Rolled back successfully' })
      router.push(`/dashboard/projects/${projectId}/blueprint`)
    },
    onError: (err) => {
      toast({ title: 'Rollback failed', description: err.message, variant: 'destructive' })
    },
  })

  const handleCompare = (id1: string, id2: string) => {
    setCompareIds([id1, id2])
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}/blueprint`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Blueprint Version History</h1>
          <p className="text-muted-foreground">Compare and rollback to previous versions</p>
        </div>
      </div>

      {/* Version List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Versions ({versions?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions?.map((v, i) => (
            <div
              key={v.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                {v.status === 'approved' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : v.status === 'archived' ? (
                  <Archive className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Circle className="h-5 w-5 text-blue-500" />
                )}
                <div>
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-sm text-muted-foreground ml-2 capitalize">{v.status}</span>
                  {v.name && <span className="text-sm text-muted-foreground ml-2">— {v.name}</span>}
                  <p className="text-xs text-muted-foreground">
                    {v.stackId && <span className="mr-2">{v.stackId}</span>}
                    {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {i < (versions?.length || 0) - 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCompare(versions![i + 1].id, v.id)}
                  >
                    Compare with v{versions![i + 1].version}
                  </Button>
                )}
                {v.status === 'archived' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rollbackMutation.mutate({ projectId, versionId: v.id })}
                    disabled={rollbackMutation.isLoading}
                  >
                    {rollbackMutation.isLoading ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1 h-3 w-3" />
                    )}
                    Restore
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Diff Viewer */}
      {compareIds && oldVersion && newVersion && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Comparing v{oldVersion.version} → v{newVersion.version}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setCompareIds(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DiffViewer
              oldText={JSON.stringify({
                name: oldVersion.name,
                description: oldVersion.description,
                architecture: oldVersion.architecture,
                models: oldVersion.models,
                services: oldVersion.services,
                routes: oldVersion.routes,
                components: oldVersion.components,
              }, null, 2)}
              newText={JSON.stringify({
                name: newVersion.name,
                description: newVersion.description,
                architecture: newVersion.architecture,
                models: newVersion.models,
                services: newVersion.services,
                routes: newVersion.routes,
                components: newVersion.components,
              }, null, 2)}
              oldLabel={`v${oldVersion.version}`}
              newLabel={`v${newVersion.version}`}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
