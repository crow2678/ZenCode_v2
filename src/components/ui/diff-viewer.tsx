'use client'

/**
 * ZenCode V2 - Diff Viewer Component
 *
 * Side-by-side or unified diff display for version comparison.
 * Uses the `diff` npm package for computing changes.
 */

import { useMemo } from 'react'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNumber?: number
}

interface DiffViewerProps {
  oldText: string
  newText: string
  oldLabel?: string
  newLabel?: string
}

export function DiffViewer({ oldText, newText, oldLabel = 'Previous', newLabel = 'Current' }: DiffViewerProps) {
  const diffLines = useMemo(() => computeDiff(oldText, newText), [oldText, newText])

  const addedCount = diffLines.filter((l) => l.type === 'added').length
  const removedCount = diffLines.filter((l) => l.type === 'removed').length

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">{oldLabel} → {newLabel}</span>
          <span className="text-green-600">+{addedCount}</span>
          <span className="text-red-600">-{removedCount}</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {diffLines.map((line, i) => (
              <tr
                key={i}
                className={
                  line.type === 'added'
                    ? 'bg-green-50 dark:bg-green-950/30'
                    : line.type === 'removed'
                    ? 'bg-red-50 dark:bg-red-950/30'
                    : ''
                }
              >
                <td className="w-8 text-right px-2 py-0.5 text-muted-foreground select-none border-r">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </td>
                <td
                  className={`px-3 py-0.5 whitespace-pre-wrap ${
                    line.type === 'added'
                      ? 'text-green-800 dark:text-green-300'
                      : line.type === 'removed'
                      ? 'text-red-800 dark:text-red-300'
                      : ''
                  }`}
                >
                  {line.content}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Simple line-by-line diff algorithm.
 * For a more robust diff, install the `diff` package and use diffLines.
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: DiffLine[] = []

  // Simple LCS-based diff
  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to get diff
  let i = m
  let j = n
  const tempResult: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempResult.unshift({ type: 'unchanged', content: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempResult.unshift({ type: 'added', content: newLines[j - 1] })
      j--
    } else if (i > 0) {
      tempResult.unshift({ type: 'removed', content: oldLines[i - 1] })
      i--
    }
  }

  return tempResult
}
