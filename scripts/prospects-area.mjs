// Queue / list prospect coverage areas directly against Mongo.
//
// WHY THIS EXISTS: the admin UI is the normal way to request an area, but the ingest pass and
// its framing are worth exercising before any UI exists, and an operator sometimes needs to
// queue an area without a browser session.
//
// Usage:
//   node --env-file=.env.local scripts/prospects-area.mjs                       (list areas)
//   node --env-file=.env.local scripts/prospects-area.mjs "Storm Lake"          (dry run)
//   node --env-file=.env.local scripts/prospects-area.mjs "Storm Lake" --apply  (queue it)
//   node --env-file=.env.local scripts/prospects-area.mjs 51601 --apply
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set (add it to .env.local).");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const HOME_STATE = (process.env.PROSPECTS_DEFAULT_STATE ?? "IA").toUpperCase();
const query = process.argv.slice(2).filter((a) => !a.startsWith("--"))[0];

// Mirror of lib/utils.ts slugify + lib/towns.ts townSlug — keep in sync.
// (Only these two are duplicated; all the prospect RULES stay in TypeScript.)
function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
const townSlug = (city, state) =>
  slugify(`${(city ?? "").trim()}-${(state ?? "").trim().toUpperCase().slice(0, 2)}`);

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
const areas = db.collection("prospectareas");

if (!query) {
  const all = await areas.find({}).sort({ lastRequestedAt: -1 }).toArray();
  console.log(`Connected to ${mongoose.connection.name}. ${all.length} area(s):\n`);
  for (const a of all) {
    console.log(
      `  ${a.status.padEnd(10)} ${a.key.padEnd(28)} prospects=${a.prospectCount ?? 0} scanned=${a.scannedCount ?? 0}${a.error ? `  [${a.error}]` : ""}`,
    );
  }
  await mongoose.disconnect();
  process.exit(0);
}

const digits = query.replace(/\D/g, "");
const isZip = /^\d{5}(-?\d{4})?$/.test(query.trim());
const doc = isZip
  ? { kind: "zip", key: `zip:${digits.slice(0, 5)}`, label: digits.slice(0, 5), state: HOME_STATE, zip5: digits.slice(0, 5) }
  : { kind: "city", key: `city:${townSlug(query, HOME_STATE)}`, label: `${query}, ${HOME_STATE}`, city: query, state: HOME_STATE };

console.log(`Connected to ${mongoose.connection.name}. Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
console.log(`Would queue: ${JSON.stringify(doc)}`);

if (APPLY) {
  const now = new Date();
  await areas.updateOne(
    { key: doc.key },
    {
      $set: { ...doc, status: "requested", lastRequestedAt: now, updatedAt: now },
      $setOnInsert: { aliases: [], prospectCount: 0, scannedCount: 0, createdAt: now },
      $inc: { requestCount: 1 },
    },
    { upsert: true },
  );
  console.log(`Queued ${doc.key}. Run the ingest pass to fill it.`);
}

await mongoose.disconnect();
