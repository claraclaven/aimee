// Human-in-the-loop decision gate: record approve/reject. Blueprint §5 P5/P6.
import { NextRequest, NextResponse } from "next/server";
import { allApplications, recordApplication } from "@/lib/applications";
import { memoryStore } from "@/lib/hmem/store";
import { memoryFeedback } from "@/lib/hmem/feedback";
import { trustLedger } from "@/lib/hmem/ledger";
import { logActivity, newRunId } from "@/lib/activity-log";
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
    runId?: string;
  };

  const runId = body.runId ?? newRunId();

  // Log the human-in-the-loop decision (the approval gate).
  await logActivity({
    runId,
    step: "human-approval",
    agent: "human",
    action: `student ${body.decision === "approve" ? "approved" : "rejected"} ${body.title}`,
    status: "ok",
    detail: {
      opportunityId: body.opportunityId,
      decision: body.decision,
      reason: body.reason,
    },
  });

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
    const ledgerEntry = await trustLedger.append(
      "apply",
      { id: body.opportunityId },
      `Approved & submitted application: ${body.title} @ ${body.organization}`,
    );
    await logActivity({
      runId,
      step: "memory-write",
      agent: "hmem",
      action: "recorded application to append-only trust ledger",
      status: "ok",
      detail: {
        ledgerAction: "apply",
        hash: ledgerEntry.hash,
        prevHash: ledgerEntry.prevHash,
      },
    });
    return NextResponse.json({ ok: true, status: "applied", runId });
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
  await logActivity({
    runId,
    step: "memory-write",
    agent: "hmem",
    action: "mined rejection into memory; superseded clashing preferences",
    status: "ok",
    detail: {
      reason: body.reason,
      adjustedMemories: feedback.adjusted,
      rejectionRecorded: Boolean(feedback.rejectionRecord),
    },
  });
  return NextResponse.json({ ok: true, status: "rejected", feedback, runId });
}
