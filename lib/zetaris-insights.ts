// ---------------------------------------------------------------------------
// Live Zetaris analytics. Runs REAL federated SQL against the registered
// TPCDS_DB source to prove the Data layer is live (Participant Guide: your app
// queries Zetaris and gets grounded answers). Server-side only.
//
// These queries ground the "market context" shown next to opportunities in a
// real governed dataset, exactly the "Solving Fragmented Intelligence" idea.
// ---------------------------------------------------------------------------

import { zetarisConfig, zetarisConfigured } from "./config";
import { runSql } from "./zetaris-rest";

export interface MarketInsight {
  label: string;
  value: string;
  sql: string;
}

export interface InsightsResult {
  live: boolean;
  source: string;
  insights: MarketInsight[];
  note: string;
}

const CATALOG = "TPCDS_DB";

// A small set of grounded queries. Each is a single statement.
const QUERIES: { label: string; sql: string; format?: (v: unknown) => string }[] =
  [
    {
      label: "Customers in warehouse",
      sql: `SELECT COUNT(*) AS n FROM ${CATALOG}.customer`,
    },
    {
      label: "Distinct items catalogued",
      sql: `SELECT COUNT(*) AS n FROM ${CATALOG}.item`,
    },
    {
      label: "Store sales transactions",
      sql: `SELECT COUNT(*) AS n FROM ${CATALOG}.store_sales`,
    },
  ];

function firstValue(rows: Record<string, unknown>[]): unknown {
  if (!rows.length) return null;
  const row = rows[0];
  return row["n"] ?? row["N"] ?? Object.values(row)[0];
}

function fmtNumber(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v ?? "—");
}

/**
 * Run the grounded queries against Zetaris. Returns live:false (not an error)
 * when Zetaris isn't configured/reachable, so the UI can show a graceful state.
 */
export async function getMarketInsights(): Promise<InsightsResult> {
  if (!zetarisConfigured()) {
    return {
      live: false,
      source: CATALOG,
      insights: [],
      note: "Zetaris API key not configured (.env.local). Showing no live data.",
    };
  }

  const insights: MarketInsight[] = [];
  let anySucceeded = false;
  let lastError = "";

  // Run each query independently so one missing table doesn't sink the panel.
  for (const q of QUERIES) {
    try {
      const result = await runSql(q.sql, 1);
      insights.push({
        label: q.label,
        value: fmtNumber(firstValue(result.rows)),
        sql: q.sql,
      });
      anySucceeded = true;
    } catch (err) {
      lastError = String(err);
    }
  }

  return {
    live: anySucceeded,
    source: `${zetarisConfig.restUrl} · ${CATALOG}`,
    insights,
    note: anySucceeded
      ? `Live federated query against Zetaris ${CATALOG}.`
      : `Zetaris query failed: ${lastError}`,
  };
}
