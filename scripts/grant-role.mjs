// Dev helper to grant an admin role and/or the paid seller plan (for testing
// events, which require the $150/yr plan, and admin approval screens).
//
// Usage:
//   node --env-file=.env.local scripts/grant-role.mjs you@example.com --admin
//   node --env-file=.env.local scripts/grant-role.mjs you@example.com --plan
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set (add it to .env.local).");
  process.exit(1);
}

const [, , emailArg, ...flags] = process.argv;
if (!emailArg) {
  console.error("Usage: node --env-file=.env.local scripts/grant-role.mjs <email> [--admin] [--plan]");
  process.exit(1);
}
const email = emailArg.toLowerCase();

await mongoose.connect(uri);
const users = mongoose.connection.collection("users");
const businesses = mongoose.connection.collection("businesses");

const user = await users.findOne({ email });
if (!user) {
  console.error(`✗ No user found with email ${email}. Sign up first.`);
  await mongoose.disconnect();
  process.exit(1);
}

if (flags.includes("--admin")) {
  await users.updateOne({ _id: user._id }, { $set: { role: "admin" } });
  console.log("✓ role = admin (sign out/in or refresh session to apply)");
}

if (flags.includes("--plan")) {
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const r = await businesses.updateOne(
    { ownerId: user._id },
    { $set: { membershipTier: "seller", membershipExpiresAt: expiresAt } },
  );
  console.log(
    r.matchedCount
      ? "✓ business plan = seller (active 1 year) — events unlocked"
      : "✗ no business found for this user (create a shop first)",
  );
}

if (!flags.includes("--admin") && !flags.includes("--plan")) {
  console.log("Nothing to do. Pass --admin and/or --plan.");
}

await mongoose.disconnect();
process.exit(0);
