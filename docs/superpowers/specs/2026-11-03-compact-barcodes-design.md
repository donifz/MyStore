# Compact barcodes for 30x20 mm labels

**Intent:** Give every current and future MyStore variant an eight-digit, scan-friendly numeric barcode for 30 x 20 mm labels while preserving legacy barcodes, linked stock, prices, and immutable sales history.

**Approach:** Add an immutable `short_barcode` to variants. Backfill all shops by PostgreSQL migration; preserve `barcode`. For user-entered codes, preserve them as the original barcode. For newly auto-generated codes, use the short barcode as the primary barcode too. Both scan paths resolve to the same variant within its shop. Use Code 128C for eight-digit codes and legacy Code 128B otherwise.

**Safety:** Globally unique short codes from a sequence; skip candidates equal to primary barcodes. Reject manually supplied values matching another variant's short code. Do not rewrite sale lines, stock movements, or old identifiers. Preserve printer label dimensions and quiet zones.

**Non-goals:** Barcode changes in sales history, EAN/GS1 registration, rewriting SKU, platform-wide lookup without shop context, or hardware driver changes.

**Success:** Existing and new variants have short codes; old labels still scan, new labels use the short code; search and scan work with either; every 30 x 20 mm short code prints at Code 128C density; tests cover collisions and imports.
