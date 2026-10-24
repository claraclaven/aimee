// ---------------------------------------------------------------------------
// Zetaris Federated Data Client — unifies three disparate datasets
// (universities, scholarships, jobs) behind a single query surface.
// Blueprint §3.3 / Step 4. Backed by mock data for demo resilience.
// ---------------------------------------------------------------------------

import { ALL_OPPORTUNITIES } from "@/data/mock-zetaris-data";
import { zetarisConfig, zetarisConfigured } from "./config";
import { buildOpportunitySql, rowsToOpportunities } from "./zetaris-sql";
import { runSql } from "./zetaris-rest";
import type {
  FederatedOpportunity,
  MemoryRecord,
  ScoreBreakdown,
  ScoredOpportunity,
  ZetarisQuery,
} from "./types";

function norm(s: string): string {
  return s.toLowerCase().trim();
}

export interface ZetarisQueryResult {
  opportunities: FederatedOpportunity[];
  source: "zetaris-rest" | "mock-fallback";
  note: string;
}

export class ZetarisClient {
  /**
   * Single federated query across all three buckets.
   * Tries the real Zetaris REST API first (when configured); on any failure,
   * falls back to the in-memory mock so the demo stays resilient.
   */
  async query(q: ZetarisQuery = {}): Promise<FederatedOpportunity[]> {
    return (await this.queryWithSource(q)).opportunities;
  }

  /** Like query(), but also reports whether real Zetaris or the mock was used. */
  async queryWithSource(q: ZetarisQuery = {}): Promise<ZetarisQueryResult> {
    if (zetarisConfigured()) {
      try {
        const sql = buildOpportunitySql(q, zetarisConfig.catalog);
        const result = await runSql(sql);
        const opportunities = rowsToOpportunities(result.rows);
        // Apply exclusion/rejected-stack filters client-side (post-SQL) so the
        // behavior is identical regardless of data source.
        return {
          opportunities: this.applyMemoryFilters(opportunities, q),
          source: "zetaris-rest",
          note: `Federated ${opportunities.length} rows via Zetaris REST (${zetarisConfig.restUrl}).`,
        };
      } catch (err) {
        return {
          opportunities: this.filterMock(q),
          source: "mock-fallback",
          note: `Zetaris REST failed (${String(err)}); using mock data.`,
        };
      }
    }
    return {
      opportunities: this.filterMock(q),
      source: "mock-fallback",
      note: "Zetaris API key not configured; using mock data.",
    };
  }

  /** Apply H-MEM-derived exclusion and rejected-stack filters. */
  private applyMemoryFilters(
    opps: FederatedOpportunity[],
    q: ZetarisQuery,
  ): FederatedOpportunity[] {
    let results = opps;
    if (q.excludeIds?.length) {
      const ex = new Set(q.excludeIds);
      results = results.filter((o) => !ex.has(o.id));
    }
    if (q.rejectedStacks?.length) {
      const rejected = q.rejectedStacks.map(norm);
      results = results.filter(
        (o) =>
          !o.requirements.some((r) => rejected.includes(norm(r))) &&
          !rejected.some((rs) => norm(o.title).includes(rs)),
      );
    }
    return results;
  }

  /** Full in-memory filtering against the mock dataset (offline fallback). */
  private filterMock(q: ZetarisQuery = {}): FederatedOpportunity[] {
    let results = [...ALL_OPPORTUNITIES];

    if (q.types?.length) {
      results = results.filter((o) => q.types!.includes(o.type));
    }
    if (q.field) {
      const f = norm(q.field);
      results = results.filter(
        (o) => norm(o.field).includes(f) || f.includes(norm(o.field)),
      );
    }
    if (q.location) {
      const loc = norm(q.location);
      results = results.filter((o) => norm(o.location).includes(loc));
    }
    if (q.keywords?.length) {
      const kws = q.keywords.map(norm);
      results = results.filter((o) => {
        const hay = norm(
          `${o.title} ${o.field} ${o.requirements.join(" ")} ${o.organization}`,
        );
        return kws.some((k) => hay.includes(k));
      });
    }
    return this.applyMemoryFilters(results, q);
  }
}

