import { SellerSidebar } from "@/components/seller/SellerSidebar";

// Route protection is handled by proxy.ts (seller/admin only). This layout adds
// the dashboard chrome.
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <p className="mb-3 hidden font-serif text-lg font-semibold md:block">Seller</p>
          <SellerSidebar />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
