"use client";

import { useMemo } from "react";
import { diffLines } from "diff";
import { cn } from "@/lib/utils";

export function CvDiffViewer({
  base,
  tailored,
}: {
  base: string;
  tailored: string;
}) {
  const parts = useMemo(() => diffLines(base, tailored), [base, tailored]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Original */}
      <div className="card overflow-hidden">
        <div className="border-b border-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Original CV
        </div>
        <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-gray-300">
          {base || "(empty)"}
        </pre>
      </div>

      {/* Tailored with inline highlights */}
      <div className="card overflow-hidden">
        <div className="border-b border-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Tailored CV{" "}
          <span className="text-neon-green">+ added</span>{" "}
          <span className="text-neon-red">- removed</span>
        </div>
        <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed">
          {parts.map((p, i) => (
            <span
              key={i}
              className={cn(
                p.added &&
                  "block bg-neon-green/10 text-neon-green border-l-2 border-neon-green/60 pl-2",
                p.removed &&
                  "block bg-neon-red/10 text-neon-red line-through border-l-2 border-neon-red/60 pl-2",
                !p.added && !p.removed && "text-gray-400",
              )}
            >
              {p.value}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
