// CV tailoring endpoint — routes through Meterless provider. Blueprint §5 P4.
import { NextRequest, NextResponse } from "next/server";
import { tailorApplication } from "@/lib/tailor";
import { zetaris } from "@/lib/zetaris-client";
import { meterlessConfig } from "@/lib/config";
import type { FederatedOpportunity } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 200; // allow for 180s runtime timeout

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    baseCv: string;
    opportunity?: FederatedOpportunity;
    opportunityId?: string;
    mode?: string;
  };

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

  const result = await tailorApplication(
    body.baseCv,
    opp,
    body.mode ?? meterlessConfig.model,
  );
  return NextResponse.json({ result });
}
