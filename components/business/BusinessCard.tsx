import Link from "next/link";
import Image from "next/image";
import { Store } from "lucide-react";

export interface BusinessCardData {
  slug: string;
  name: string;
  category?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

export function BusinessCard({ business }: { business: BusinessCardData }) {
  return (
    <Link
      href={`/store/${business.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
        {business.bannerUrl ? (
          <Image
            src={business.bannerUrl}
            alt={business.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary to-muted text-muted-foreground">
            <Store className="size-8 opacity-70" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-1 items-start gap-3 p-4">
        <div className="relative -mt-8 size-12 shrink-0 overflow-hidden rounded-lg border-2 border-card bg-card shadow-sm">
          {business.logoUrl ? (
            <Image src={business.logoUrl} alt="" fill sizes="48px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
              <Store className="size-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-serif text-base font-semibold">{business.name}</h3>
          {business.category && (
            <p className="text-xs font-medium uppercase tracking-wide text-accent-foreground/80">
              {business.category}
            </p>
          )}
          {business.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{business.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
