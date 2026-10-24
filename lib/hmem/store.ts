// ---------------------------------------------------------------------------
// MemoryStoreService — durable local store for memory records.
// Blueprint §3.1.2 / Step 3. Persists to ./.data/hmem_store.json and emits a
// TrustLedger entry for every create/update/supersede/prune.
// ---------------------------------------------------------------------------

import type { MemoryKind, MemoryRecord } from "../types";
import { trustLedger } from "./ledger";
import { readJson, uid, writeJson } from "./persist";

const STORE_FILE = "hmem_store.json";

export class MemoryStoreService {
  async all(): Promise<MemoryRecord[]> {
    return readJson<MemoryRecord[]>(STORE_FILE, []);
  }

  async active(): Promise<MemoryRecord[]> {
    return (await this.all()).filter((r) => !r.superseded);
  }

  async byKind(kind: MemoryKind): Promise<MemoryRecord[]> {
    return (await this.all()).filter((r) => r.kind === kind && !r.superseded);
  }

  private async saveAll(records: MemoryRecord[]): Promise<void> {
    await writeJson(STORE_FILE, records);
  }

  async create(
    input: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt" | "trust"> &
      Partial<Pick<MemoryRecord, "trust">>,
  ): Promise<MemoryRecord> {
    const records = await this.all();
    const now = Date.now();
    const record: MemoryRecord = {
      id: uid(),
      trust: input.trust ?? 0.8,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    records.push(record);
    await this.saveAll(records);
    await trustLedger.append(
      "create",
      record,
      `Created ${record.kind}: "${truncate(record.content)}"`,
    );
    return record;
  }

  async update(
    id: string,
    patch: Partial<MemoryRecord>,
  ): Promise<MemoryRecord | null> {
    const records = await this.all();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...patch, updatedAt: Date.now() };
    await this.saveAll(records);
    await trustLedger.append(
      "update",
      records[idx],
      `Updated ${records[idx].kind}: "${truncate(records[idx].content)}"`,
    );
    return records[idx];
  }

  /**
   * Supersede any active records matching a predicate with a new record.
   * Powers preference supersession (Blueprint §5 Phase 6, §8/§10).
   */
  async supersede(
    predicate: (r: MemoryRecord) => boolean,
    replacement: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt" | "trust"> &
      Partial<Pick<MemoryRecord, "trust">>,
  ): Promise<MemoryRecord> {
    const records = await this.all();
    const now = Date.now();
    const newRecord: MemoryRecord = {
      id: uid(),
      trust: replacement.trust ?? 0.9,
      createdAt: now,
      updatedAt: now,
      ...replacement,
    };

    for (const r of records) {
      if (!r.superseded && predicate(r)) {
        r.superseded = true;
        r.supersededBy = newRecord.id;
        r.updatedAt = now;
        await trustLedger.append(
          "supersede",
          r,
          `Superseded "${truncate(r.content)}" -> "${truncate(
            newRecord.content,
          )}"`,
        );
      }
    }
    records.push(newRecord);
    await this.saveAll(records);
    await trustLedger.append(
      "create",
      newRecord,
      `New authoritative ${newRecord.kind}: "${truncate(newRecord.content)}"`,
    );
    return newRecord;
  }

  async prune(ids: string[]): Promise<number> {
    const records = await this.all();
    const kept = records.filter((r) => !ids.includes(r.id));
    const removed = records.length - kept.length;
    await this.saveAll(kept);
    for (const id of ids) {
      await trustLedger.append("prune", { id }, `Pruned stale record ${id}`);
    }
    return removed;
  }

  async reset(): Promise<void> {
    await this.saveAll([]);
  }
}

function truncate(s: string, n = 48): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export const memoryStore = new MemoryStoreService();
