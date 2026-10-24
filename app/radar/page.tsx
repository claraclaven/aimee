"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, RefreshCw, Filter } from "lucide-react";
import { OpportunityCard } from "@/components/OpportunityCard";
import { clientStore } from "@/lib/client-store";
import { cn } from "@/lib/utils";
import type { OpportunityType, ScoredOpportunity } from "@/lib/types";

const FILTERS: { label: string; type?: OpportunityType }[] = [
  { label: "All" },
  { label: "Jobs", type: "job" },
  { label: "Scholarships", type: "scholarship" },
  { label: "Universities", type: "university_program" },
];

export default function RadarPage() {
  const router = useRouter();
  const [opps, setOpps] = useState<ScoredOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<OpportunityType | undefined>(undefined);
  const [ctx, setCtx] = useState<{
    skills: string[];
    targetRole: string;
    rejectedStacks: string[];
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/zetaris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: filter ? { types: [filter] } : {},
        rank: true,
      }),
    });
    const data = await res.json();
    setOpps(data.opportunities ?? []);
    setCtx(data.context ?? null);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    discover();
  }, [discover]);

  async function prepare(opp: ScoredOpportunity) {
    setBusyId(opp.id);
    const baseCv = clientStore.getBaseCv();
    clientStore.setSelected(opp);
    const res = await fetch("/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseCv, opportunity: opp }),
    });
    const data = await res.json();
    if (data.result) {
      clientStore.setTailor(data.result);
      router.push("/applications");
    }
    setBusyId(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <span className="relative flex h-6 w-6 items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-neon-cyan/40 animate-radar" />
              <Radar size={18} className="relative text-neon-cyan" />
            </span>
            Opportunity Radar
          </h1>
          <p className="text-sm text-gray-400">
            A single Zetaris federated query across jobs, scholarships, and
            university programs — ranked against your memory graph.
          </p>
        </div>
        <button className="btn-primary" onClick={discover} disabled={loading}>
          <RefreshCw
            size={15}
            className={cn(loading && "animate-spin")}
          />
          Match &amp; Rank
        </button>
      </header>

      {ctx && (
        <div className="card flex flex-wrap items-center gap-2 p-3 text-xs text-gray-400">
          <Filter size={13} className="text-neon-cyan" />
          <span>Ranking against:</span>
          <span className="text-gray-200">
            {ctx.targetRole || "—"}
          </span>
          {ctx.skills.slice(0, 8).map((s) => (
            <span key={s} className="badge border-neon-teal/30 text-neon-teal">
              {s}
            </span>
          ))}
          {ctx.rejectedStacks.length > 0 && (
            <span className="badge border-neon-red/30 text-neon-red">
              filtering out: {ctx.rejectedStacks.join(", ")}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.type)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm transition-colors",
              filter === f.type
                ? "bg-neon-cyan/15 text-neon-cyan"
                : "text-gray-400 hover:bg-white/5",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Federating data sources…</p>
      ) : opps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">
          No opportunities match your current memory graph and filters.
          <br />
          Seed a profile first, or clear rejections.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {opps.map((o) => (
            <OpportunityCard
              key={o.id}
              opp={o}
              onPrepare={prepare}
              busy={busyId === o.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
