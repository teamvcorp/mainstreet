"use client";

import { useState } from "react";
import { Filter, AlertTriangle, Briefcase } from "lucide-react";
import type { ProspectRow } from "@/lib/prospects/queries";

/**
 * The lookup results table.
 *
 * The filter box narrows rows we ALREADY fetched, entirely client-side. That is deliberate: no
 * admin free-text ever reaches a Mongo query, so there is no regex-injection or ReDoS surface
 * on this path. Server-side narrowing is done by city/ZIP equality only.
 */
export function ProspectResults({ rows, truncated }: { rows: ProspectRow[]; truncated: boolean }) {
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) =>
        `${r.businessName} ${r.ownerName ?? ""} ${r.agentName ?? ""} ${r.email ?? ""} ${r.street1 ?? ""} ${r.city ?? ""} ${r.zip5 ?? ""} ${r.entityType ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
    : rows;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Filter className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter these results by name, contact, email, or street…"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      </div>

      {truncated && (
        <p className="mb-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <AlertTriangle className="mr-1 inline size-4" />
          Showing the first {rows.length} records. Export the CSV for the complete list.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact (registered agent)</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id} className={r.qualityOk ? "" : "opacity-60"}>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.businessName}</div>
                  {r.entityType && (
                    <div className="text-xs text-muted-foreground">{r.entityType}</div>
                  )}
                </td>

                <td className="px-4 py-3">
                  {/*
                    Labelled "registered agent", never "owner". Iowa's registered agent is a
                    service-of-process designee: usually the owner for a one-person LLC, but
                    just as often the company's attorney, bank, or a commercial agent service.
                  */}
                  {r.agentIsCommercial ? (
                    <div>
                      <span className="text-muted-foreground">{r.agentName ?? "—"}</span>
                      <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-foreground">
                        <Briefcase className="size-3" /> Agent service
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span>{r.ownerName ?? r.agentName ?? "—"}</span>
                      {r.ownerNameSource === "manual" && (
                        <div className="text-xs text-muted-foreground">confirmed manually</div>
                      )}
                    </div>
                  )}
                </td>

                <td className="px-4 py-3">
                  {r.email ? (
                    <a href={`mailto:${r.email}`} className="hover:underline">
                      {r.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  {r.street1 ? (
                    <div>
                      <div>{r.street1}</div>
                      {r.street2 && <div>{r.street2}</div>}
                      <div className="text-xs text-muted-foreground">
                        {[r.city, r.state].filter(Boolean).join(", ")} {r.zip5 ?? ""}
                      </div>
                      {r.addressIsAgent && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-foreground">
                          <AlertTriangle className="size-3" /> Agent address
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.mailable && (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        Mailable
                      </span>
                    )}
                    {r.emailable && (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        Emailable
                      </span>
                    )}
                    {r.suppressed && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                        Opted out
                      </span>
                    )}
                    {!r.qualityOk && (
                      <span
                        className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive"
                        title={r.qualityIssues.join(", ")}
                      >
                        Filtered out
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No prospects match that filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
