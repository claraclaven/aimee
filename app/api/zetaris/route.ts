// Zetaris federated query endpoint. Blueprint §3.3 / §7.
import { NextRequest, NextResponse } from "next/server";
import {
  contextFromMemory,
  rankOpportunities,
  zetaris,
} from "@/lib/zetaris-client";
import { memoryStore } from "@/lib/hmem/store";
import { appliedOrRejectedIds } from "@/lib/applications";
import { logActivity, newRunId } from "@/lib/activity-log";
import type { ZetarisQuery } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    query?: ZetarisQuery;
    rank?: boolean;
  };

  const runId = newRunId();
  await logActivity({
    runId,
    step: "discover",
    agent: "orchestrator",
    action: "received user request to find & rank opportunities",
    status: "ok",
    detail: { query: body.query ?? {}, rank: body.rank !== false },
  });

  const memories = await memoryStore.active();

  // Step: retrieve relevant memory (H-MEM) to shape the query.
  const excludeIds = await appliedOrRejectedIds();
  const rejectedStacks = memories
    .filter((m) => m.kind === "rejection")
    .flatMap((m) =>
      m.tags.filter(
        (t) => !["rejection", "preference", "stack"].includes(t) && t.length > 1,
      ),
    );
  await logActivity({
    runId,
    step: "memory-retrieval",
    agent: "hmem",
    action: "loaded memory to filter the search",
    status: "ok",
    detail: {
      activeMemories: memories.length,
      excludeIds,
      rejectedStacks,
    },
  });

  const query: ZetarisQuery = {
    ...body.query,
    excludeIds: [...(body.query?.excludeIds ?? []), ...excludeIds],
    rejectedStacks: [
      ...(body.query?.rejectedStacks ?? []),
      ...rejectedStacks,
    ],
  };

  // Step: federated query through Zetaris.
  const { opportunities, source, note } = await zetaris.queryWithSource(query);
  await logActivity({
    runId,
    step: "zetaris-federation",
    agent: "zetaris-client",
    action: "federated query across universities, scholarships, jobs",
    status: source === "zetaris-rest" ? "ok" : "fallback",
    detail: {
      dataSource: source,
      rowsReturned: opportunities.length,
      note,
    },
  });

  if (body.rank === false) {
    return NextResponse.json({ opportunities, dataSource: { source, note } });
  }

  // Step: scoring/ranking against the memory-derived profile.
  const ctx = contextFromMemory(memories);
  const ranked = rankOpportunities(opportunities, ctx);
  await logActivity({
    runId,
    step: "match",
    agent: "scoring-engine",
    action: "ranked opportunities by skills fit, trajectory, value",
    status: "ok",
    detail: {
      targetRole: ctx.targetRole,
      skills: ctx.skills,
      candidates: ranked.length,
      topMatch: ranked[0]
        ? { id: ranked[0].id, title: ranked[0].title, score: ranked[0].score.overall }
        : null,
    },
  });

  return NextResponse.json({
    opportunities: ranked,
    dataSource: { source, note },
    context: { skills: ctx.skills, targetRole: ctx.targetRole, rejectedStacks },
    runId,
  });
}
