# Iowa SOS — Active Iowa Business Entities (Iowa Data Hub dataset 554)

Vendored contract for the prospect-list data source. **Verified live on 2026-09-17.**
Integration decisions live in `docs/prospects.md`; this file is the raw contract only.

> Re-verify with the `curl` recipes at the bottom before assuming any of this still holds.
> The Iowa portal already migrated once (Socrata `data.iowa.gov/resource/ez5t-3qay.json` → the
> current Iowa Data Hub), and that migration broke every previously published endpoint.

---

## 1. Endpoints

| What | URL |
|---|---|
| Rows (NDJSON, zipped) | `https://idh-be.iowa.gov/api/v1/datasets/554/rows.json` |
| Rows (CSV, zipped) | `https://idh-be.iowa.gov/api/v1/datasets/554/rows.csv` |
| Column schema | `https://idh-be.iowa.gov/api/v1/datasets/554/columns.json` |
| Dataset metadata | `https://idh-be.iowa.gov/api/v1/datasets/554` |
| Landing page | `https://data.iowa.gov/catalog/dataset/554` |

All of these return **HTTP 303** and redirect to a **signed Google Cloud Storage URL**
(`storage.googleapis.com/iowa-datahub-prod/...`, `X-Goog-Expires=21599`, i.e. ~6 h).
**You must follow redirects** (`curl -L`, or `fetch` default).

Publisher: Office of the Secretary of State, State of Iowa.
**Licence: CC-BY 4.0** — <https://creativecommons.org/licenses/by/4.0/>.
Attribution is a licence obligation, not a courtesy. See `docs/prospects.md` for where we render it.

### There is NO queryable API

`?limit=2`, `?$limit=2` and friends are **ignored** — you always get the entire dataset.
The Iowa SOS also runs a separate live API at `https://api.sos.iowa.gov` (swagger at
`/swagger/docs/v1`), but it only exposes `GET /BusinessEntity/id/{n}` and
`/BusinessEntity/batch/{n}` — **lookup by entity ID only, no city or ZIP query** — and requires a
paid subscription token (quoted at $2,400/yr monthly / $10,400/yr weekly). It is useless for
city/ZIP lookup. Do not revisit this; it was checked.

---

## 2. Response framing (the part that matters)

```
Content-Type: application/zip
content-disposition: attachment; filename=active_iowa_business_entities_554_rows.zip
transfer-encoding: chunked
x-content-type-options: nosniff
cf-cache-status: DYNAMIC
```

| Header | Status | Consequence for us |
|---|---|---|
| `Content-Length` | **ABSENT** (chunked) | No progress %, no byte-count completeness check |
| `Accept-Ranges` | **ABSENT** | No resume, no sharding. `curl -r 0-200` downloads all 205 MB |
| `ETag` | **ABSENT** | No conditional GET |
| `Last-Modified` | **ABSENT** | No cheap change detection |

The archive is **generated per request** (`cf-cache-status: DYNAMIC`, and the ZIP's DOS mtime decodes
to the current date on every fetch). There is therefore **no way to tell whether the data changed
without downloading all of it.** Budget a full ~205 MB pull for every run and schedule accordingly.

### ZIP local header — observed bytes

```
50 4b 03 04 | 2d 00 | 08 00 | 00 00 | d5 62 31 5d | 00000000 | ffffffff | ffffffff | 2b 00 | 14 00
^signature    ^ver     ^flags  ^method  ^mtime/date  ^crc32     ^compSize  ^uncompSz   ^fnLen ^exLen
```

| Field | Offset | Value | Meaning |
|---|---|---|---|
| signature | 0 | `0x04034b50` | `PK\x03\x04` local file header |
| version needed | 4 | 45 (`0x2d`) | **Zip64** (4.5) |
| general purpose flags | 6 | `0x0008` | **bit 3 set** — CRC and sizes are 0 here, and appear in a *trailing data descriptor* |
| **compression method** | **8** | **0** | **STORED — uncompressed.** Payload is raw bytes, no inflate needed |
| crc32 / sizes | 14,18,22 | 0 / `0xFFFFFFFF` | Unknown here (bit 3) + Zip64 markers |
| filename length | **26** | 43 | `active_iowa_business_entities_554_rows.json` |
| extra length | **28** | 20 | Zip64 extended info, id `0x0001`, size 16, **both sizes zero** — the extra field tells you nothing |

**Payload starts at `30 + fnLen + exLen` = 93.**
Derive it from bytes 26-29 at runtime. **Never hardcode 93** — a filename change shifts it.

Single entry. Not encrypted. After the payload come ~150 bytes of trailer: data descriptor
(`PK\x07\x08` + crc32 + two 8-byte Zip64 sizes), central directory, Zip64 EOCD, EOCD.
Those bytes contain `0x0a` and **will corrupt the final NDJSON line** if fed to a line splitter.

### Payload

Raw **NDJSON** — one JSON object per line, UTF-8, **344,639 lines**, 205,319,306 bytes total
(payload 205,319,078 + 93-byte header + 135-byte trailer). All string values are **UPPERCASE**.

> **Row count, measured — not the number you will find quoted.** Public sources say the Iowa SOS
> holds "over 600,000 business entities"; that counts **inactive** ones too. This dataset is
> ACTIVE only and held **344,639** rows on 2026-09-17. Do not use 600k as a sanity threshold —
> it will reject every healthy pass. Prefer the exact check below.

