// Merge duplicate (city, state) towns into one canonical town.
//
// WHY: before the fix, the admin "Add town" path used a collision-suffixed slug, so
// adding a city+state that already existed created a SECOND town (e.g. storm-lake-ia
// AND storm-lake-ia-2). That splits a city's businesses/events across two towns and
// breaks search + location display. This merges each duplicate group back into one.
//
// Canonical town = the one whose slug already equals the deterministic slug
// `slugify("city-state")`; otherwise the oldest. Businesses + events are reassigned
// to it, zips/coords/tagline/hero are backfilled, and the extra towns are deleted.
//
// Usage:
//   node --env-file=.env.local scripts/dedupe-towns.mjs           (dry run — shows plan)
//   node --env-file=.env.local scripts/dedupe-towns.mjs --apply   (perform the merge)
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set (add it to .env.local).");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");

// Mirror of lib/utils.ts slugify — keep in sync.
function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
const townSlug = (city, state) => slugify(`${(city ?? "").trim()}-${(state ?? "").trim().toUpperCase().slice(0, 2)}`);

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
console.log(`Connected to ${mongoose.connection.name}. Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

const towns = await db.collection("towns").find({}).toArray();

// Group by canonical (city, state) key.
const groups = new Map();
for (const t of towns) {
  const key = townSlug(t.name, t.state);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(t);
}

let dupeGroups = 0;
let townsToDelete = 0;
let bizToMove = 0;
let evToMove = 0;

for (const [key, list] of groups) {
  if (list.length < 2) continue;
  dupeGroups++;

  // Canonical: prefer the town whose slug is already the clean canonical slug;
  // else the oldest (smallest _id ≈ earliest creation).
  const clean = list.find((t) => t.slug === key);
  const canonical =
    clean ??
    [...list].sort((a, b) => String(a._id).localeCompare(String(b._id)))[0];
  const dupes = list.filter((t) => String(t._id) !== String(canonical._id));

  console.log(`• ${canonical.name}, ${canonical.state}  (key: ${key})`);
  console.log(`    keep:   ${canonical.slug}  [${canonical._id}]`);
  for (const d of dupes) {
    const [nBiz, nEv] = await Promise.all([
      db.collection("businesses").countDocuments({ townId: d._id }),
      db.collection("events").countDocuments({ townId: d._id }),
    ]);
    bizToMove += nBiz;
    evToMove += nEv;
    townsToDelete++;
    console.log(`    merge:  ${d.slug}  [${d._id}]  → moves ${nBiz} business(es), ${nEv} event(s)`);

    if (APPLY) {
      await db.collection("businesses").updateMany({ townId: d._id }, { $set: { townId: canonical._id } });
      await db.collection("events").updateMany({ townId: d._id }, { $set: { townId: canonical._id } });
      // Union the dup's zips onto the canonical town.
      if (Array.isArray(d.zips) && d.zips.length) {
        await db.collection("towns").updateOne({ _id: canonical._id }, { $addToSet: { zips: { $each: d.zips } } });
      }
      // Backfill coords/tagline/hero if the canonical is missing them.
      const set = {};
      if (typeof canonical.lat !== "number" && typeof d.lat === "number") { set.lat = d.lat; set.lng = d.lng; }
      if (!canonical.tagline && d.tagline) set.tagline = d.tagline;
      if (!canonical.heroImageUrl && d.heroImageUrl) set.heroImageUrl = d.heroImageUrl;
      if (Object.keys(set).length) await db.collection("towns").updateOne({ _id: canonical._id }, { $set: set });
      await db.collection("towns").deleteOne({ _id: d._id });
    }
  }

  // Make sure the survivor carries the clean canonical slug.
  if (APPLY && canonical.slug !== key) {
    await db.collection("towns").updateOne({ _id: canonical._id }, { $set: { slug: key } });
    console.log(`    reslug: ${canonical.slug} → ${key}`);
  }
}

console.log(
  `\n${dupeGroups} duplicate group(s); ${townsToDelete} town(s) ${APPLY ? "merged + deleted" : "would be merged + deleted"}, ` +
    `${bizToMove} business(es) + ${evToMove} event(s) ${APPLY ? "reassigned" : "would be reassigned"}.`,
);
if (!APPLY && dupeGroups > 0) console.log("Re-run with --apply to perform the merge.");

await mongoose.disconnect();
process.exit(0);
