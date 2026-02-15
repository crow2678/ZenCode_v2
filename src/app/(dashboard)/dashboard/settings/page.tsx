'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const settingsQuery = trpc.orgSettings.get.useQuery()
  const updateMutation = trpc.orgSettings.update.useMutation()
  const testKeyMutation = trpc.orgSettings.testKey.useMutation()

  const handleTestKey = async () => {
    if (!apiKey) return
    setTestResult(null)
    const result = await testKeyMutation.mutateAsync({ apiKey })
    setTestResult(result)
  }

  const handleSave = async () => {
    if (!apiKey) return
    setSaving(true)
    try {
      await updateMutation.mutateAsync({ anthropicApiKey: apiKey })
      setApiKey('')
      settingsQuery.refetch()
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    try {
      await updateMutation.mutateAsync({ clearApiKey: true })
      setApiKey('')
      setTestResult(null)
      settingsQuery.refetch()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Anthropic API Key</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Provide your own Anthropic API key. This key will be encrypted and stored securely.
            If not set, the platform default key will be used.
          </p>

          {settingsQuery.data?.hasApiKey && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span>Custom API key is configured</span>
              <button
                onClick={handleClear}
                disabled={saving}
                className="ml-auto text-red-500 hover:text-red-700 text-xs"
              >
                Remove key
              </button>
            </div>
          )}

          <div className="space-y-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            />

            <div className="flex gap-2">
              <button
                onClick={handleTestKey}
                disabled={!apiKey || testKeyMutation.isLoading}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                {testKeyMutation.isLoading ? 'Testing...' : 'Test Key'}
              </button>
              <button
                onClick={handleSave}
                disabled={!apiKey || saving}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Key'}
              </button>
            </div>

            {testResult && (
              <div className={`text-sm p-2 rounded ${testResult.valid ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
                {testResult.valid ? 'Key is valid' : `Invalid: ${testResult.message}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
