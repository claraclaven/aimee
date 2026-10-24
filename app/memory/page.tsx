"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, RefreshCw } from "lucide-react";
import { MemoryGraphViewer } from "@/components/MemoryGraphViewer";
import { cn } from "@/lib/utils";
import type { LedgerEntry, MemoryRecord } from "@/lib/types";
import type { SleepReport } from "@/lib/hmem/sleep";

export default function MemoryPage() {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [integrity, setIntegrity] = useState<{
    valid: boolean;
    brokenAt?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SleepReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/hmem").then((r) => r.json());
    setRecords(data.records ?? []);
    setLedger(data.ledger ?? []);
    setIntegrity(data.integrity);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSleep() {
    const data = await fetch("/api/hmem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sleep" }),
    }).then((r) => r.json());
    setReport(data.report);
    await load();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            H-MEM Memory Ledger &amp; Graph
          </h1>
          <p className="text-sm text-gray-400">
            Compounding memory with append-only, hash-chained audit trail. Run a
            sleep cycle to consolidate duplicates and resolve contradictions.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
          <button className="btn-primary" onClick={runSleep}>
            <Moon size={15} /> Run Sleep Cycle
          </button>
        </div>
      </header>

      {report && (
        <div className="card p-4 text-sm">
          <p className="mb-1 font-semibold text-neon-violet">
            Sleep cycle complete
          </p>
          <p className="text-gray-400">
            Merged {report.duplicatesMerged} duplicate(s), resolved{" "}
            {report.contradictionsResolved} contradiction(s), pruned{" "}
            {report.pruned} stale record(s).
          </p>
          {report.details.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-gray-500">
              {report.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <MemoryGraphViewer
        records={records}
        ledger={ledger}
        integrity={integrity}
      />
    </div>
  );
}
