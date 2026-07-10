// Quick MongoDB Atlas connectivity check.
// Usage: add MONGODB_URI to .env.local, then run: node --env-file=.env.local scripts/check-db.mjs
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const admin = mongoose.connection.db.admin();
  const info = await admin.ping();
  console.log("✓ Connected to MongoDB Atlas. Ping:", info);
  console.log("  Database:", mongoose.connection.name);
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error("✗ Connection failed:", err.message);
  process.exit(1);
}
