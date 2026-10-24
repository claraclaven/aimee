"use client";

import {
  Briefcase,
  GraduationCap,
  Award,
  MapPin,
  Star,
  Calendar,
  DollarSign,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoredOpportunity } from "@/lib/types";

const TYPE_META = {
  job: { icon: Briefcase, label: "Job", color: "text-neon-cyan" },
  scholarship: { icon: Award, label: "Scholarship", color: "text-neon-amber" },
  university_program: {
    icon: GraduationCap,
    label: "University",
    color: "text-neon-violet",
  },
} as const;

function scoreColor(n: number): string {
  if (n >= 70) return "text-neon-green border-neon-green/40 bg-neon-green/10";
  if (n >= 45) return "text-neon-amber border-neon-amber/40 bg-neon-amber/10";
  return "text-neon-red border-neon-red/40 bg-neon-red/10";
}

export function OpportunityCard({
  opp,
  onPrepare,
  busy,
}: {
  opp: ScoredOpportunity;
  onPrepare?: (opp: ScoredOpportunity) => void;
  busy?: boolean;
}) {
  const meta = TYPE_META[opp.type];
  const Icon = meta.icon;

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={cn("mt-0.5", meta.color)}>
            <Icon size={20} />
          </span>
          <div>
            <h3 className="font-semibold leading-tight text-white">
              {opp.title}
            </h3>
            <p className="text-sm text-gray-400">{opp.organization}</p>
          </div>
        </div>
        <div
          className={cn(
            "flex flex-col items-center rounded-xl border px-2.5 py-1",
            scoreColor(opp.score.overall),
          )}
        >
          <span className="text-lg font-bold leading-none">
            {opp.score.overall}
          </span>
          <span className="text-[10px] uppercase tracking-wide opacity-80">
            match
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} /> {opp.location}
        </span>
        {opp.metrics.rating != null && (
          <span className="inline-flex items-center gap-1">
            <Star size={12} className="text-neon-amber" /> {opp.metrics.rating}
          </span>
        )}
        {opp.metrics.financialValue && (
          <span className="inline-flex items-center gap-1">
            <DollarSign size={12} className="text-neon-green" />
            {opp.metrics.financialValue}
          </span>
        )}
        {opp.metrics.deadline && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} /> {opp.metrics.deadline}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {opp.requirements.map((r) => {
          const matched = opp.score.matchedSkills.includes(r.toLowerCase());
          return (
            <span
              key={r}
              className={cn(
                "badge",
                matched
                  ? "border-neon-green/40 text-neon-green bg-neon-green/10"
                  : "border-white/10 text-gray-400",
              )}
            >
              {r}
            </span>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-gray-500">
        {opp.score.reasoning}
      </p>

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="badge border-white/10 text-gray-500">
          <Database size={11} /> {opp.source}
        </span>
        {onPrepare && (
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => onPrepare(opp)}
          >
            {busy ? "Preparing…" : "Prepare Application"}
          </button>
        )}
      </div>
    </div>
  );
}
