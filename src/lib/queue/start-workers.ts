/**
 * ZenCode V2 - Worker Entry Point
 *
 * Standalone script to start BullMQ workers.
 * Run with: npx tsx src/lib/queue/start-workers.ts
 */

import { createWorkers } from './workers'

async function main() {
  console.log('[Workers] Starting worker process...')
  await createWorkers()
  console.log('[Workers] Workers are running. Press Ctrl+C to stop.')
}

main().catch((error) => {
  console.error('[Workers] Fatal error:', error)
  process.exit(1)
})
