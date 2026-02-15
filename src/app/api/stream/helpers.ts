/**
 * ZenCode V2 - SSE Stream Helpers
 *
 * Shared utilities for Server-Sent Event API routes.
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { onProjectEvent, type ProjectEvent } from '@/lib/events'

/**
 * Create an SSE response for a project event stream.
 * Filters events by type and sends them as SSE messages.
 */
export function createSSEResponse(
  request: NextRequest,
  projectId: string,
  eventType: ProjectEvent['type']
): Response {
  // Verify auth
  const { userId } = auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMsg = `data: ${JSON.stringify({ type: eventType, status: 'connected', message: 'SSE connected', timestamp: new Date().toISOString() })}\n\n`
      controller.enqueue(encoder.encode(connectMsg))

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Subscribe to project events
      const unsubscribe = onProjectEvent(projectId, (event) => {
        if (event.type !== eventType) return

        try {
          const msg = `data: ${JSON.stringify({
            type: event.type,
            status: event.status,
            message: event.message,
            data: event.data,
            timestamp: event.timestamp.toISOString(),
          })}\n\n`
          controller.enqueue(encoder.encode(msg))

          // Close stream on completion or failure
          if (event.status === 'completed' || event.status === 'failed') {
            clearInterval(heartbeat)
            unsubscribe()
            controller.close()
          }
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      })

      // Clean up on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
