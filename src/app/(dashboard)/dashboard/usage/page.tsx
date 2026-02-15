'use client'

import { trpc } from '@/lib/trpc/client'

export default function UsagePage() {
  const summaryQuery = trpc.tokenUsage.summary.useQuery({ days: 30 })
  const byProjectQuery = trpc.tokenUsage.byProject.useQuery({ days: 30 })

  const totals = summaryQuery.data?.totals
  const daily = summaryQuery.data?.daily || []
  const byProject = byProjectQuery.data || []

  const formatNumber = (n: number) => n.toLocaleString()

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Token Usage</h1>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Input Tokens</div>
          <div className="text-2xl font-bold">{formatNumber(totals?.inputTokens || 0)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Output Tokens</div>
          <div className="text-2xl font-bold">{formatNumber(totals?.outputTokens || 0)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Cache Read</div>
          <div className="text-2xl font-bold">{formatNumber(totals?.cacheReadTokens || 0)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Requests</div>
          <div className="text-2xl font-bold">{formatNumber(totals?.requests || 0)}</div>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="rounded-lg border bg-card p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Daily Usage (Last 30 Days)</h2>
        {daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-right">Input</th>
                  <th className="py-2 text-right">Output</th>
                  <th className="py-2 text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day) => (
                  <tr key={day.date} className="border-b border-border/50">
                    <td className="py-2">{day.date}</td>
                    <td className="py-2 text-right">{formatNumber(day.inputTokens)}</td>
                    <td className="py-2 text-right">{formatNumber(day.outputTokens)}</td>
                    <td className="py-2 text-right">{day.requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-Project Breakdown */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Usage by Project</h2>
        {byProject.length === 0 ? (
          <p className="text-sm text-muted-foreground">No project usage data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Project ID</th>
                  <th className="py-2 text-right">Input</th>
                  <th className="py-2 text-right">Output</th>
                  <th className="py-2 text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {byProject.map((p) => (
                  <tr key={p.projectId} className="border-b border-border/50">
                    <td className="py-2 font-mono text-xs">{p.projectId}</td>
                    <td className="py-2 text-right">{formatNumber(p.inputTokens)}</td>
                    <td className="py-2 text-right">{formatNumber(p.outputTokens)}</td>
                    <td className="py-2 text-right">{p.requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
