// CV tailoring endpoint — routes through Meterless provider. Blueprint §5 P4.
import { NextRequest, NextResponse } from "next/server";
import { tailorApplication } from "@/lib/tailor";
import { zetaris } from "@/lib/zetaris-client";
import { meterlessConfig } from "@/lib/config";
import { logActivity, newRunId } from "@/lib/activity-log";
import type { FederatedOpportunity } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 200; // allow for 180s runtime timeout

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    baseCv: string;
    opportunity?: FederatedOpportunity;
    opportunityId?: string;
    mode?: string;
    runId?: string;
  };

  const runId = body.runId ?? newRunId();

  let opp = body.opportunity;
  if (!opp && body.opportunityId) {
    const all = await zetaris.query({});
    opp = all.find((o) => o.id === body.opportunityId);
  }
  if (!opp) {
    return NextResponse.json({ error: "opportunity not found" }, { status: 404 });
  }
  if (!body.baseCv?.trim()) {
    return NextResponse.json({ error: "baseCv required" }, { status: 400 });
  }

  const mode = body.mode ?? meterlessConfig.model;
  await logActivity({
    runId,
    step: "tailor-request",
    agent: "orchestrator",
    action: `prepare application for ${opp.title} @ ${opp.organization}`,
    status: "ok",
    detail: { opportunityId: opp.id, requestedMode: mode },
  });

  const result = await tailorApplication(body.baseCv, opp, mode);

  // Log the model call outcome (real Nemotron via Meterless, or local fallback).
  await logActivity({
    runId,
    step: "tailor",
    agent: "meterless-provider",
    action: "generate tailored CV + cover letter",
    status: result.provider.online ? "ok" : "fallback",
    detail: {
      provider: result.provider.online
        ? "Meterless Runtime → NVIDIA Nemotron"
        : "local fallback engine",
      mode: result.provider.mode,
      note: result.provider.note,
      cvChars: result.tailoredCv.length,
      coverLetterChars: result.coverLetter.length,
    },
  });

  return NextResponse.json({ result, runId });
}
