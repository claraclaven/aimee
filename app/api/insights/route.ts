// Live Zetaris market insights endpoint — proves the Data layer is live.
import { NextResponse } from "next/server";
import { getMarketInsights } from "@/lib/zetaris-insights";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getMarketInsights();
  return NextResponse.json(result);
}
