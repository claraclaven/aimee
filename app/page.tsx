"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Radar,
  FileDiff,
  UserCog,
  Database,
  ShieldCheck,
  Send,
  ArrowRight,
  Cpu,
} from "lucide-react";
import type { LedgerEntry, MemoryRecord, ProviderState } from "@/lib/types";

interface Stats {
  records: MemoryRecord[];
  ledger: LedgerEntry[];
  integrity?: { valid: boolean };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [provider, setProvider] = useState<ProviderState | null>(null);
  const [apps, setApps] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const [h, p, a] = await Promise.all([
        fetch("/api/hmem").then((r) => r.json()),
        fetch("/api/provider").then((r) => r.json()),
        fetch("/api/applications").then((r) => r.json()),
      ]);
      setStats(h);
      setProvider(p.state);
      setApps(a.applications?.filter((x: { status: string }) => x.status === "applied").length ?? 0);
    })();
  }, []);

  const active = stats?.records.filter((r) => !r.superseded) ?? [];
  const skills = active.filter((r) => r.kind === "skill").length;

  const tiles = [
    {
      href: "/profile",
      icon: UserCog,
      title: "Profile & CV Studio",
      desc: "Seed H-MEM with your profile, stack, and base CV.",
      color: "text-neon-cyan",
    },
    {
      href: "/radar",
      icon: Radar,
      title: "Opportunity Radar",
      desc: "Federated jobs, scholarships & programs via Zetaris.",
      color: "text-neon-teal",
    },
    {
      href: "/applications",
      icon: FileDiff,
      title: "Review & Diff Studio",
      desc: "Side-by-side CV diffs with human-in-the-loop approval.",
      color: "text-neon-violet",
    },
    {
      href: "/memory",
      icon: Brain,
      title: "Memory Ledger",
      desc: "Inspect the compounding graph and trust ledger.",
      color: "text-neon-amber",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="card relative overflow-hidden p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-neon-cyan/10 blur-3xl" />
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neon-cyan">
          Local-first · Autonomous · Human-in-the-loop
        </p>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl">
          Your autonomous Tertiary Education & Career Planner
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
          Learns and remembers you with Meterless H-MEM, federates universities,
          scholarships, and jobs through Zetaris, and continuously tailors
          applications — never submitting without your approval.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/profile" className="btn-primary">
            Seed your profile <ArrowRight size={15} />
          </Link>
          <Link href="/radar" className="btn-ghost">
            Open Opportunity Radar
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Brain}
          label="Active memories"
          value={active.length}
          hint={`${skills} skills tracked`}
          color="text-neon-cyan"
        />
        <StatCard
          icon={Database}
          label="Ledger entries"
          value={stats?.ledger.length ?? 0}
          hint={stats?.integrity?.valid ? "chain intact" : "—"}
          color="text-neon-teal"
        />
        <StatCard
          icon={Send}
          label="Applications sent"
          value={apps}
          hint="with audit snapshot"
          color="text-neon-green"
        />
        <StatCard
          icon={Cpu}
          label="Meterless Runtime"
          value={provider?.status ?? "…"}
          hint={provider?.url || "auto-detecting"}
          color="text-neon-violet"
          isText
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {tiles.map(({ href, icon: Icon, title, desc, color }) => (
          <Link key={href} href={href} className="card group p-5">
            <div className="flex items-start gap-4">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ${color}`}
              >
                <Icon size={20} />
              </span>
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-white">
                  {title}
                  <ArrowRight
                    size={14}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </h3>
                <p className="mt-1 text-sm text-gray-400">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="card flex items-center gap-3 p-4 text-sm text-gray-400">
        <ShieldCheck size={18} className="text-neon-green" />
        <span>
          All personal data, CVs, and the memory graph stay on local storage.
          AI execution routes through the Meterless Nightshift hotspot on your
          machine.
        </span>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  color,
  isText,
}: {
  icon: typeof Brain;
  label: string;
  value: number | string;
  hint: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-gray-400">
          {label}
        </span>
        <Icon size={16} className={color} />
      </div>
      <p
        className={`mt-2 font-bold text-white ${isText ? "text-lg capitalize" : "text-3xl"}`}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-gray-500">{hint}</p>
    </div>
  );
}
