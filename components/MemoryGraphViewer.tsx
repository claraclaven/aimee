"use client";

import {
  User,
  Wrench,
  Heart,
  Ban,
  Send,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { LedgerEntry, MemoryKind, MemoryRecord } from "@/lib/types";

const KIND_META: Record<
  MemoryKind,
  { icon: typeof User; color: string; label: string }
> = {
  profile: { icon: User, color: "text-neon-cyan", label: "Profile" },
  skill: { icon: Wrench, color: "text-neon-teal", label: "Skill" },
  preference: { icon: Heart, color: "text-neon-violet", label: "Preference" },
  rejection: { icon: Ban, color: "text-neon-red", label: "Rejection" },
  application: { icon: Send, color: "text-neon-green", label: "Application" },
  feedback: {
    icon: MessageSquare,
    color: "text-neon-amber",
    label: "Feedback",
  },
};

export function MemoryGraphViewer({
  records,
  ledger,
  integrity,
}: {
  records: MemoryRecord[];
  ledger: LedgerEntry[];
  integrity?: { valid: boolean; brokenAt?: string };
}) {
  const active = records.filter((r) => !r.superseded);
  const superseded = records.filter((r) => r.superseded);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Memory graph */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Compounding Memory Graph
          </h2>
          <span className="badge border-neon-cyan/30 text-neon-cyan">
            {active.length} active · {superseded.length} superseded
          </span>
        </div>

        <div className="space-y-2">
          {active.map((r) => {
            const meta = KIND_META[r.kind];
            const Icon = meta.icon;
            return (
              <div key={r.id} className="card flex items-start gap-3 p-3">
                <span className={cn("mt-0.5", meta.color)}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-semibold", meta.color)}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {formatTime(r.updatedAt)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-gray-200">{r.content}</p>
                </div>
                <TrustMeter value={r.trust} />
              </div>
            );
          })}
          {!active.length && (
            <p className="text-sm text-gray-500">
              No memories yet. Seed a profile on the Profile page.
            </p>
          )}
        </div>

        {superseded.length > 0 && (
          <details className="card p-3 text-sm">
            <summary className="cursor-pointer text-gray-400">
              Superseded memories ({superseded.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {superseded.map((r) => (
                <li key={r.id} className="text-xs text-gray-600 line-through">
                  [{r.kind}] {r.content}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Trust ledger */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Trust Ledger (append-only)
          </h2>
          {integrity &&
            (integrity.valid ? (
              <span className="badge border-neon-green/40 text-neon-green bg-neon-green/10">
                <ShieldCheck size={12} /> chain intact
              </span>
            ) : (
              <span className="badge border-neon-red/40 text-neon-red bg-neon-red/10">
                <ShieldAlert size={12} /> broken @ {integrity.brokenAt}
              </span>
            ))}
        </div>

        <ol className="relative space-y-2 border-l border-white/10 pl-4">
          {[...ledger].reverse().map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-neon-cyan/70" />
              <div className="card p-3">
                <div className="flex items-center justify-between">
                  <span className="badge border-neon-cyan/30 font-mono text-neon-cyan">
                    {e.action}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {formatTime(e.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-300">{e.summary}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-gray-600">
                  hash {e.hash.slice(0, 16)}… ← {e.prevHash.slice(0, 8)}…
                </p>
              </div>
            </li>
          ))}
          {!ledger.length && (
            <li className="text-sm text-gray-500">No ledger entries yet.</li>
          )}
        </ol>
      </div>
    </div>
  );
}

function TrustMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] text-gray-400">{pct}%</span>
      <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-teal"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
