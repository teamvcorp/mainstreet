import type { Metadata } from "next";
import Link from "next/link";
import { Store, CheckCircle2, Circle, Package, CreditCard, ExternalLink } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness, countActiveProducts } from "@/lib/seller";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Seller dashboard" };

export default async function SellerHome() {
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;

  if (!biz) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Store className="mx-auto size-10 text-accent" />
        <h1 className="mt-3 font-serif text-2xl font-semibold">Open your shop</h1>
        <p className="mx-auto mt-1 max-w-md text-muted-foreground">
          You don&apos;t have a storefront yet. It takes just a few minutes to get on MainStreet.
        </p>
        <Button asChild className="mt-5">
          <Link href="/onboard/start">Get started</Link>
        </Button>
      </div>
    );
  }

  const productCount = await countActiveProducts(biz._id.toString());
  const profileComplete = Boolean(biz.story || biz.logoUrl || biz.description);
  const payoutsReady = biz.stripeAccountActive;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{biz.name}</h1>
          <p className="text-muted-foreground">Your seller dashboard</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/store/${biz.slug}`} target="_blank">
            View storefront <ExternalLink className="size-4" />
          </Link>
        </Button>
      </header>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Package />} label="Active products" value={`${productCount} / ${biz.itemLimit}`} />
        <SummaryCard icon={<CreditCard />} label="Payouts" value={payoutsReady ? "Ready" : "Not set up"} />
        <SummaryCard icon={<Store />} label="Membership" value={biz.membershipTier} />
      </div>

      {/* Setup checklist */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold">Finish setting up</h2>
        <ul className="mt-4 space-y-3">
          <ChecklistItem done={profileComplete} label="Complete your store profile" href="/seller/store" cta="Edit profile" />
          <ChecklistItem done={payoutsReady} label="Connect payouts with Stripe" href="/seller/connect" cta="Set up payouts" />
          <ChecklistItem done={productCount > 0} label="Add your first product" href="/seller/products/new" cta="Add product" />
        </ul>
      </section>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-accent/15 text-accent [&_svg]:size-4">
        {icon}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-xl font-semibold capitalize">{value}</p>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  href,
  cta,
}: {
  done: boolean;
  label: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="size-5 text-success" />
        ) : (
          <Circle className="size-5 text-muted-foreground" />
        )}
        <span className={done ? "text-muted-foreground line-through" : ""}>{label}</span>
      </span>
      {!done && (
        <Button asChild size="sm" variant="outline">
          <Link href={href}>{cta}</Link>
        </Button>
      )}
    </li>
  );
}
