"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Mail, Cpu, Send } from "lucide-react";
import { CvDiffViewer } from "@/components/CvDiffViewer";
import { clientStore } from "@/lib/client-store";
import { cn, formatTime } from "@/lib/utils";
import type {
  ApplicationRecord,
  ScoredOpportunity,
  TailorResult,
} from "@/lib/types";

const REJECT_REASONS = [
  "I dislike PHP and strictly want TypeScript/Rust",
  "I prefer backend roles",
  "Don't want defense contractors",
  "Location doesn't work for me",
];

export default function ApplicationsPage() {
  const [opp, setOpp] = useState<ScoredOpportunity | null>(null);
  const [tailor, setTailor] = useState<TailorResult | null>(null);
  const [apps, setApps] = useState<ApplicationRecord[]>([]);
  const [decision, setDecision] = useState<string | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOpp(clientStore.getSelected());
    setTailor(clientStore.getTailor());
    loadApps();
  }, []);

  async function loadApps() {
    const data = await fetch("/api/applications").then((r) => r.json());
    setApps(data.applications ?? []);
  }

  async function submit(dec: "approve" | "reject") {
    if (!opp) return;
    setBusy(true);
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opportunityId: opp.id,
        title: opp.title,
        organization: opp.organization,
        decision: dec,
        reason: dec === "reject" ? reason : undefined,
        tailoredCvSnapshot: tailor?.tailoredCv,
      }),
    });
    setDecision(dec === "approve" ? "applied" : "rejected");
    setShowReject(false);
    await loadApps();
    setBusy(false);
  }

  if (!opp || !tailor) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">
            Application Review &amp; Diff
          </h1>
          <p className="text-sm text-gray-400">
            Prepare an application from the Opportunity Radar to review it here.
          </p>
        </header>
        <HistoryList apps={apps} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{opp.title}</h1>
          <p className="text-sm text-gray-400">
            {opp.organization} · {opp.location}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div
            className={cn(
              "rounded-xl border px-4 py-2 text-center",
              opp.score.overall >= 70
                ? "border-neon-green/40 text-neon-green bg-neon-green/10"
                : "border-neon-amber/40 text-neon-amber bg-neon-amber/10",
            )}
          >
            <span className="text-2xl font-bold">{opp.score.overall}</span>
            <span className="ml-1 text-xs uppercase">match</span>
          </div>
          <p className="max-w-xs text-right text-[11px] text-gray-500">
            {opp.score.reasoning}
          </p>
        </div>
      </header>

      {/* Provider provenance — calm, honest status chip */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
            tailor.provider.online
              ? "border-neon-green/40 text-neon-green bg-neon-green/10"
              : "border-neon-cyan/30 text-neon-cyan bg-neon-cyan/5",
          )}
          title={tailor.provider.note}
        >
          <Cpu size={12} />
          {tailor.provider.online
            ? `Generated via Meterless Runtime · NVIDIA Nemotron (${tailor.provider.mode})`
            : "Draft generated locally"}
        </span>
      </div>

      {decision && (
        <div
          className={cn(
            "card flex items-center gap-2 p-3 text-sm",
            decision === "applied" ? "text-neon-green" : "text-neon-red",
          )}
        >
          {decision === "applied" ? (
            <CheckCircle2 size={16} />
          ) : (
            <XCircle size={16} />
          )}
          {decision === "applied"
            ? "Approved & submitted. Snapshot recorded to the trust ledger."
            : "Rejected. Your reason was mined into H-MEM and will filter future discovery."}
        </div>
      )}

      {/* Side-by-side diff */}
      <CvDiffViewer base={tailor.baseCv} tailored={tailor.tailoredCv} />

      {/* Cover letter */}
      <div className="card p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-300">
          <Mail size={15} className="text-neon-cyan" /> Cover Letter Draft
        </h2>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-300">
          {tailor.coverLetter || "(no cover letter generated)"}
        </pre>
      </div>

      {/* Decision gate */}
      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
          Human-in-the-loop decision gate
        </h2>
        {!showReject ? (
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-approve"
              onClick={() => submit("approve")}
              disabled={busy}
            >
              <CheckCircle2 size={15} /> Approve &amp; Submit
            </button>
            <button
              className="btn-danger"
              onClick={() => setShowReject(true)}
              disabled={busy}
            >
              <XCircle size={15} /> Reject
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="label">
              Why are you rejecting this? (feeds preference supersession)
            </label>
            <select
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="…or type your own reason"
              onChange={(e) => e.target.value && setReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                className="btn-danger"
                onClick={() => submit("reject")}
                disabled={busy}
              >
                <Send size={15} /> Confirm rejection
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowReject(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <HistoryList apps={apps} />
    </div>
  );
}

function HistoryList({ apps }: { apps: ApplicationRecord[] }) {
  if (!apps.length) return null;
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-300">
        Decision History
      </h2>
      <ul className="space-y-2">
        {[...apps].reverse().map((a) => (
          <li
            key={a.opportunityId + a.timestamp}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-panel2 p-3 text-sm"
          >
            <div className="flex items-center gap-2">
              {a.status === "applied" ? (
                <CheckCircle2 size={15} className="text-neon-green" />
              ) : (
                <XCircle size={15} className="text-neon-red" />
              )}
              <span className="text-gray-200">
                {a.title}{" "}
                <span className="text-gray-500">@ {a.organization}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {a.reason && (
                <span className="hidden text-xs text-gray-500 sm:block">
                  “{a.reason}”
                </span>
              )}
              <span className="text-xs text-gray-600">
                {formatTime(a.timestamp)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
