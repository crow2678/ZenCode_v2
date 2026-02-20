import { NextResponse } from 'next/server'
import { StackFactory } from '@/stacks'

export async function GET() {
  // Check stacks
  const stacks = StackFactory.listStacks()
  const defaultStack = StackFactory.getDefault()

  // Check database
  let dbConnected = false
  try {
    const { connectDB } = await import('@/lib/db/connection')
    await connectDB()
    dbConnected = true
  } catch {
    // Connection failed — status will show connected: false
  }

  return NextResponse.json({
    status: 'ok',
    version: 'v2',
    port: 3001,
    timestamp: new Date().toISOString(),
    stacks: {
      registered: stacks.length,
      default: defaultStack.id,
      available: stacks.map((s) => s.id),
    },
    database: {
      connected: dbConnected,
    },
  })
}
