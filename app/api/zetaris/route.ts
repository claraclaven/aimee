// Zetaris federated query endpoint. Blueprint §3.3 / §7.
import { NextRequest, NextResponse } from "next/server";
import {
  contextFromMemory,
  rankOpportunities,
  zetaris,
} from "@/lib/zetaris-client";
import { memoryStore } from "@/lib/hmem/store";
import { appliedOrRejectedIds } from "@/lib/applications";
import type { ZetarisQuery } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    query?: ZetarisQuery;
    rank?: boolean;
  };

  const memories = await memoryStore.active();

  // Derive exclusion + rejected-stack filters from memory + applications.
  const excludeIds = await appliedOrRejectedIds();
  const rejectedStacks = memories
    .filter((m) => m.kind === "rejection")
    .flatMap((m) =>
      m.tags.filter(
        (t) => !["rejection", "preference", "stack"].includes(t) && t.length > 1,
      ),
    );

  const query: ZetarisQuery = {
    ...body.query,
    excludeIds: [...(body.query?.excludeIds ?? []), ...excludeIds],
    rejectedStacks: [
      ...(body.query?.rejectedStacks ?? []),
      ...rejectedStacks,
    ],
  };

  const opportunities = await zetaris.query(query);

  if (body.rank === false) {
    return NextResponse.json({ opportunities });
  }

  const ctx = contextFromMemory(memories);
  const ranked = rankOpportunities(opportunities, ctx);
  return NextResponse.json({
    opportunities: ranked,
    context: { skills: ctx.skills, targetRole: ctx.targetRole, rejectedStacks },
  });
}
