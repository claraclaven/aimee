// Human-in-the-loop decision gate: record approve/reject. Blueprint §5 P5/P6.
import { NextRequest, NextResponse } from "next/server";
import { allApplications, recordApplication } from "@/lib/applications";
import { memoryStore } from "@/lib/hmem/store";
import { memoryFeedback } from "@/lib/hmem/feedback";
import { trustLedger } from "@/lib/hmem/ledger";
import type { ApplicationRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ applications: await allApplications() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    opportunityId: string;
    title: string;
    organization: string;
    decision: "approve" | "reject";
    reason?: string;
    tailoredCvSnapshot?: string;
  };

  if (body.decision === "approve") {
    const rec: ApplicationRecord = {
      opportunityId: body.opportunityId,
      title: body.title,
      organization: body.organization,
      status: "applied",
      tailoredCvSnapshot: body.tailoredCvSnapshot,
      timestamp: Date.now(),
    };
    await recordApplication(rec);
    // Audit: log application + mark memory.
    await memoryStore.create({
      kind: "application",
      entity: "student_profile",
      content: `Applied to ${body.title} @ ${body.organization}`,
      tags: ["application", "applied"],
      trust: 1,
      meta: { opportunityId: body.opportunityId, applied_status: true },
    });
    await trustLedger.append(
      "apply",
      { id: body.opportunityId },
      `Approved & submitted application: ${body.title} @ ${body.organization}`,
    );
    return NextResponse.json({ ok: true, status: "applied" });
  }

  // Reject: record + feed rejection reason into H-MEM (preference supersession).
  const rec: ApplicationRecord = {
    opportunityId: body.opportunityId,
    title: body.title,
    organization: body.organization,
    status: "rejected",
    reason: body.reason,
    timestamp: Date.now(),
  };
  await recordApplication(rec);
  const feedback = await memoryFeedback.feedback("rejected", {
    reason: body.reason ?? "Rejected without a stated reason.",
  });
  return NextResponse.json({ ok: true, status: "rejected", feedback });
}
