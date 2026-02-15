'use client'

import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderKanban, Plus, Layers, Activity, Loader2 } from 'lucide-react'

export default function DashboardPage() {
  const { data: projects, isLoading: projectsLoading } = trpc.project.list.useQuery()

  const projectCount = projects?.length ?? 0
  const recentProjects = projects?.slice(0, 3) ?? []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to ZenCode V2 - Stack-Agnostic Assembly Engine
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Loading...</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{projectCount}</div>
                <p className="text-xs text-muted-foreground">
                  {projectCount === 1 ? '1 active project' : `${projectCount} active projects`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Stacks</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Next.js, FastAPI</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Loading...</p>
              </>
            ) : recentProjects.length > 0 ? (
              <>
                <div className="text-2xl font-bold">{recentProjects.length}</div>
                <p className="text-xs text-muted-foreground">Recent projects</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">No recent activity</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Create a new project and generate code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/projects/new">
              <Button className="w-full" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create New Project
              </Button>
            </Link>
            <Link href="/dashboard/projects">
              <Button className="w-full" variant="outline">
                <FolderKanban className="mr-2 h-4 w-4" />
                View All Projects
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stack Selection</CardTitle>
            <CardDescription>Choose your tech stack for new projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="text-2xl">⚡</div>
                <div>
                  <p className="font-medium">Next.js + MongoDB</p>
                  <p className="text-sm text-muted-foreground">Default stack</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="text-2xl">🐍</div>
                <div>
                  <p className="font-medium">FastAPI + PostgreSQL</p>
                  <p className="text-sm text-muted-foreground">Python stack</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Your most recently updated projects</CardDescription>
              </div>
              <Link href="/dashboard/projects">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FolderKanban className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {project.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
