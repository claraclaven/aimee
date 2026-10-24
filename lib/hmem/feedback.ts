// ---------------------------------------------------------------------------
// Memory Feedback API — hmem.feedback(). Blueprint §9.2 / §5 Phase 6.
// Thumbs-up reinforces trust; rejection records a new rejection memory, applies
// trust decay, and supersedes any clashing preference so future discovery
// cycles immediately reflect the change.
// ---------------------------------------------------------------------------

import type { FeedbackSignal, MemoryRecord } from "../types";
import { memoryMining } from "./mining";
import { memoryStore } from "./store";
import { trustLedger } from "./ledger";

export interface FeedbackResult {
  signal: FeedbackSignal;
  rejectionRecord?: MemoryRecord;
  adjusted: number;
}

export class MemoryFeedbackService {
  /**
   * Record feedback about an opportunity / suggestion.
   * - "helpful": reinforce related memories (+trust).
   * - "rejected": mine the reason into a rejection memory and decay clashes.
   */
  async feedback(
    signal: FeedbackSignal,
    opts: { reason?: string; relatedTags?: string[] } = {},
  ): Promise<FeedbackResult> {
    const result: FeedbackResult = { signal, adjusted: 0 };

    if (signal === "rejected" && opts.reason) {
      const rec = (await memoryMining.mineFeedbackText(opts.reason)) ?? undefined;
      result.rejectionRecord = rec;

      if (rec) {
        const rejTags = new Set(rec.tags);
        const records = await memoryStore.active();
        for (const r of records) {
          if (r.id === rec.id) continue;
          const clash = r.tags.some(
            (t) => rejTags.has(t) && !["preference", "rejection"].includes(t),
          );
          if (clash && (r.kind === "preference" || r.kind === "skill")) {
            await memoryStore.update(r.id, {
              trust: Math.max(r.trust - 0.25, 0.1),
              feedback: "rejected",
            });
            result.adjusted++;
          }
        }
        await trustLedger.append(
          "feedback",
          rec,
          `Rejection feedback mined: "${opts.reason}" (decayed ${result.adjusted} clashes)`,
        );
      }
    }

    if (signal === "helpful" && opts.relatedTags?.length) {
      const tagSet = new Set(opts.relatedTags);
      const records = await memoryStore.active();
      for (const r of records) {
        if (r.tags.some((t) => tagSet.has(t))) {
          await memoryStore.update(r.id, {
            trust: Math.min(r.trust + 0.05, 1),
            feedback: "helpful",
          });
          result.adjusted++;
        }
      }
    }

    return result;
  }
}

export const memoryFeedback = new MemoryFeedbackService();
