'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, FolderKanban, MoreVertical, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'

export default function ProjectsPage() {
  const [search, setSearch] = useState('')
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const { data: projects, isLoading } = trpc.project.list.useQuery()

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate()
      toast({ title: 'Project archived' })
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  const filteredProjects = projects?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your ZenCode projects</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Project Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-4 w-48 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects?.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No projects found</h3>
          <p className="mt-2 text-muted-foreground">
            {search ? 'Try a different search term' : 'Get started by creating your first project'}
          </p>
          {!search && (
            <Link href="/dashboard/projects/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects?.map((project) => (
            <Card key={project.id} className="group relative">
              <Link href={`/dashboard/projects/${project.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {project.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {project.techStack?.slice(0, 3).map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {tech}
                      </span>
                    ))}
                    {(project.techStack?.length || 0) > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{project.techStack!.length - 3} more
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Link>

              {/* Actions Menu */}
              <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        deleteMutation.mutate({ id: project.id })
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
