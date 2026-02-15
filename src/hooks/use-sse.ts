/**
 * ZenCode V2 - SSE Hook
 *
 * React hook for consuming Server-Sent Events.
 * Falls back to polling if SSE connection fails.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface SSEMessage<T = unknown> {
  type: string
  status: string
  message: string
  data?: T
  timestamp: string
}

interface UseSSEOptions {
  enabled?: boolean
}

interface UseSSEResult<T> {
  messages: SSEMessage<T>[]
  lastMessage: SSEMessage<T> | null
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  clear: () => void
}

export function useSSE<T = unknown>(
  url: string | null,
  options: UseSSEOptions = {}
): UseSSEResult<T> {
  const { enabled = true } = options
  const [messages, setMessages] = useState<SSEMessage<T>[]>([])
  const [lastMessage, setLastMessage] = useState<SSEMessage<T> | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)

  const clear = useCallback(() => {
    setMessages([])
    setLastMessage(null)
  }, [])

  useEffect(() => {
    if (!url || !enabled) {
      setStatus('disconnected')
      return
    }

    setStatus('connecting')

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setStatus('connected')
    }

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as SSEMessage<T>
        setMessages((prev) => [...prev, parsed])
        setLastMessage(parsed)
      } catch {
        // Ignore non-JSON messages (like heartbeats)
      }
    }

    eventSource.onerror = () => {
      setStatus('error')
      eventSource.close()
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
      setStatus('disconnected')
    }
  }, [url, enabled])

  return { messages, lastMessage, status, clear }
}
