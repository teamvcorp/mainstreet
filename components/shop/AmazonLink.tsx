"use client";

/**
 * Outbound Amazon affiliate link. Logs the exit (for /admin/gaps), opens in a new
 * tab so MainStreet stays put, and uses rel="sponsored" per affiliate best practice.
 */
export function AmazonLink({
  href,
  query,
  className,
  children,
}: {
  href: string;
  query?: string;
  className?: string;
  children: React.ReactNode;
}) {
  function onClick() {
    void fetch("/api/search/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query ?? "", type: "amazon" }),
    });
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer sponsored" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
