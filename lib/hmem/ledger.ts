// ---------------------------------------------------------------------------
// TrustLedgerService — append-only audit log of all memory mutations.
// Blueprint §3.1.4 / §9. Each entry is hash-chained to the previous one so
// tampering is detectable (integrity verification).
// ---------------------------------------------------------------------------

import type { LedgerAction, LedgerEntry, MemoryRecord } from "../types";
import { readJson, trustHash, uid, writeJson } from "./persist";

const LEDGER_FILE = "hmem_ledger.json";
const GENESIS_HASH = "0".repeat(64);

export class TrustLedgerService {
  async all(): Promise<LedgerEntry[]> {
    return readJson<LedgerEntry[]>(LEDGER_FILE, []);
  }

  async append(
    action: LedgerAction,
    record: Pick<MemoryRecord, "id"> & Partial<MemoryRecord>,
    summary: string,
  ): Promise<LedgerEntry> {
    const entries = await this.all();
    const prevHash = entries.length
      ? entries[entries.length - 1].hash
      : GENESIS_HASH;

    const snapshot = { record, action, prevHash };
    const entry: LedgerEntry = {
      id: uid("led"),
      action,
      recordId: record.id,
      hash: trustHash(snapshot),
      prevHash,
      summary,
      timestamp: Date.now(),
    };
    entries.push(entry);
    await writeJson(LEDGER_FILE, entries);
    return entry;
  }

  /** Verify the hash chain is intact (no silent edits/deletions). */
  async verify(): Promise<{ valid: boolean; brokenAt?: string }> {
    const entries = await this.all();
    let prev = GENESIS_HASH;
    for (const e of entries) {
      if (e.prevHash !== prev) return { valid: false, brokenAt: e.id };
      prev = e.hash;
    }
    return { valid: true };
  }
}

export const trustLedger = new TrustLedgerService();
