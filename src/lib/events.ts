/**
 * ZenCode V2 - Event System
 *
 * In-process EventEmitter for real-time project events.
 * Used to push updates from services to SSE API routes.
 */

import { EventEmitter } from 'events'

// Increase max listeners to support many concurrent SSE connections
const emitter = new EventEmitter()
emitter.setMaxListeners(100)

export interface ProjectEvent {
  type: 'prd' | 'blueprint' | 'execution' | 'assembly'
  projectId: string
  status: 'started' | 'progress' | 'completed' | 'failed'
  message: string
  data?: Record<string, unknown>
  timestamp: Date
}

/**
 * Emit a project event. Services call this to push updates.
 */
export function emitProjectEvent(event: ProjectEvent): void {
  emitter.emit(`project:${event.projectId}`, event)
}

/**
 * Subscribe to project events. SSE routes call this.
 * Returns an unsubscribe function.
 */
export function onProjectEvent(
  projectId: string,
  callback: (event: ProjectEvent) => void
): () => void {
  const listener = (event: ProjectEvent) => callback(event)
  emitter.on(`project:${projectId}`, listener)
  return () => emitter.off(`project:${projectId}`, listener)
}
