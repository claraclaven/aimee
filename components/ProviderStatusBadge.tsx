"use client";

import { useEffect, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProviderState } from "@/lib/types";

const COLORS: Record<string, string> = {
  online: "border-neon-green/40 text-neon-green bg-neon-green/10",
  unauthorized: "border-neon-amber/40 text-neon-amber bg-neon-amber/10",
  offline: "border-neon-red/40 text-neon-red bg-neon-red/10",
};

export function ProviderStatusBadge() {
  const [state, setState] = useState<ProviderState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const res = await fetch("/api/provider", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setState(data.state);
      } catch {
        if (!cancelled)
          setState({
            url: "",
            status: "offline",
            models: [],
            note: "probe failed",
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    probe();
    // Re-check periodically so a transient startup "offline" self-corrects.
    const id = setInterval(probe, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      title={state?.note}
      className={cn(
        "badge border px-2.5 py-1",
        state ? COLORS[state.status] : "border-white/10 text-gray-400",
      )}
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Cpu size={12} />
      )}
      <span className="font-mono">
        Meterless: {loading ? "probing…" : state?.status ?? "offline"}
      </span>
    </div>
  );
}
