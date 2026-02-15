import { auth } from '@clerk/nextjs/server'
import { connectDB } from '@/lib/db/connection'

export async function createContext() {
  // Clerk v4 auth() is synchronous
  const { userId, orgId } = auth()

  // Connect to database
  await connectDB()

  return {
    userId: userId ?? null,
    orgId: orgId ?? null,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
