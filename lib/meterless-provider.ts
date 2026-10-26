// ---------------------------------------------------------------------------
// Meterless Runtime Provider Client — conforms to Power Contract 0.90.0
// Blueprint §3.2 / Step 2.
//
// Design notes:
//  - Provider ID: "meterless", Name: "Meterless Runtime".
//  - Default base URL http://127.0.0.1:8088/v1.
//  - URL normalization: always collapse to <host>/v1, never /v1/v1.
//  - Mandatory headers: meterless-app, meterless-scope.
//  - Status probing via GET /v1/models (200 online, 401/403 unauthorized).
//  - Auto-detect across ports 8088, 8090, 8787, 11434 and localhost hosts.
//  - 180s timeout to tolerate cold model loads.
//  - Graceful offline fallback so the app always demos even with no runtime.
// ---------------------------------------------------------------------------

import type { ProviderState, ProviderStatus } from "./types";

export interface MeterlessConfig {
  baseUrl: string;
  token?: string;
  appId: string;
  routingMode: string;
}

export const METERLESS_PROVIDER_ID = "meterless";
export const METERLESS_PROVIDER_NAME = "Meterless Runtime";
export const METERLESS_DEFAULT_URL = "http://127.0.0.1:8088/v1";
export const METERLESS_APP_ID = "tertiary-planner";
export const METERLESS_TIMEOUT_MS = 180_000;

// Known routing modes exposed by the runtime as "models".
export const METERLESS_ROUTING_MODES = [
  "meterless/auto",
  "meterless/fast",
  "meterless/deep",
  "meterless/cheap",
  "meterless/local",
  "meterless/fusion",
];

const PLACEHOLDER_TOKENS = new Set(["rt-local", "", "probe"]);

export class MeterlessProvider {
  private baseUrl: string;
  private token: string;
  private appId: string;

  constructor(config?: Partial<MeterlessConfig>) {
    this.baseUrl = this.normalizeUrl(
      config?.baseUrl ||
        process.env.METERLESS_BASE_URL ||
        METERLESS_DEFAULT_URL,
    );
    this.token = config?.token || process.env.METERLESS_RUNTIME_TOKEN || "";
    this.appId = config?.appId || METERLESS_APP_ID;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Contract rule: Normalize any pasted URL to <host>/v1.
   * Accepts forms with/without /v1, /v1/chat/completions, /v1/models, /healthz.
   * Never produces /v1/v1.
   */
  public normalizeUrl(url: string): string {
    let clean = (url || "").trim().replace(/\/+$/, "");
    if (!clean) clean = METERLESS_DEFAULT_URL;
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "http://" + clean;
    }
    // Strip any known suffixes repeatedly so /v1/v1 or /v1/models collapse.
    let prev: string;
    do {
      prev = clean;
      clean = clean.replace(/\/v1\/chat\/completions$/, "");
      clean = clean.replace(/\/v1\/models$/, "");
      clean = clean.replace(/\/chat\/completions$/, "");
      clean = clean.replace(/\/models$/, "");
      clean = clean.replace(/\/healthz$/, "");
      clean = clean.replace(/\/v1$/, "");
      clean = clean.replace(/\/+$/, "");
    } while (clean !== prev);
    return `${clean}/v1`;
  }

  /**
   * A valid token is required for real calls. The placeholder "rt-local" and
   * empty/probe values are rejected per contract.
   */
  public hasValidToken(): boolean {
    return !PLACEHOLDER_TOKENS.has(this.token.trim());
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token || "probe"}`,
      "meterless-app": this.appId,
      "meterless-scope": "user",
      ...extra,
    };
  }

  /**
   * Contract rule: GET /v1/models determines readiness.
   *  200 with meterless IDs -> online
   *  401/403                 -> unauthorized
   *  network error           -> offline
   */
  public async probe(
    url = this.baseUrl,
    timeoutMs = 2500,
  ): Promise<ProviderState> {
    try {
      const res = await fetch(`${url}/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 401 || res.status === 403) {
        return {
          url,
          status: "unauthorized",
          models: [],
          note: "Runtime reachable but token rejected. Paste a valid token.",
        };
      }
      if (res.status === 200) {
        let models: string[] = [];
        try {
          const data = await res.json();
          models = (data?.data ?? data?.models ?? [])
            .map((m: { id?: string } | string) =>
              typeof m === "string" ? m : m.id ?? "",
            )
            .filter((id: string) => id.startsWith("meterless/"));
        } catch {
          models = METERLESS_ROUTING_MODES;
        }
        return {
          url,
          status: "online",
          models: models.length ? models : METERLESS_ROUTING_MODES,
          note: "Meterless Runtime online.",
        };
      }
      return {
        url,
        status: "offline",
        models: [],
        note: `Unexpected status ${res.status}.`,
      };
    } catch {
      return {
        url,
        status: "offline",
        models: [],
        note: "No Meterless Runtime reachable (Nightshift hotspot not running).",
      };
    }
  }

  /**
   * Contract rule: Auto-detect across ports 8088, 8090, 8787, 11434 on
   * 127.0.0.1, localhost, and [::1]. Return first online/unauthorized endpoint.
   *
   * Probes run in PARALLEL with a short timeout so that when no runtime is
   * present the whole check resolves in well under a second (instead of
   * serially timing out across 12 endpoints).
   */
  public async autoDetect(): Promise<ProviderState> {
    const ports = [8088, 8090, 8787, 11434];
    // Include host.docker.internal so a containerized app can reach a
    // Nightshift runtime on the Windows/macOS host.
    const hosts = ["127.0.0.1", "localhost", "[::1]", "host.docker.internal"];

    // Try the explicitly configured base URL first (fast path when set).
    const candidates = [
      this.baseUrl,
      ...hosts.flatMap((h) => ports.map((p) => `http://${h}:${p}/v1`)),
    ];
    // De-duplicate while preserving order.
    const unique = [...new Set(candidates)];

    const results = await Promise.all(
      unique.map((url) => this.probe(url, 600)),
    );
    const hit = results.find(
      (s) => s.status === "online" || s.status === "unauthorized",
    );
    if (hit) {
      this.baseUrl = hit.url;
      return hit;
    }
    return {
      url: this.baseUrl,
      status: "offline",
      models: [],
      note: "No Meterless endpoint found on known ports. Using offline fallback.",
    };
  }

  /**
   * Plain-text chat completion with 180s timeout. Returns the assistant text.
   * Throws on non-OK responses so callers can decide on fallback behavior.
   */
  public async complete(
    prompt: string,
    mode: string = "meterless/auto",
    timeoutMs: number = METERLESS_TIMEOUT_MS,
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model: mode,
        messages: [{ role: "user", content: prompt }],
        // Keep responses tight: a CV + cover letter needs far fewer tokens than
        // a long reasoning trace, and this bounds latency.
        max_tokens: 1200,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Meterless error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  public get providerStatus(): ProviderStatus {
    return this.hasValidToken() ? "online" : "unauthorized";
  }
}
