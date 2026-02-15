'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc/client'
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Boxes,
  ListChecks,
  Package,
  Settings,
  Layers,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { name: 'Stacks', href: '/dashboard/stacks', icon: Layers },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const projectNavigation = [
  { name: 'Overview', href: '', icon: FolderKanban },
  { name: 'PRD', href: '/prd', icon: FileText },
  { name: 'Blueprint', href: '/blueprint', icon: Boxes },
  { name: 'Work Orders', href: '/work-orders', icon: ListChecks },
  { name: 'Assembly', href: '/assembly', icon: Package },
]

export function Sidebar() {
  const pathname = usePathname()
  const params = useParams()

  // Auto-detect projectId from URL
  const projectId = params.projectId as string | undefined

  // Fetch project name if we're in a project context
  const { data: project } = trpc.project.get.useQuery(
    { id: projectId! },
    { enabled: !!projectId }
  )
  const projectName = project?.name

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            Z
          </div>
          <span className="text-xl font-bold">ZenCode</span>
          <span className="text-xs text-muted-foreground">v2</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {projectId ? (
          <>
            {/* Project Context */}
            <div className="mb-4 px-3">
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="font-medium truncate">{projectName || 'Loading...'}</p>
            </div>
            <div className="h-px bg-border mb-4" />

            {/* Project Navigation */}
            {projectNavigation.map((item) => {
              const href = `/dashboard/projects/${projectId}${item.href}`
              const isActive = pathname === href
              return (
                <Link
                  key={item.name}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}

            <div className="h-px bg-border my-4" />

            {/* Back to Projects */}
            <Link
              href="/dashboard/projects"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <FolderKanban className="h-4 w-4" />
              All Projects
            </Link>
          </>
        ) : (
          <>
            {/* Main Navigation */}
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground text-center">
          Stack-Agnostic Assembly
        </p>
      </div>
    </div>
  )
}
