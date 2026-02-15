'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface StackInfo {
  id: string
  name: string
  description: string
  icon: string
  language: string
  framework: string
  version: string
}

interface PromptResult {
  stack: { id: string; name: string }
  section: string
  promptLength: number
  prompt: string
}

const SECTIONS = [
  { id: 'full', label: 'Full System Prompt' },
  { id: 'project-structure', label: 'Project Structure' },
  { id: 'code-patterns', label: 'Code Patterns' },
  { id: 'validation-checklist', label: 'Validation Checklist' },
  { id: 'prd', label: 'PRD Generation' },
  { id: 'blueprint', label: 'Blueprint Generation' },
  { id: 'work-orders', label: 'Work Orders' },
]

export default function StacksPage() {
  const [stacks, setStacks] = useState<StackInfo[]>([])
  const [selectedStack, setSelectedStack] = useState<string>('')
  const [selectedSection, setSelectedSection] = useState<string>('full')
  const [prompt, setPrompt] = useState<PromptResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/stacks')
      .then((res) => res.json())
      .then((data) => {
        setStacks(data.stacks)
        setSelectedStack(data.default)
      })
  }, [])

  const loadPrompt = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedStack) params.set('stack', selectedStack)
      if (selectedSection !== 'full') params.set('section', selectedSection)

      const res = await fetch(`/api/test-prompts?${params}`)
      const data = await res.json()
      setPrompt(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedStack) {
      loadPrompt()
    }
  }, [selectedStack, selectedSection])

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold">Stack Explorer</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stack List */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Available Stacks</h2>
            <div className="space-y-3">
              {stacks.map((stack) => (
                <button
                  key={stack.id}
                  onClick={() => setSelectedStack(stack.id)}
                  className={`w-full p-4 border rounded-lg text-left transition ${
                    selectedStack === stack.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{stack.icon}</span>
                    <span className="font-semibold">{stack.name}</span>
                  </div>
                  <p className="text-sm text-gray-600">{stack.description}</p>
                  <div className="flex gap-2 mt-2 text-xs">
                    <span className="px-2 py-0.5 bg-gray-100 rounded">
                      {stack.language}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded">
                      {stack.framework}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded">
                      v{stack.version}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {stacks.length === 0 && (
              <p className="text-gray-600">Loading stacks...</p>
            )}

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Adding New Stacks</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Create handler in src/stacks/[stack-id]/</li>
                <li>Implement IStackHandler interface</li>
                <li>Import in src/stacks/index.ts</li>
                <li>Stack auto-registers on import</li>
              </ol>
            </div>
          </div>

          {/* Prompt Viewer */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Prompt Preview</h2>
              {prompt && (
                <span className="text-sm text-gray-600">
                  {prompt.promptLength.toLocaleString()} chars
                </span>
              )}
            </div>

            {/* Section Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={`px-3 py-1 text-sm rounded-full transition ${
                    selectedSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>

            {/* Prompt Content */}
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                  Loading...
                </div>
              )}
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-auto max-h-[600px] text-sm whitespace-pre-wrap">
                {prompt?.prompt || 'Select a stack to view prompts'}
              </pre>
            </div>

            {/* Copy Button */}
            {prompt && (
              <button
                onClick={() => navigator.clipboard.writeText(prompt.prompt)}
                className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              >
                Copy to Clipboard
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
