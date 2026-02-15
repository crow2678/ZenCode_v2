'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface TestResult {
  success: boolean
  stackId: string
  stats: {
    totalFiles: number
    filesCreated: number
    validationPasses: number
    timeMs: number
  }
  dependencies: string[]
  errors: Array<{
    file: string
    line: number
    message: string
    severity: string
  }>
  files: string[]
  analysis?: Array<{
    path: string
    imports: number
    exports: number
    externalDeps: string[]
    unresolvedImports: number
  }>
  missingFiles?: Array<{
    path: string
    requiredExports: string[]
    importedBy: string[]
  }>
}

interface StackInfo {
  id: string
  name: string
  description: string
  icon: string
  language: string
  framework: string
}

export default function TestPage() {
  const [stacks, setStacks] = useState<StackInfo[]>([])
  const [defaultStack, setDefaultStack] = useState<string>('')
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch available stacks
    fetch('/api/stacks')
      .then((res) => res.json())
      .then((data) => {
        setStacks(data.stacks)
        setDefaultStack(data.default)
      })
      .catch((err) => setError(err.message))
  }, [])

  const runTest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/test-assembly')
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold">Assembly Test Harness</h1>
        </div>

        {/* Available Stacks */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Available Stacks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stacks.map((stack) => (
              <div
                key={stack.id}
                className={`p-4 border rounded-lg ${
                  stack.id === defaultStack ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{stack.icon}</span>
                  <h3 className="font-semibold">{stack.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">{stack.description}</p>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-100 rounded">{stack.language}</span>
                  <span className="px-2 py-1 bg-gray-100 rounded">{stack.framework}</span>
                </div>
                {stack.id === defaultStack && (
                  <span className="text-xs text-blue-600 mt-2 block">Default</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Run Test */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Run Sample Assembly</h2>
          <p className="text-gray-600 mb-4">
            This will run the assembly engine with sample work orders (User model, barrel export, user service).
          </p>
          <button
            onClick={runTest}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Test'}
          </button>
        </section>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Results</h2>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold">
                  {result.success ? '✅' : '❌'}
                </div>
                <div className="text-sm text-gray-600">
                  {result.success ? 'Success' : 'Failed'}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold">{result.stats.totalFiles}</div>
                <div className="text-sm text-gray-600">Files Generated</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold">{result.dependencies.length}</div>
                <div className="text-sm text-gray-600">Dependencies</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold">{result.stats.timeMs}ms</div>
                <div className="text-sm text-gray-600">Time</div>
              </div>
            </div>

            {/* Files */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Generated Files</h3>
              <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
                {result.files.map((file) => (
                  <div key={file}>{file}</div>
                ))}
              </div>
            </div>

            {/* Dependencies */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Extracted Dependencies</h3>
              <div className="flex flex-wrap gap-2">
                {result.dependencies.map((dep) => (
                  <span
                    key={dep}
                    className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>

            {/* Analysis */}
            {result.analysis && result.analysis.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">File Analysis</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Path</th>
                        <th className="p-2 text-right">Imports</th>
                        <th className="p-2 text-right">Exports</th>
                        <th className="p-2 text-right">Unresolved</th>
                        <th className="p-2 text-left">External Deps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.analysis.map((a) => (
                        <tr key={a.path} className="border-b">
                          <td className="p-2 font-mono">{a.path}</td>
                          <td className="p-2 text-right">{a.imports}</td>
                          <td className="p-2 text-right">{a.exports}</td>
                          <td className="p-2 text-right">
                            {a.unresolvedImports > 0 ? (
                              <span className="text-red-600">{a.unresolvedImports}</span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="p-2">{a.externalDeps.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Missing Files */}
            {result.missingFiles && result.missingFiles.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-red-600">Missing Files</h3>
                <div className="space-y-2">
                  {result.missingFiles.map((mf) => (
                    <div key={mf.path} className="p-3 bg-red-50 rounded-lg">
                      <div className="font-mono font-semibold">{mf.path}</div>
                      <div className="text-sm text-gray-600">
                        Required exports: {mf.requiredExports.join(', ')}
                      </div>
                      <div className="text-sm text-gray-600">
                        Imported by: {mf.importedBy.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {result.errors.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-red-600">
                  Validation Errors ({result.errors.length})
                </h3>
                <div className="space-y-2">
                  {result.errors.map((err, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg ${
                        err.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50'
                      }`}
                    >
                      <div className="font-mono text-sm">
                        {err.file}:{err.line}
                      </div>
                      <div>{err.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Quick Links */}
        <section className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/api/stacks"
              target="_blank"
              className="p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="font-semibold">GET /api/stacks</div>
              <div className="text-sm text-gray-600">List all registered stacks</div>
            </a>
            <a
              href="/api/test-assembly"
              target="_blank"
              className="p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="font-semibold">GET /api/test-assembly</div>
              <div className="text-sm text-gray-600">Run sample assembly test</div>
            </a>
            <a
              href="/api/test-prompts?section=validation-checklist"
              target="_blank"
              className="p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="font-semibold">GET /api/test-prompts</div>
              <div className="text-sm text-gray-600">Test prompt builder</div>
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
