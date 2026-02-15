/**
 * ZenCode V2 - MongoDB Connection
 *
 * Connects to the same MongoDB as V1 for comparison testing
 */

import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable')
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseV2: MongooseCache | undefined
}

// Use different global key to avoid conflicts with V1 if running together
const cached: MongooseCache = global.mongooseV2 || { conn: null, promise: null }

if (!global.mongooseV2) {
  global.mongooseV2 = cached
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      readPreference: 'primaryPreferred' as const,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('[V2] Connected to MongoDB')
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export const connectToDatabase = connectDB
export default connectDB
