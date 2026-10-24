// ---------------------------------------------------------------------------
// SQL builder + row mapper for the opportunity tables registered in Zetaris.
// Produces a single federated query (UNION ALL across universities,
// scholarships, jobs) so one SQL call spans all three sources — the "Solving
// Fragmented Intelligence" idea the event asks for.
//
// Expected tables in the Zetaris catalog (see scripts/zetaris-setup.sql):
//   <catalog>.universities(id, title, organization, location, field,
//       requirements, rating, financial_value, deadline)
//   <catalog>.scholarships(... same columns ...)
//   <catalog>.jobs(... same columns ...)
// `requirements` is a comma-separated string (portable across SQL engines).
// ---------------------------------------------------------------------------

import type {
  FederatedOpportunity,
  OpportunityType,
  ZetarisSource,
  ZetarisQuery,
} from "./types";
import type { ZetarisRow } from "./zetaris-rest";

/** Escape a string literal for safe inlining in SQL (doubles single quotes). */
function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

interface TableSpec {
  table: string;
  type: OpportunityType;
  source: ZetarisSource;
}

const TABLES: TableSpec[] = [
  { table: "universities", type: "university_program", source: "zetaris-uni-federation" },
  { table: "scholarships", type: "scholarship", source: "zetaris-scholarship-lake" },
  { table: "jobs", type: "job", source: "zetaris-jobmarket-feed" },
];

/**
 * Build a federated SELECT across the three opportunity tables.
 * Type/field/location/keyword filters are pushed into SQL. Exclusion and
 * rejected-stack filters are applied in JS afterwards (they depend on H-MEM).
 */
export function buildOpportunitySql(q: ZetarisQuery, catalog: string): string {
  const wanted = q.types?.length ? new Set(q.types) : null;

  const selects = TABLES.filter((t) => !wanted || wanted.has(t.type)).map(
    (t) => {
      const where: string[] = [];
      if (q.field) {
        where.push(`LOWER(field) LIKE ${lit(`%${q.field.toLowerCase()}%`)}`);
      }
      if (q.location) {
        where.push(
          `LOWER(location) LIKE ${lit(`%${q.location.toLowerCase()}%`)}`,
        );
      }
      if (q.keywords?.length) {
        const ors = q.keywords.map(
          (k) =>
            `(LOWER(title) LIKE ${lit(`%${k.toLowerCase()}%`)} OR ` +
            `LOWER(requirements) LIKE ${lit(`%${k.toLowerCase()}%`)} OR ` +
            `LOWER(field) LIKE ${lit(`%${k.toLowerCase()}%`)})`,
        );
        where.push(`(${ors.join(" OR ")})`);
      }
      const whereClause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

      return (
        `SELECT id, ${lit(t.type)} AS opp_type, title, organization, ` +
        `location, field, requirements, rating, financial_value, deadline, ` +
        `${lit(t.source)} AS source ` +
        `FROM ${catalog}.${t.table}${whereClause}`
      );
    },
  );

  // If every type was filtered out, return a query that yields no rows safely.
  if (!selects.length) {
    return `SELECT id, opp_type, title, organization, location, field, requirements, rating, financial_value, deadline, source FROM ${catalog}.universities WHERE 1 = 0`;
  }

  return selects.join("\nUNION ALL\n");
}

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function splitRequirements(v: unknown): string[] {
  const s = toStr(v).trim();
  if (!s) return [];
  return s
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Map raw Zetaris rows into FederatedOpportunity objects. */
export function rowsToOpportunities(rows: ZetarisRow[]): FederatedOpportunity[] {
  return rows.map((row) => {
    // Column lookups are case-insensitive to tolerate engine quirks.
    const get = (name: string): unknown => {
      if (name in row) return row[name];
      const key = Object.keys(row).find(
        (k) => k.toLowerCase() === name.toLowerCase(),
      );
      return key ? row[key] : undefined;
    };

    const rating = toNum(get("rating"));
    const financialValue = toStr(get("financial_value")) || undefined;
    const deadline = toStr(get("deadline")) || undefined;

    return {
      id: toStr(get("id")),
      type: (toStr(get("opp_type")) as OpportunityType) || "job",
      title: toStr(get("title")),
      organization: toStr(get("organization")),
      location: toStr(get("location")),
      field: toStr(get("field")),
      requirements: splitRequirements(get("requirements")),
      metrics: { rating, financialValue, deadline },
      source: toStr(get("source")) as ZetarisSource,
    };
  });
}
