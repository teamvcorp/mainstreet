import mongoose from "mongoose";

/**
 * MongoDB connection singleton for a serverless environment (Vercel).
 *
 * WHY a cached global: on Vercel each API/route invocation can reuse a "warm"
 * Node container. Without caching we would open a brand-new connection pool on
 * every request and quickly exhaust Atlas connection limits. We stash the live
 * connection (and the in-flight connect promise) on `globalThis` so repeated
 * calls in the same container share one pool.
 *
 * Env is read INSIDE the function (not at module top) so that merely importing
 * this file never throws — important for `next build`, which imports modules
 * without necessarily having a database configured.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// eslint-disable-next-line no-var
declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global._mongooseCache ?? (global._mongooseCache = { conn: null, promise: null });

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and add your Atlas connection string.",
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false, // fail fast instead of queueing when disconnected
      maxPoolSize: 10, // reasonable ceiling for serverless
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
