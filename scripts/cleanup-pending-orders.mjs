// Delete stale abandoned "pending" orders (+ their order items).
//
// WHY: reaching /checkout creates a pending Order server-side. If the buyer never
// completes the embedded payment, that order stays `pending` forever — an abandoned
// cart, not a real order. Paid orders flip to `paid` via the webhook. These pending
// rows are now hidden from seller/buyer lists; this clears the existing ones from the
// DB so they don't accumulate.
//
// Only deletes pending orders OLDER than the cutoff (default 60 min) so an in-flight
// checkout is never removed mid-payment.
//
// Usage:
//   node --env-file=.env.local scripts/cleanup-pending-orders.mjs                 (dry run)
//   node --env-file=.env.local scripts/cleanup-pending-orders.mjs --apply         (delete)
//   node --env-file=.env.local scripts/cleanup-pending-orders.mjs --apply --minutes=1440
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set (add it to .env.local).");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const minutesArg = process.argv.find((a) => a.startsWith("--minutes="));
const MINUTES = minutesArg ? Math.max(0, parseInt(minutesArg.split("=")[1], 10) || 0) : 60;

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
const cutoff = new Date(Date.now() - MINUTES * 60 * 1000);
console.log(
  `Connected to ${mongoose.connection.name}. Mode: ${APPLY ? "APPLY" : "DRY RUN"}. ` +
    `Targeting pending orders created before ${cutoff.toISOString()} (>${MINUTES} min old).\n`,
);

const stale = await db
  .collection("orders")
  .find({ status: "pending", createdAt: { $lt: cutoff } })
  .project({ _id: 1, businessId: 1, totalCents: 1, createdAt: 1, stripePaymentIntentId: 1 })
  .toArray();

if (stale.length === 0) {
  console.log("No stale pending orders found. Nothing to do.");
  await mongoose.disconnect();
  process.exit(0);
}

for (const o of stale) {
  const items = await db.collection("orderitems").countDocuments({ orderId: o._id });
  console.log(
    `  ${String(o._id)}  total=${o.totalCents}  items=${items}  PI=${o.stripePaymentIntentId ? "yes" : "—"}  ${new Date(o.createdAt).toISOString()}`,
  );
}

const ids = stale.map((o) => o._id);
if (APPLY) {
  const itemsRes = await db.collection("orderitems").deleteMany({ orderId: { $in: ids } });
  const ordersRes = await db.collection("orders").deleteMany({ _id: { $in: ids } });
  console.log(`\nDeleted ${ordersRes.deletedCount} pending order(s) and ${itemsRes.deletedCount} order item(s).`);
} else {
  console.log(`\n${stale.length} pending order(s) would be deleted. Re-run with --apply to remove them.`);
}

await mongoose.disconnect();
process.exit(0);
