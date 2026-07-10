/**
 * English UI copy (source of truth). Keys are referenced as dot paths, e.g.
 * t("nav.towns"). Only UI/copy lives here — NEVER user/business data.
 */
const en = {
  nav: {
    towns: "Towns",
    events: "Events",
    sell: "Sell",
    signIn: "Sign in",
    search: "Search local businesses, products, events…",
  },
  footer: {
    tagline: "America's hometown digital platform. Shop local, support your neighbors.",
    vacorpPrefix: "A",
    vacorpSuffix: "program — advancing equality & sustainability in housing, education, and healthcare.",
    explore: "Explore",
    forBusiness: "For Business",
    company: "Company",
    towns: "Towns",
    events: "Events",
    search: "Search",
    sell: "Sell on MainStreet",
    membership: "Membership",
    signIn: "Sign in",
    about: "About",
    contact: "Contact",
    sister: "Sister programs in the VA Corp family",
    rights: "All rights reserved.",
    amazonTitle: "Can't find it locally?",
    amazonBody: "Shop our Amazon store — every purchase helps fund this platform and the small businesses on it.",
    amazonCta: "Browse the Amazon store",
    amazonShort: "Amazon store",
  },
  home: {
    badge: "America's Hometown Digital Platform",
    h1: "Your whole town, on one Main Street.",
    subtitle:
      "Discover local shops, buy from your neighbors, and keep up with everything happening in town — all in one trustworthy place.",
    searchPlaceholder: 'Try "bakery in Royal, Iowa"',
    search: "Search",
    exploreTowns: "Explore towns",
    sellShop: "Sell your shop",
    sectionTitle: "Everything a hometown needs",
    sectionSub:
      "A directory, real storefronts, built-in shipping, a community events board, and a public page for every town.",
    f1t: "Local Directory",
    f1b: "Find every shop in town, searchable by category, product, and place — never the open internet.",
    f2t: "Real Storefronts",
    f2b: "Each business gets a beautiful online store with its story, hours, and products.",
    f3t: "Simple Shipping",
    f3b: "One flat program handles labels and delivery, so small shops can ship like the big guys.",
    f4t: "Community Events",
    f4b: "Festivals, markets, games, and fundraisers — the town square, online.",
    f5t: "Town Pages",
    f5b: "A free public front door for every town — the modern Chamber of Commerce.",
    f6t: "Zero In-Store Cuts",
    f6b: "A low annual fee, no commission on in-store sales. Built for Main Street, not against it.",
  },
  lang: { label: "Language" },
} as const;

export default en;
