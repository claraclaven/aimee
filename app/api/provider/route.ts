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

// Cache the probe result so every page load doesn't re-probe the network.
let cachedState: Awaited<ReturnType<MeterlessProvider["autoDetect"]>> | null =
  null;
let cachedAt = 0;
const PROBE_CACHE_MS = 30_000;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? undefined;
  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const provider = new MeterlessProvider({ baseUrl: url, token });

  let state: Awaited<ReturnType<MeterlessProvider["autoDetect"]>>;
  if (!url && cachedState && Date.now() - cachedAt < PROBE_CACHE_MS) {
    state = cachedState;
  } else {
    state = url ? await provider.probe() : await provider.autoDetect();
    // Only cache a GOOD result, so a transient startup "offline" doesn't stick.
    if (!url && (state.status === "online" || state.status === "unauthorized")) {
      cachedState = state;
      cachedAt = Date.now();
    }
  }

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
