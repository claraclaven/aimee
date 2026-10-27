// Agent activity log viewer — returns recent JSONL entries so judges can
// verify real agent work (not hardcoded output).
import { NextRequest, NextResponse } from "next/server";
import { readRecentActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 200);
  const entries = await readRecentActivity(limit);
  return NextResponse.json({ count: entries.length, entries });
}
