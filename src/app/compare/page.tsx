'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ProjectSummary {
  id: string
  name: string
  description: string
  techStack: string[]
  updatedAt: string
}

interface ComparisonResult {
  project: {
    id: string
    name: string
    techStack: string[]
  }
  workOrderCount: number
  v1: {
    status: string
    filesCount: number
    errorCount: number
    errors: Array<{ file: string; line: number; message: string }>
    fixAttempts: number
  } | null
  v2: {
    success: boolean
    filesCount: number
    errorCount: number
    errors: Array<{ file: string; line: number; message: string; severity: string }>
    dependencies: number
    timeMs: number
  }
  analysis: {
    v2CatchesMore: boolean
    sameFileCount: boolean
    missingInV1: Array<{ file: string; line: number; message: string }>
  }
}

export default function ComparePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/compare')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) {
          setProjects(data.projects)
        } else if (data.error) {
          setError(data.error)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const runComparison = async () => {
    if (!selectedProject) return

    setComparing(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject }),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setComparing(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold">V1 vs V2 Comparison</h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Project Selection */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Select Project</h2>

          {loading ? (
            <p>Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-yellow-800">
                No projects found. Make sure MONGODB_URI is configured and V1 has projects.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className={`p-4 border rounded-lg text-left transition ${
                    selectedProject === project.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {project.techStack?.map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-0.5 bg-gray-100 rounded text-xs"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Run Comparison */}
        {selectedProject && (
          <section className="mb-8">
            <button
              onClick={runComparison}
              disabled={comparing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {comparing ? 'Comparing...' : 'Run Comparison'}
            </button>
          </section>
        )}

        {/* Results */}
        {result && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Comparison Results</h2>

            <div className="p-4 bg-gray-50 rounded-lg mb-6">
              <h3 className="font-semibold">{result.project.name}</h3>
              <p className="text-sm text-gray-600">
                {result.workOrderCount} work orders | Tech: {result.project.techStack.join(', ')}
              </p>
            </div>

            {/* Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* V1 */}
              <div className="p-6 border rounded-lg">
                <h3 className="text-lg font-semibold mb-4">V1 (Current)</h3>
                {result.v1 ? (
                  <>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span
                          className={
                            result.v1.status === 'completed'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {result.v1.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Files:</span>
                        <span>{result.v1.filesCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Errors:</span>
                        <span
                          className={
                            result.v1.errorCount > 0 ? 'text-red-600' : 'text-green-600'
                          }
                        >
                          {result.v1.errorCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fix Attempts:</span>
                        <span>{result.v1.fixAttempts}</span>
                      </div>
                    </div>
                    {result.v1.errors.length > 0 && (
                      <div className="text-sm">
                        <p className="font-medium mb-2">Errors:</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {result.v1.errors.map((e, i) => (
                            <div key={i} className="p-2 bg-red-50 rounded text-xs">
                              <div className="font-mono">{e.file}:{e.line}</div>
                              <div>{e.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-600">No V1 assembly found for this project</p>
                )}
              </div>

              {/* V2 */}
              <div className="p-6 border rounded-lg border-blue-200 bg-blue-50/50">
                <h3 className="text-lg font-semibold mb-4">V2 (New Engine)</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Success:</span>
                    <span
                      className={result.v2.success ? 'text-green-600' : 'text-red-600'}
                    >
                      {result.v2.success ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Files:</span>
                    <span>{result.v2.filesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Errors:</span>
                    <span
                      className={
                        result.v2.errorCount > 0 ? 'text-red-600' : 'text-green-600'
                      }
                    >
                      {result.v2.errorCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dependencies:</span>
                    <span>{result.v2.dependencies}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span>{result.v2.timeMs}ms</span>
                  </div>
                </div>
                {result.v2.errors.length > 0 && (
                  <div className="text-sm">
                    <p className="font-medium mb-2">Errors:</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {result.v2.errors.map((e, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded text-xs ${
                            e.severity === 'error' ? 'bg-red-100' : 'bg-yellow-100'
                          }`}
                        >
                          <div className="font-mono">{e.file}:{e.line}</div>
                          <div>{e.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis */}
            <div className="p-6 border rounded-lg bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Analysis</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {result.analysis.v2CatchesMore ? '✅' : '⚠️'}
                  </span>
                  <span>
                    {result.analysis.v2CatchesMore
                      ? 'V2 catches more errors than V1'
                      : 'V2 catches same or fewer errors'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {result.analysis.sameFileCount ? '✅' : '⚠️'}
                  </span>
                  <span>
                    {result.analysis.sameFileCount
                      ? 'Same file count as V1'
                      : 'Different file count from V1'}
                  </span>
                </div>
                {result.analysis.missingInV1.length > 0 && (
                  <div className="mt-4">
                    <p className="font-medium mb-2">
                      Errors V2 catches that V1 missed ({result.analysis.missingInV1.length}):
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {result.analysis.missingInV1.map((e, i) => (
                        <div key={i} className="p-2 bg-green-50 rounded text-xs">
                          <div className="font-mono">{e.file}:{e.line}</div>
                          <div>{e.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Info */}
        <section className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">How Comparison Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Fetches project and work orders from shared MongoDB</li>
            <li>Retrieves latest V1 assembly result</li>
            <li>Runs V2 assembly engine with same work orders</li>
            <li>Compares validation errors, file counts, and dependencies</li>
            <li>Identifies errors V2 catches that V1 missed</li>
          </ol>
        </section>
      </div>
    </main>
  )
}
