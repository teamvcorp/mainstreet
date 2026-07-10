/**
 * Renders a JSON-LD <script>. Server component. Pass one or more schema.org
 * objects (from lib/seo). `dangerouslySetInnerHTML` is safe here: the content is
 * server-built structured data, never user-controlled raw HTML.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
