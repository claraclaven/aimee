"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Mail, Cpu, Send, Download } from "lucide-react";
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

  /** Extract the candidate's name from the tailored CV's '# Name' heading. */
  function candidateName(): string {
    const m = tailor?.tailoredCv.match(/^#\s+(.+)$/m);
    return (m?.[1] ?? "Candidate").trim();
  }

  /** Convert simple Markdown (headings, bullets) to printable HTML. */
  function mdToHtml(md: string): string {
    const esc = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const out: string[] = [];
    let inList = false;
    const closeList = () => {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
    };
    for (const raw of md.split("\n")) {
      const line = raw.replace(/\r$/, "");
      if (!line.trim()) {
        closeList();
        continue;
      }
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^#\s+(.*)/))) {
        closeList();
        out.push(`<h1>${esc(m[1])}</h1>`);
      } else if ((m = line.match(/^##\s+(.*)/))) {
        closeList();
        out.push(`<h2>${esc(m[1])}</h2>`);
      } else if ((m = line.match(/^###\s+(.*)/))) {
        closeList();
        out.push(`<h3>${esc(m[1])}</h3>`);
      } else if ((m = line.match(/^[-*•]\s+(.*)/))) {
        if (!inList) {
          out.push("<ul>");
          inList = true;
        }
        out.push(`<li>${esc(m[1])}</li>`);
      } else {
        closeList();
        out.push(`<p>${esc(line.replace(/\*\*/g, ""))}</p>`);
      }
    }
    closeList();
    return out.join("\n");
  }

  /** Split the tailored CV markdown into named sections keyed by heading. */
  function parseCvSections(md: string): {
    name: string;
    title: string;
    contact: string;
    sections: { heading: string; html: string }[];
  } {
    const lines = md.split("\n");
    let name = candidateName();
    let title = "";
    let contact = "";
    const sections: { heading: string; html: string }[] = [];
    let current: { heading: string; buf: string[] } | null = null;
    let sawName = false;

    const flush = () => {
      if (current) {
        sections.push({
          heading: current.heading,
          html: mdToHtml(current.buf.join("\n")),
        });
        current = null;
      }
    };

    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      const h1 = line.match(/^#\s+(.*)/);
      const h2 = line.match(/^##\s+(.*)/);
      if (h1) {
        name = h1[1].trim();
        sawName = true;
        continue;
      }
      if (h2) {
        const h = h2[1].trim();
        // Treat Contact specially (goes in the header, not a column).
        if (/^contact/i.test(h)) {
          current = { heading: "__contact", buf: [] };
          continue;
        }
        flush();
        current = { heading: h, buf: [] };
        continue;
      }
      // First non-empty line right after the name = tagline/title.
      if (sawName && !title && !current && line.trim()) {
        title = line.trim();
        continue;
      }
      if (current?.heading === "__contact") {
        if (line.trim()) contact += (contact ? " · " : "") + line.trim();
        continue;
      }
      if (current) current.buf.push(line);
    }
    flush();
    return { name, title, contact, sections };
  }

  /**
   * Open a styled, two-column resume (plus the cover letter) in a print window
   * and trigger the browser's print dialog ("Save as PDF"). Reliable, no heavy
   * client libraries.
   */
  function downloadApplication() {
    if (!opp || !tailor) return;
    const { name, title, contact, sections } = parseCvSections(
      tailor.tailoredCv,
    );
    const docTitle = `${name} - ${opp.title} - ${opp.organization}`;

    // Route sections into left (main) and right (sidebar) columns by heading.
    const rightKeys = /skill|competenc|strength|language|certif|tool|award/i;
    const left = sections.filter((s) => !rightKeys.test(s.heading));
    const right = sections.filter((s) => rightKeys.test(s.heading));

    const col = (secs: { heading: string; html: string }[]) =>
      secs
        .map(
          (s) =>
            `<section><h2>${s.heading}</h2>${s.html}</section>`,
        )
        .join("\n");

    const letterHtml = tailor.coverLetter?.trim()
      ? mdToHtml(tailor.coverLetter)
      : "";

    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${docTitle}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1f2937;
         line-height: 1.45; font-size: 10.5pt; margin: 0; }
  .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 14px; }
  .name { font-size: 26pt; font-weight: 800; letter-spacing: .5px; color: #111827;
          text-transform: uppercase; margin: 0; }
  .title { color: #2563eb; font-weight: 600; font-size: 12pt; margin: 2px 0 6px; }
  .contact { color: #4b5563; font-size: 9.5pt; }
  .grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 26px; }
  h2 { font-size: 12pt; font-weight: 800; text-transform: uppercase; color: #111827;
       letter-spacing: .5px; border-bottom: 1.5px solid #d1d5db; padding-bottom: 3px;
       margin: 16px 0 8px; }
  section:first-child h2 { margin-top: 0; }
  h3 { font-size: 10.8pt; font-weight: 700; margin: 10px 0 1px; color: #111827; }
  p  { margin: 4px 0; }
  ul { margin: 4px 0 8px; padding-left: 16px; }
  li { margin: 2px 0; }
  .right section h2 { border-bottom-color: #2563eb; }
  .letter { margin-top: 26px; border-top: 2px solid #2563eb; padding-top: 16px;
            font-family: Georgia, serif; }
  .letter h1, .letter h2, .letter h3 { font-family: 'Segoe UI', Arial, sans-serif; }
  .page-break { page-break-before: always; }
  @media print { .noprint { display: none; } }
  .noprint { position: fixed; top: 10px; right: 10px; }
  .noprint button { font: 14px sans-serif; padding: 8px 14px; cursor: pointer;
                    background: #2563eb; color: #fff; border: 0; border-radius: 6px; }
</style></head>
<body>
  <div class="noprint"><button onclick="window.print()">Save as PDF / Print</button></div>
  <div class="header">
    <h1 class="name">${name}</h1>
    ${title ? `<div class="title">${title}</div>` : ""}
    ${contact ? `<div class="contact">${contact}</div>` : ""}
  </div>
  <div class="grid">
    <div class="main">${col(left)}</div>
    <div class="right">${col(right)}</div>
  </div>
  ${
    letterHtml
      ? `<div class="letter page-break"><h2>Cover Letter</h2>${letterHtml}</div>`
      : ""
  }
  <script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow pop-ups to download the PDF.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  /** Record the application AND open the printable PDF view. */
  async function approveAndDownload() {
    downloadApplication();
    await submit("approve");
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
            ? "Downloaded to your PC and recorded to the trust ledger."
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
              onClick={approveAndDownload}
              disabled={busy}
            >
              <Download size={15} /> Download CV &amp; Cover Letter (PDF)
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
