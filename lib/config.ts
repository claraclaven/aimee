// ---------------------------------------------------------------------------
// Central runtime configuration, read from environment variables.
// Server-side only. Values come from .env.local (gitignored).
//
// DATA (Zetaris) — Participant Guide §1.9 / REST route:
//   ZETARIS_REST_URL   e.g. http://localhost:8888/api/v1.0
//   ZETARIS_ORG_ID     1 on a local install
//   ZETARIS_API_KEY    created in the Zetaris web UI (bearer token)
//   ZETARIS_CATALOG    the Zetaris database/catalog holding opportunity tables
//
// POWER (Meterless Nightshift) — Participant Guide §4.5:
//   METERLESS_BASE_URL       e.g. http://127.0.0.1:8088/v1
//   METERLESS_RUNTIME_TOKEN  the Nightshift Runtime access token
//   METERLESS_MODEL          routing mode, e.g. meterless/auto
// ---------------------------------------------------------------------------

export const zetarisConfig = {
  restUrl: (process.env.ZETARIS_REST_URL ?? "http://localhost:8888/api/v1.0").replace(/\/+$/, ""),
  orgId: process.env.ZETARIS_ORG_ID ?? "1",
  apiKey: process.env.ZETARIS_API_KEY ?? "",
  // Catalog/database name in Zetaris where opportunity tables live.
  catalog: process.env.ZETARIS_CATALOG ?? "opportunities",
};

export const meterlessConfig = {
  baseUrl: process.env.METERLESS_BASE_URL ?? "http://127.0.0.1:8088/v1",
  token: process.env.METERLESS_RUNTIME_TOKEN ?? "",
  model: process.env.METERLESS_MODEL ?? "meterless/auto",
};

/** True when a real Zetaris API key is configured (not blank/placeholder). */
export function zetarisConfigured(): boolean {
  const k = zetarisConfig.apiKey.trim();
  return k.length > 0 && k !== "your-zetaris-api-key";
}
