import type { Metadata } from "next";
import { TownFinder } from "@/components/towns/TownFinder";
import { getTowns, type TownListItem } from "@/lib/towns";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Find your town",
  description:
    "Browse small-town America on MainStreet. Share your location or enter a ZIP code to discover local shops and events near you.",
  alternates: { canonical: "/towns" },
};

// Directory data changes as businesses join — revalidate periodically for SEO
// while keeping the page server-rendered.
export const revalidate = 300;

export default async function TownsPage() {
  // Server-render an initial list for SEO; the finder replaces it on interaction.
  // If the DB isn't configured yet (dev), degrade gracefully to an empty list.
  let initialTowns: TownListItem[] = [];
  try {
    initialTowns = await getTowns({ limit: 60 });
  } catch (err) {
    console.error("TownsPage: could not load towns —", err);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Towns", path: "/towns" },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Towns", path: "/towns" },
        ]}
      />
      <header className="mb-8 mt-3 max-w-2xl">
        <h1 className="font-serif text-4xl font-semibold">Find your town</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Every town with a local shop or event has a home here. Share your location or drop in a
          ZIP code, then widen the circle to explore nearby communities.
        </p>
      </header>

      <TownFinder initialTowns={initialTowns} />
    </div>
  );
}
