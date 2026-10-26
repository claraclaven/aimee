// ---------------------------------------------------------------------------
// Real Zetaris REST client. Participant Guide §1.9 / §4.24 (smoke_test).
// Sends Lightning SQL to the local Zetaris instance and returns rows.
//
// Contract (from the guide):
//   POST {restUrl}/sql-editor/sqls/run
//   Headers: Authorization: Bearer <apiKey>, X-Org-ID: <org>, X-Request-ID: <uuid>
//   Body:    { queryId: <uuid>, sql: "...", source: "SqlEditor", limit: N }
//
// Server-side only (uses the API key). Never import into client components.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { zetarisConfig } from "./config";

export interface ZetarisRow {
  [column: string]: unknown;
}

export interface ZetarisRunResult {
  columns: string[];
  rows: ZetarisRow[];
  raw: unknown;
}

// Short default so a slow Zetaris engine never blocks the UI — callers fall
// back to bundled data almost instantly. Override per-call when needed.
const TIMEOUT_MS = Number(process.env.ZETARIS_TIMEOUT_MS ?? 5000);

/**
 * Execute a single SQL statement against Zetaris over REST.
 * Throws on non-OK responses (or timeout) so callers can fall back fast.
 */
export async function runSql(
  sql: string,
  limit = 500,
  timeoutMs = TIMEOUT_MS,
): Promise<ZetarisRunResult> {
  const url = `${zetarisConfig.restUrl}/sql-editor/sqls/run`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${zetarisConfig.apiKey}`,
      "X-Org-ID": zetarisConfig.orgId,
      "X-Request-ID": randomUUID(),
    },
    body: JSON.stringify({
      queryId: randomUUID(),
      sql,
      source: "SqlEditor",
      limit,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Zetaris SQL error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as unknown;
  return normalizeResult(data);
}

/**
 * Zetaris returns results in a few possible shapes depending on version.
 * Normalize to { columns, rows } where each row is a column->value object.
 */
function normalizeResult(data: unknown): ZetarisRunResult {
  const d = (data ?? {}) as Record<string, unknown>;

  // Zetaris Lightning shape: { headers: ["n"], data: [["1"]], total, timeUsed }
  if (Array.isArray(d.headers) && Array.isArray(d.data)) {
    const columnNames = (d.headers as unknown[]).map((h) => String(h));
    const rows: ZetarisRow[] = (d.data as unknown[]).map((r) => {
      const obj: ZetarisRow = {};
      if (Array.isArray(r)) {
        r.forEach((v, i) => {
          obj[columnNames[i] ?? `col${i}`] = v;
        });
      }
      return obj;
    });
    return { columns: columnNames, rows, raw: data };
  }

  // Fallback: other possible shapes { columns:[...], rows:[[...]] }.
  const payload = (d?.data ?? d?.result ?? d) as Record<string, unknown>;
  const cols = (payload?.columns ?? payload?.schema ?? []) as unknown[];
  const columnNames = cols
    .map((c) =>
      typeof c === "string"
        ? c
        : ((c as Record<string, unknown>)?.name as string) ?? "",
    )
    .filter(Boolean);

  const rawRows = (payload?.rows ?? payload?.data ?? []) as unknown[];

  const rows: ZetarisRow[] = rawRows.map((r) => {
    // Row as array -> zip with column names.
    if (Array.isArray(r)) {
      const obj: ZetarisRow = {};
      r.forEach((v, i) => {
        obj[columnNames[i] ?? `col${i}`] = v;
      });
      return obj;
    }
    // Row already an object.
    return r as ZetarisRow;
  });

  // If we never found column names but rows are objects, derive from keys.
  const finalColumns =
    columnNames.length > 0
      ? columnNames
      : rows.length
        ? Object.keys(rows[0])
        : [];

  return { columns: finalColumns, rows, raw: data };
}

/** Lightweight connectivity check — runs SELECT 1 and reports success. */
export async function zetarisPing(): Promise<{
  ok: boolean;
  note: string;
}> {
  try {
    const result = await runSql("SELECT 1 AS one", 1);
    const value = result.rows[0]?.["one"] ?? result.rows[0]?.["ONE"];
    return {
      ok: String(value) === "1",
      note: `Zetaris reachable; SELECT 1 returned ${JSON.stringify(value)}.`,
    };
  } catch (err) {
    return { ok: false, note: `Zetaris unreachable: ${String(err)}` };
  }
}
