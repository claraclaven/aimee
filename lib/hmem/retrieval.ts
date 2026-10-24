// ---------------------------------------------------------------------------
// MemoryRetrievalService — hybrid search (semantic-ish + lexical + recency
// decay) to reinject relevant context into tailoring prompts. Blueprint §3.1.3
// / §6.
//
// The "semantic" term uses a bag-of-tokens cosine similarity (no embeddings
// server required), combined with tag overlap and an exponential recency
// decay, weighted by each record's trust score.
// ---------------------------------------------------------------------------

import type { MemoryRecord } from "../types";
import { memoryStore } from "./store";
import { tokenize } from "./mining";

const RECENCY_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

// Hybrid weights (sum to 1 before trust multiplier).
const W_SEMANTIC = 0.5;
const W_LEXICAL = 0.3;
const W_RECENCY = 0.2;

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0);
  const magA = Math.sqrt([...a.values()].reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt([...b.values()].reduce((s, v) => s + v * v, 0));
  if (!magA || !magB) return 0;
  return dot / (magA * magB);
}

export interface RetrievalHit {
  record: MemoryRecord;
  relevance: number;
}

export class MemoryRetrievalService {
  async retrieve(query: string, limit = 8): Promise<RetrievalHit[]> {
    const records = await memoryStore.active();
    const qTokens = tokenize(query);
    const qVec = termFreq(qTokens);
    const qTagSet = new Set(qTokens);
    const now = Date.now();

    const hits = records.map((record) => {
      const rTokens = tokenize(`${record.content} ${record.tags.join(" ")}`);
      const semantic = cosine(qVec, termFreq(rTokens));

      const overlap = record.tags.filter((t) => qTagSet.has(t)).length;
      const lexical = record.tags.length
        ? overlap / Math.max(record.tags.length, 1)
        : 0;

      const age = now - record.updatedAt;
      const recency = Math.pow(0.5, age / RECENCY_HALF_LIFE_MS);

      const base =
        W_SEMANTIC * semantic + W_LEXICAL * lexical + W_RECENCY * recency;
      const relevance = base * record.trust;
      return { record, relevance };
    });

    return hits
      .filter((h) => h.relevance > 0.01)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /** Convenience: build a compact context block for a prompt. */
  async contextBlock(query: string, limit = 8): Promise<string> {
    const hits = await this.retrieve(query, limit);
    if (!hits.length) return "(no prior memory)";
    return hits
      .map(
        (h) =>
          `- [${h.record.kind}] ${h.record.content} (trust ${h.record.trust.toFixed(
            2,
          )}, rel ${h.relevance.toFixed(2)})`,
      )
      .join("\n");
  }
}

export const memoryRetrieval = new MemoryRetrievalService();
