// Client-safe event category constants (no Mongoose import). Both the model and
// client components import from here so category enums stay in one place without
// dragging the DB driver into the browser bundle.
export const EVENT_CATEGORIES = [
  "festival",
  "sale",
  "sports",
  "fundraiser",
  "farmers_market",
  "music",
  "town_hall",
  "school",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  festival: "Festival",
  sale: "Sale",
  sports: "Sports",
  fundraiser: "Fundraiser",
  farmers_market: "Farmers Market",
  music: "Music",
  town_hall: "Town Hall",
  school: "School",
  other: "Other",
};
