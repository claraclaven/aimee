// H-MEM operations endpoint. Blueprint §7.
import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "@/lib/hmem/store";
import { memoryMining } from "@/lib/hmem/mining";
import { memoryRetrieval } from "@/lib/hmem/retrieval";
import { trustLedger } from "@/lib/hmem/ledger";
import { sleepCycle } from "@/lib/hmem/sleep";
import { memoryFeedback } from "@/lib/hmem/feedback";
import type { FeedbackSignal, StudentProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [records, ledger, verify] = await Promise.all([
    memoryStore.all(),
    trustLedger.all(),
    trustLedger.verify(),
  ]);
  return NextResponse.json({ records, ledger, integrity: verify });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    case "mineProfile": {
      const created = await memoryMining.mineProfile(
        body.profile as StudentProfile,
      );
      return NextResponse.json({ created });
    }
    case "retrieve": {
      const hits = await memoryRetrieval.retrieve(
        String(body.query ?? ""),
        Number(body.limit ?? 8),
      );
      return NextResponse.json({ hits });
    }
    case "feedback": {
      const result = await memoryFeedback.feedback(
        body.signal as FeedbackSignal,
        { reason: body.reason, relatedTags: body.relatedTags },
      );
      return NextResponse.json({ result });
    }
    case "supersedePreference": {
      // Reject a stack -> rejection memory supersedes clashing preferences.
      const result = await memoryFeedback.feedback("rejected", {
        reason: String(body.reason ?? ""),
      });
      return NextResponse.json({ result });
    }
    case "sleep": {
      const report = await sleepCycle.run();
      return NextResponse.json({ report });
    }
    case "reset": {
      await memoryStore.reset();
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
