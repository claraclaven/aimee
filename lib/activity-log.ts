// ---------------------------------------------------------------------------
// Agent activity logger. Writes a structured JSONL trace of every real step
// the agent takes — which agent ran, what it did, the Zetaris query + rows
// returned, the model call, H-MEM writes, and the status of each step.
//
// Purpose (hackathon disqualification checklist): prove the agent performs
// genuine work, not hardcoded output. Each line is one JSON object appended to
// ./logs/agent-activity.jsonl. Server-side only.
// ---------------------------------------------------------------------------

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "agent-activity.jsonl");

export type StepStatus = "ok" | "error" | "fallback" | "skipped";

export interface ActivityEntry {
  ts: string; // ISO timestamp
  runId: string; // groups steps of one agent run
  step: string; // e.g. "discover", "match", "tailor", "memory", "decision"
  agent: string; // which component acted
  action: string; // what it did
  status: StepStatus;
  detail?: Record<string, unknown>; // queries, counts, model, hashes, etc.
  durationMs?: number;
}

/** Create a run id to group all steps of a single agent cycle. */
export function newRunId(): string {
  return randomUUID();
}

/** Append one activity entry as a JSONL line. Never throws (logging is best-effort). */
export async function logActivity(
  entry: Omit<ActivityEntry, "ts">,
): Promise<void> {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, line + "\n", "utf8");
  } catch {
    // Logging must never break the request path.
  }
}

/** Convenience: time an async step and log its outcome. */
export async function trackStep<T>(
  meta: { runId: string; step: string; agent: string; action: string },
  fn: () => Promise<T>,
  describe?: (result: T) => Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await logActivity({
      ...meta,
      status: "ok",
      durationMs: Date.now() - start,
      detail: describe ? describe(result) : undefined,
    });
    return result;
  } catch (err) {
    await logActivity({
      ...meta,
      status: "error",
      durationMs: Date.now() - start,
      detail: { error: String(err) },
    });
    throw err;
  }
}

/** Read the most recent N log entries (for the README / an API view). */
export async function readRecentActivity(limit = 100): Promise<ActivityEntry[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as ActivityEntry);
  } catch {
    return [];
  }
}
