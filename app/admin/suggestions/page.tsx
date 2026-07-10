import type { Metadata } from "next";
import { getSuggestionsList } from "@/lib/admin-stats";
import { SuggestionAdminList } from "@/components/admin/SuggestionAdminList";

export const metadata: Metadata = { title: "Suggestions" };

export default async function AdminSuggestionsPage() {
  const suggestions = await getSuggestionsList();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Business suggestions</h1>
      <p className="mb-6 text-muted-foreground">
        Businesses nominated by shoppers — reach out and track outreach status.
      </p>
      <SuggestionAdminList suggestions={suggestions} />
    </div>
  );
}
