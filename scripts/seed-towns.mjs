// Seed a dozen real small-town America towns so the /towns finder has data.
// Usage: node --env-file=.env.local scripts/seed-towns.mjs
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set (add it to .env.local).");
  process.exit(1);
}

const TOWNS = [
  { name: "Pella", slug: "pella", state: "IA", county: "Marion", population: 10500, lat: 41.4089, lng: -92.9163, tagline: "A little touch of Holland in the heartland." },
  { name: "Decorah", slug: "decorah", state: "IA", county: "Winneshiek", population: 7800, lat: 43.3033, lng: -91.7857, tagline: "Bluffs, trout streams, and Nordic charm." },
  { name: "Galena", slug: "galena", state: "IL", county: "Jo Daviess", population: 3200, lat: 42.4167, lng: -90.429, tagline: "Historic Main Street in the hills." },
  { name: "Stillwater", slug: "stillwater", state: "MN", county: "Washington", population: 19000, lat: 45.0564, lng: -92.806, tagline: "Birthplace of Minnesota on the St. Croix." },
  { name: "Bardstown", slug: "bardstown", state: "KY", county: "Nelson", population: 13500, lat: 37.8092, lng: -85.4669, tagline: "The Bourbon Capital of the World." },
  { name: "Fredericksburg", slug: "fredericksburg", state: "TX", county: "Gillespie", population: 11000, lat: 30.2752, lng: -98.872, tagline: "Hill Country wine, peaches, and German roots." },
  { name: "Jim Thorpe", slug: "jim-thorpe", state: "PA", county: "Carbon", population: 4700, lat: 40.8698, lng: -75.7324, tagline: "The Switzerland of America." },
  { name: "Bisbee", slug: "bisbee", state: "AZ", county: "Cochise", population: 5000, lat: 31.4482, lng: -109.9284, tagline: "An old mining town turned artist haven." },
  { name: "Marfa", slug: "marfa", state: "TX", county: "Presidio", population: 1700, lat: 30.3096, lng: -104.0206, tagline: "High-desert art and mystery lights." },
  { name: "Eureka Springs", slug: "eureka-springs", state: "AR", county: "Carroll", population: 2100, lat: 36.4015, lng: -93.7377, tagline: "A Victorian village in the Ozarks." },
  { name: "Woodstock", slug: "woodstock", state: "VT", county: "Windsor", population: 3000, lat: 43.6242, lng: -72.5187, tagline: "Quintessential New England, every season." },
  { name: "Mackinac Island", slug: "mackinac-island", state: "MI", county: "Mackinac", population: 600, lat: 45.8492, lng: -84.6189, tagline: "No cars, all charm, since forever." },
];

await mongoose.connect(uri);
const col = mongoose.connection.collection("towns");
const now = new Date();

for (const t of TOWNS) {
  await col.updateOne(
    { slug: t.slug },
    {
      $set: {
        ...t,
        location: { type: "Point", coordinates: [t.lng, t.lat] },
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

await col.createIndex({ location: "2dsphere" });
console.log(`✓ Seeded ${TOWNS.length} towns and ensured 2dsphere index.`);
await mongoose.disconnect();
process.exit(0);
