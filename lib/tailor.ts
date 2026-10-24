// ---------------------------------------------------------------------------
// CV & Cover Letter tailoring. Blueprint §5 Phase 4.
// Routes through the Meterless Runtime provider (meterless/auto). If the
// runtime is offline/unauthorized, falls back to a deterministic local
// tailoring engine so the demo always produces a diffable result.
// ---------------------------------------------------------------------------

import { MeterlessProvider } from "./meterless-provider";
import { memoryRetrieval } from "./hmem/retrieval";
import type { FederatedOpportunity, TailorResult } from "./types";

function buildPrompt(
  baseCv: string,
  opp: FederatedOpportunity,
  memoryContext: string,
): string {
  return [
    "You are a career assistant. Rewrite the candidate's CV to target the role",
    "below. Prioritise relevant projects and skills. Use STAR-format,",
    "action-driven bullet points. Then write a concise, personalised cover",
    "letter referencing mutual alignment.",
    "",
    `# Target Opportunity\n${opp.title} @ ${opp.organization} (${opp.location})`,
    `Field: ${opp.field}`,
    `Requirements: ${opp.requirements.join(", ")}`,
    "",
    `# Known Student Memory (H-MEM)\n${memoryContext}`,
    "",
    `# Base CV\n${baseCv}`,
    "",
    "Return the tailored CV first, then a line '---COVER LETTER---', then the letter.",
  ].join("\n");
}

/**
 * Deterministic fallback tailoring used when no runtime is available.
 * Reorders/annotates CV lines to surface requirement-matching keywords and
 * synthesises a short cover letter. Always yields a meaningful diff.
 */
function localTailor(
  baseCv: string,
  opp: FederatedOpportunity,
): { cv: string; letter: string } {
  const reqs = opp.requirements.map((r) => r.toLowerCase());
  const lines = baseCv.split("\n");

  const header = `# Tailored CV — targeting ${opp.title} @ ${opp.organization}`;
  const highlight = `**Key alignment:** ${opp.requirements.join(" · ")}`;

  const scored = lines
    .map((line, i) => {
      const lower = line.toLowerCase();
      const hits = reqs.filter((r) => lower.includes(r)).length;
      return { line, i, hits };
    })
    .sort((a, b) => b.hits - a.hits || a.i - b.i);

  const body = scored
    .map(({ line, hits }) => {
      if (!line.trim()) return line;
      if (hits > 0 && line.trim().startsWith("-")) {
        // Promote matching bullets into STAR-ish, action-driven phrasing.
        const content = line.replace(/^\s*-\s*/, "");
        return `- ⭐ Delivered ${content} — directly applicable to ${opp.field}.`;
      }
      return line;
    })
    .join("\n");

  const cv = `${header}\n\n${highlight}\n\n${body}`;

  const letter = [
    `Dear ${opp.organization} Hiring Team,`,
    "",
    `I am excited to apply for the ${opp.title} role. My background aligns`,
    `closely with your focus on ${opp.requirements.slice(0, 3).join(", ")}.`,
    `I am particularly drawn to ${opp.organization}'s work in ${opp.field},`,
    "and I am confident my hands-on experience would let me contribute quickly.",
    "",
    "Thank you for your consideration.",
    "",
    "Sincerely,",
    "The Candidate",
  ].join("\n");

  return { cv, letter };
}

export async function tailorApplication(
  baseCv: string,
  opp: FederatedOpportunity,
  mode = "meterless/auto",
): Promise<TailorResult> {
  const provider = new MeterlessProvider();
  const memoryContext = await memoryRetrieval.contextBlock(
    `${opp.title} ${opp.field} ${opp.requirements.join(" ")}`,
    8,
  );

  // Probe readiness; only attempt a real call if online + valid token.
  const state = await provider.autoDetect();
  const canCall = state.status === "online" && provider.hasValidToken();

  if (canCall) {
    try {
      const out = await provider.complete(
        buildPrompt(baseCv, opp, memoryContext),
        mode,
      );
      const [cvPart, letterPart] = out.split("---COVER LETTER---");
      return {
        opportunityId: opp.id,
        tailoredCv: (cvPart ?? out).trim(),
        coverLetter: (letterPart ?? "").trim(),
        baseCv,
        provider: {
          mode,
          online: true,
          note: `Generated via Meterless Runtime (${mode}) at ${state.url}.`,
        },
      };
    } catch (err) {
      // Fall through to local tailoring on any runtime error.
      const { cv, letter } = localTailor(baseCv, opp);
      return {
        opportunityId: opp.id,
        tailoredCv: cv,
        coverLetter: letter,
        baseCv,
        provider: {
          mode,
          online: false,
          note: `Runtime call failed (${String(
            err,
          )}); used local fallback tailoring.`,
        },
      };
    }
  }

  const { cv, letter } = localTailor(baseCv, opp);
  return {
    opportunityId: opp.id,
    tailoredCv: cv,
    coverLetter: letter,
    baseCv,
    provider: {
      mode,
      online: false,
      note: `Meterless Runtime ${state.status}; used local fallback tailoring so the demo still works.`,
    },
  };
}
