/**
 * SSE endpoint for assembly progress.
 * GET /api/stream/assembly?projectId=xxx
 */

import { NextRequest } from 'next/server'
import { createSSEResponse } from '../helpers'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return new Response('Missing projectId', { status: 400 })
  }
  return createSSEResponse(request, projectId, 'assembly')
}