---

## 3. Columns (23)

From `columns.json`, verbatim:

```
corp_number        STRING     legal_name        STRING     corporation_type  STRING
effective_date     DATE       registered_agent  STRING
ra_address_1       STRING     ra_address_2      STRING     ra_city           STRING
ra_state           STRING     ra_zip            STRING
ra_latitude        FLOAT      ra_longitude      FLOAT      ra_location       GEOGRAPHY
home_office        STRING
ho_address_1       STRING     ho_address_2      STRING     ho_city           STRING
ho_state           STRING     ho_zip            STRING     ho_country        STRING
ho_latitude        FLOAT      ho_longitude      FLOAT      ho_location       GEOGRAPHY
```

`ra_*` = registered agent. `ho_*` = home/principal office.
Lat/lng are **pre-geocoded by the publisher** (their transform SQL calls an internal `geocode()` UDF
on both addresses), so we do not need to spend Google Geocoding quota on these rows.

### Sample row (real, unmodified)

```json
{"corp_number":"662502","legal_name":"!MPACT LTD CO","corporation_type":"DOMESTIC LIMITED LIABILITY COMPANY","effective_date":"2021-03-26","registered_agent":"ROB VILLARS","ra_address_1":"312 CARTER ST","ra_city":"SHENANDOAH","ra_state":"IA","ra_zip":"51601","ra_latitude":40.76635299,"ra_longitude":-95.36187802,"ra_location":"POINT(-95.36187802 40.76635299)","ho_address_1":"312 EAST CARTER STREET","ho_city":"SHENANDOAH","ho_state":"IA","ho_zip":"51601","ho_country":"USA","ho_latitude":40.76635299,"ho_longitude":-95.36187802,"ho_location":"POINT(-95.36187802 40.76635299)"}
```

Note `ra_address_1: "312 CARTER ST"` vs `ho_address_1: "312 EAST CARTER STREET"` — **the same
building written two ways.** This is why `normalizeStreet()` with a USPS suffix map is mandatory
rather than nice-to-have; without it, address dedupe and address-based opt-out are both broken.

### NOT in this dataset

**No email. No phone. No website.** Those must come from manual entry or CSV import.

---

## 4. Publisher caveats (quoted from the dataset description)

> "Sole proprietorships, partnerships and other select business structures are not required to
> register with the Iowa Secretary of State and would not be available in this dataset."

> "Home office information is not always available when business entities first file with the
> Secretary of State."

Practical impact: a meaningful share of true main-street businesses — many single-owner shops —
**will simply not appear**, and a share of the rows that do appear have only a registered-agent
address. This is the hard ceiling on coverage.

**`registered_agent` is NOT the owner.** It is a service-of-process designee. For a one-person LLC
it is usually the owner; it is just as often the company's attorney, accountant, bank, or a
commercial agent service (CT Corporation, Registered Agents Inc, ...). See `lib/prospects/agents.ts`.

---

## 5. Measured performance (2026-09-17)

| Metric | First probe | Full ingest passes (5 runs) |
|---|---|---|
| TTFB (headers) | ~5.7 s | ~5 s |
| Sustained body rate | ~1.76 MiB/s | **~10-14 MiB/s** |
| Full pass wall-clock | ~120 s (projected) | **15-23 s (measured, incl. parse + Mongo writes)** |

**Throughput varies by roughly an order of magnitude between requests.** The slow 1.76 MiB/s
probe and the fast ~14 MiB/s ingest runs hit the same endpoint minutes apart. The archive is
generated per request, so treat the slow figure as the planning number and the fast one as luck.

Against a 300 s Vercel `maxDuration`, the fast case finishes in under 10% of the budget and the
slow case in ~40%. There is still **no resume capability**, which is why
`lib/prospects/ingest.ts` commits as it goes and treats a timeout as `partial` rather than
failure — a pass that dies at 80% keeps the 80% it already wrote.

### Completeness check (use this, not a line count)

The trailing Zip64 data descriptor carries the entry's uncompressed size, which gives an exact
byte-level check: `declaredUncompressedSize === payloadBytes`. Verified true on every complete
pass. This is the only reliable completeness signal, because there is no `Content-Length`.

---

## 6. Re-verification recipes

```bash
# Schema (follow redirects — the endpoint 303s to signed GCS)
curl -sSL "https://idh-be.iowa.gov/api/v1/datasets/554/columns.json"

# Header framing: bytes 8-9 are the compression method (0 = STORED, 8 = DEFLATE),
# bytes 26-29 are filename/extra lengths.
curl -sSL -r 0-200 "https://idh-be.iowa.gov/api/v1/datasets/554/rows.json" | od -An -tu1 -N 32

# Confirm Range is still ignored: this prints the FULL size, not 201.
curl -sSL -r 0-200 "https://idh-be.iowa.gov/api/v1/datasets/554/rows.json" -o /dev/null -w "downloaded=%{size_download}\n"

# Dataset metadata (description, caveats, transform SQL)
curl -sSL "https://idh-be.iowa.gov/api/v1/datasets/554" | head -c 3000
```

In-repo: `node --env-file=.env.local scripts/ingest-iowa-sos.mjs --area city:storm-lake-ia`
is a read-only diagnostic that prints the framing, line count, and match count without writing.
