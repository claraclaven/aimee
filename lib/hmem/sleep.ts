// ---------------------------------------------------------------------------
// SleepCycleService ("Dreaming") — periodic consolidation. Blueprint §3.1.5 /
// §8 / §10. Deduplicates memories, resolves contradictions, prunes stale/low-
// trust data. Runs on demand (demo-friendly) rather than on a timer.
// ---------------------------------------------------------------------------

import type { MemoryRecord } from "../types";
import { memoryStore } from "./store";

const STALE_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
const MIN_TRUST = 0.25;

export interface SleepReport {
  duplicatesMerged: number;
  contradictionsResolved: number;
  pruned: number;
  details: string[];
}

function sameSkill(a: MemoryRecord, b: MemoryRecord): boolean {
  return (
    a.kind === "skill" &&
    b.kind === "skill" &&
    a.content.toLowerCase() === b.content.toLowerCase()
  );
}

export class SleepCycleService {
  async run(): Promise<SleepReport> {
    const report: SleepReport = {
      duplicatesMerged: 0,
      contradictionsResolved: 0,
      pruned: 0,
      details: [],
    };

    const records = await memoryStore.active();

    // 1. Deduplicate identical skill facts — keep newest, prune the rest.
    const seen = new Map<string, MemoryRecord>();
    const dupIds: string[] = [];
    for (const r of records) {
      if (r.kind !== "skill") continue;
      const key = r.content.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        const older = existing.updatedAt <= r.updatedAt ? existing : r;
        const newer = older === existing ? r : existing;
        dupIds.push(older.id);
        seen.set(key, newer);
        report.duplicatesMerged++;
        report.details.push(`Merged duplicate skill: "${r.content}"`);
      } else {
        seen.set(key, r);
      }
    }

    // 2. Resolve contradictions: a "rejection" of a stack should supersede any
    //    positive "preference" that still promotes that same stack.
    const rejections = records.filter((r) => r.kind === "rejection");
    const prefs = records.filter((r) => r.kind === "preference");
    for (const rej of rejections) {
      const rejTags = new Set(rej.tags);
      for (const pref of prefs) {
        if (pref.superseded) continue;
        const clash = pref.tags.some(
          (t) => rejTags.has(t) && t !== "preference" && t !== "stack",
        );
        if (clash) {
          await memoryStore.update(pref.id, {
            superseded: true,
            supersededBy: rej.id,
            trust: Math.max(pref.trust - 0.3, 0.1),
          });
          report.contradictionsResolved++;
          report.details.push(
            `Preference "${pref.content}" contradicted by rejection "${rej.content}"`,
          );
        }
      }
    }

    // 3. Prune stale or low-trust records.
    const now = Date.now();
    const staleIds = records
      .filter(
        (r) =>
          r.kind !== "profile" &&
          (now - r.updatedAt > STALE_AGE_MS || r.trust < MIN_TRUST),
      )
      .map((r) => r.id);

    const toPrune = [...new Set([...dupIds, ...staleIds])];
    if (toPrune.length) {
      report.pruned = await memoryStore.prune(toPrune);
    }

    return report;
  }
}

export const sleepCycle = new SleepCycleService();
