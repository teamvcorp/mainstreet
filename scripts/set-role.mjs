// Promote/demote a user's role. Useful to bootstrap the first admin and to test
// role gating. Usage:
//   node --env-file=.env.local scripts/set-role.mjs someone@example.com admin
//   node --env-file=.env.local scripts/set-role.mjs someone@example.com seller
import mongoose from "mongoose";

const [, , email, role] = process.argv;
const VALID = ["consumer", "seller", "admin"];

if (!email || !VALID.includes(role)) {
  console.error(`Usage: node --env-file=.env.local scripts/set-role.mjs <email> <${VALID.join("|")}>`);
  process.exit(1);
}
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set (add it to .env.local).");
  process.exit(1);
}

await mongoose.connect(uri);
const res = await mongoose.connection
  .collection("users")
  .updateOne({ email: email.toLowerCase() }, { $set: { role, updatedAt: new Date() } });

if (res.matchedCount === 0) console.error(`✗ No user found with email ${email}`);
else console.log(`✓ ${email} is now role="${role}"`);

await mongoose.disconnect();
process.exit(res.matchedCount === 0 ? 1 : 0);
