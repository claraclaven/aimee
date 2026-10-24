// Meterless Runtime auto-detect & status probe. Blueprint §3.2 / §7.
import { NextRequest, NextResponse } from "next/server";
import {
  MeterlessProvider,
  METERLESS_DEFAULT_URL,
  METERLESS_PROVIDER_ID,
  METERLESS_PROVIDER_NAME,
  METERLESS_ROUTING_MODES,
} from "@/lib/meterless-provider";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? undefined;
  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const provider = new MeterlessProvider({ baseUrl: url, token });

  const state = url ? await provider.probe() : await provider.autoDetect();

  return NextResponse.json({
    provider: {
      id: METERLESS_PROVIDER_ID,
      name: METERLESS_PROVIDER_NAME,
      defaultUrl: METERLESS_DEFAULT_URL,
      routingModes: METERLESS_ROUTING_MODES,
    },
    state,
    tokenValid: provider.hasValidToken(),
  });
}

export async function POST(req: NextRequest) {
  const { url } = (await req.json()) as { url?: string };
  const provider = new MeterlessProvider();
  // Demonstrate URL normalization (contract: never /v1/v1).
  const normalized = provider.normalizeUrl(url ?? METERLESS_DEFAULT_URL);
  return NextResponse.json({ input: url, normalized });
}