export const zetaris = new ZetarisClient();

// ----- Matching & Scoring Engine (Blueprint §5 Phase 3) --------------------

const W_SKILLS = 0.5;
const W_TRAJECTORY = 0.3;
const W_VALUE = 0.2;

export interface ScoringContext {
  skills: string[]; // verified student skills
  targetRole: string;
  ambition: string;
  memories: MemoryRecord[];
}

/** Build scoring context from active H-MEM records. */
export function contextFromMemory(memories: MemoryRecord[]): ScoringContext {
  const skills = memories
    .filter((m) => m.kind === "skill")
    .map((m) => m.content.replace(/^Has skill:\s*/i, "").toLowerCase());
  const profile = memories.find((m) => m.kind === "profile");
  const target =
    (profile?.content.match(/targeting ([^(]+)/i)?.[1] ?? "").trim() || "";
  const ambition =
    (profile?.content.match(/Ambition:\s*(.+)$/i)?.[1] ?? "").trim() || "";
  return { skills, targetRole: target, ambition, memories };
}

function parseValue(financial?: string): number {
  if (!financial) return 0.5;
  const nums = financial.replace(/,/g, "").match(/\d+/g);
  if (!nums) return /full/i.test(financial) ? 1 : 0.6;
  const max = Math.max(...nums.map(Number));
  // Normalize roughly: salaries/awards up to ~200k -> 0..1.
  return Math.min(max / 200000, 1);
}

export function scoreOpportunity(
  opp: FederatedOpportunity,
  ctx: ScoringContext,
): ScoreBreakdown {
  const reqs = opp.requirements.map((r) => r.toLowerCase());
  const skillSet = new Set(ctx.skills);

  const matchedSkills = reqs.filter((r) =>
    [...skillSet].some((s) => s === r || s.includes(r) || r.includes(s)),
  );
  const missingSkills = reqs.filter((r) => !matchedSkills.includes(r));
  const skillsFit = reqs.length
    ? Math.round((matchedSkills.length / reqs.length) * 100)
    : 60;

  // Trajectory alignment: overlap of target role / ambition with opp field+title.
  const trajText = `${ctx.targetRole} ${ctx.ambition}`.toLowerCase();
  const oppText = `${opp.title} ${opp.field}`.toLowerCase();
  const trajTokens = trajText.split(/\s+/).filter((t) => t.length > 3);
  const trajHits = trajTokens.filter((t) => oppText.includes(t)).length;
  const trajectoryAlignment = trajTokens.length
    ? Math.min(100, Math.round((trajHits / trajTokens.length) * 100) + 20)
    : 50;

  const valueFeasibility = Math.round(parseValue(opp.metrics.financialValue) * 100);

  const overall = Math.round(
    W_SKILLS * skillsFit +
      W_TRAJECTORY * trajectoryAlignment +
      W_VALUE * valueFeasibility,
  );

  const reasoning =
    `Skills fit ${skillsFit}% (${matchedSkills.length}/${reqs.length} matched). ` +
    `Trajectory alignment ${trajectoryAlignment}% vs "${ctx.targetRole || "role"}". ` +
    `Value/feasibility ${valueFeasibility}%.`;

  return {
    skillsFit,
    trajectoryAlignment,
    valueFeasibility,
    overall,
    matchedSkills,
    missingSkills,
    reasoning,
  };
}

export function rankOpportunities(
  opps: FederatedOpportunity[],
  ctx: ScoringContext,
): ScoredOpportunity[] {
  return opps
    .map((o) => ({ ...o, score: scoreOpportunity(o, ctx) }))
    .sort((a, b) => b.score.overall - a.score.overall);
}
