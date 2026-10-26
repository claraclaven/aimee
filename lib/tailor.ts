// ---------------------------------------------------------------------------
// CV & Cover Letter tailoring. Blueprint §5 Phase 4.
// Routes through the Meterless Runtime provider (meterless/auto). If the
// runtime is offline/unauthorized, falls back to a deterministic local
// tailoring engine so the demo always produces a diffable result.
// ---------------------------------------------------------------------------

import { MeterlessProvider } from "./meterless-provider";
import { memoryRetrieval } from "./hmem/retrieval";
import type { FederatedOpportunity, TailorResult } from "./types";

/**
 * Reasoning models (e.g. Nemotron) sometimes emit chain-of-thought before the
 * answer. Strip anything before the real document begins so the UI shows the
 * CV, not the model's scratchpad.
 */
function stripReasoning(text: string): string {
  let t = text.trim();

  // Remove <think>...</think> blocks some models wrap reasoning in.
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // If the model preambled, jump to the first real Markdown heading ('# ').
  const h1 = t.indexOf("# ");
  if (h1 > 0) {
    // Only trim if there's obvious preamble before the heading.
    const preamble = t.slice(0, h1).toLowerCase();
    if (
      /the user|let me|i will|i'll|analyze|here(?:'s| is)|rewrite|first,|okay|sure/.test(
        preamble,
      )
    ) {
      t = t.slice(h1);
    }
  }
  return t.trim();
}

/** Human-readable label for the opportunity type, used to steer tone. */
function opportunityKind(opp: FederatedOpportunity): string {
  switch (opp.type) {
    case "scholarship":
      return "scholarship application (write a motivation letter)";
    case "university_program":
      return "university program application (write a statement of purpose)";
    default:
      return "job application (write a cover letter)";
  }
}

function buildPrompt(
  baseCv: string,
  opp: FederatedOpportunity,
  memoryContext: string,
): string {
  return [
    "You are an expert career writer. Tailor the candidate's CV to the",
    "opportunity below, then write a matching application letter.",
    "",
    `This opportunity is a ${opportunityKind(opp)}. Adapt tone and emphasis to`,
    "its type:",
    "- job: emphasise relevant work/projects, skills, and measurable impact.",
    "- scholarship: emphasise academic achievement, goals, leadership, and fit",
    "  with the scholarship's mission; it is a motivation letter, not a job pitch.",
    "- university_program: emphasise academic background, research interests, and",
    "  why this program; it is a statement of purpose, not a job application.",
    "",
    "IMPORTANT: the two worked examples further below are included ONLY to show",
    "formatting and quality. They happen to describe a software role. Do NOT copy",
    "their tech/domain framing. Write about THIS candidate and THIS opportunity —",
    "if it is a scholarship or a program, the letter must read as a motivation",
    "letter / statement of purpose, not a software-engineering cover letter.",
    "",
    "CRITICAL OUTPUT RULES:",
    "- Output ONLY the finished, polished document — as if printing a real CV.",
    "- NO planning notes, NO meta-commentary, NO explanations of your choices.",
    "- NEVER write phrases like 'should highlight', 'reorder so', 'most relevant',",
    "  'let me', 'the user wants', or parentheticals explaining why something is",
    "  included. A reader sees only finished prose and bullets.",
    "- Do NOT number your thinking. Bullets describe real achievements, not plans.",
    "- Start the response immediately with '# <candidate name>'.",
    "",
    "WRONG (never do this):",
    "  ## Summary",
    "  Should highlight payments experience and distributed systems...",
    "  ## Experience - reorder so most relevant first:",
    "  1. Internship (most relevant - payments)",
    "RIGHT:",
    "  ## Summary",
    "  Final-year CS student and payments-team intern specialising in...",
    "  ## Experience",
    "  - Engineered REST payment APIs on a PostgreSQL-backed service during a...",
    "",
    "## Rules (follow strictly)",
    "- Use ONLY facts present in the base CV and the candidate memory. Never",
    "  invent employers, dates, degrees, metrics, certifications, or skills the",
    "  candidate does not have. Only quantify with numbers already provided.",
    "- NEVER output placeholder brackets like [Phone Number], [Company Name],",
    "  [Year], or [X]%. If a value is unknown, leave it out entirely.",
    "- OMIT any section for which there is no real data. For example: if there",
    "  are no certifications, do NOT include a Certifications section at all. If",
    "  there are no formal jobs, skip Experience and rely on Projects. Never",
    "  print an empty section or a section full of placeholders.",
    "- Reorder so the most role-relevant content appears first.",
    "- Bullets are achievement-focused, start with a strong past-tense action",
    "  verb, and follow Situation/Task → Action → Result where possible.",
    "- Mirror the role's key terminology where it genuinely fits real experience.",
    "",
    "## Required CV format (use these exact section headings, in this order,",
    "## skipping any section with no real data)",
    "# [Candidate Full Name]",
    "## Contact",
    "(only the contact details actually known — e.g. email, location, links;",
    "omit this line entirely if none are known)",
    "## Professional Summary",
    "(2-3 sentences: who they are, targeted at this role)",
    "## Core Competencies",
    "(group real skills, e.g. 'Technical: ...', 'Tools & Platforms: ...')",
    "## Professional Experience",
    "(only real roles; '### [Title] | [Company] — [Location]' then dated bullets)",
    "## Key Projects",
    "(real projects with the technologies used)",
    "## Education",
    "(real degree(s), institution, year, relevant coursework/honors if known)",
    "## Certifications & Licenses",
    "(ONLY if the candidate actually has certifications — otherwise omit)",
    "",
    "## Cover letter format (follow this structure; omit any header line whose",
    "## value is unknown — never print a placeholder bracket)",
    "[Candidate Full Name]",
    "[Location] | [phone if known] | [email if known] | [links if known]",
    "[Today's date, e.g. the current month, day and year]",
    "[Recipient: 'Hiring Team' for a job; 'Scholarship Committee' for a",
    " scholarship; 'Admissions Committee' for a university program]",
    "[Target Organization / Company / University Name]",
    "[Location if known]",
    "RE: Application for [Exact Role / Scholarship / Program Name]",
    "",
    "Dear [Hiring Team / Scholarship Committee / Admissions Committee],",
    "",
    "Paragraph 1 — Hook & value: state interest in the exact role at the company,",
    "  the candidate's core identity, 2-3 real headline skills, and why this org.",
    "Paragraph 2 — Technical alignment: a short lead-in sentence, then 3-4 bullet",
    "  points, each '• [Theme]: <real achievement using real tools/projects>'.",
    "Paragraph 3 — Ambition & fit: tie the candidate's real ambition to the",
    "  company's specific technical focus.",
    "Paragraph 4 — Call to action: thank them and invite a conversation.",
    "",
    "Sincerely,",
    "[Full Name]",
    "[email | phone if known]",
    "",
    "Cover letter rules:",
    "- Use ONLY real facts; never invent a phone number, company address, job ID,",
    "  or metric. Omit unknown header fields rather than writing a placeholder.",
    "- No clichéd empty filler; every bullet references real experience.",
    "",
    `## Target role\n${opp.title} @ ${opp.organization} (${opp.location})`,
    `Field: ${opp.field}`,
    `Key requirements: ${opp.requirements.join(", ")}`,
    "",
    `## What we know about the candidate (memory)\n${memoryContext}`,
    "",
    `## Candidate's base CV\n${baseCv}`,
    "",
    "## Example of the expected shape (STYLE only — never copy these facts, and",
    "## note how a candidate with no certifications simply has NO Certifications",
    "## section):",
    "```",
    "# Jane Tan",
    "## Contact",
    "jane.tan@email.com · Singapore · github.com/janetan",
    "## Professional Summary",
    "Final-year CS student targeting backend roles, with internship experience",
    "building payment services and a focus on distributed systems.",
    "## Core Competencies",
    "Technical: TypeScript, Go, PostgreSQL, distributed systems",
    "Tools & Platforms: Docker, REST APIs, Git",
    "## Professional Experience",
    "### Software Engineering Intern | Acme Pay — Remote",
    "Jun 2024 – Aug 2024",
    "- Built REST payment endpoints on a PostgreSQL service, improving reliability.",
    "## Key Projects",
    "### Raft Consensus Engine | Go",
    "- Implemented leader election and log replication to study fault tolerance.",
    "## Education",
    "BSc Computer Science — National University, 2025",
    "```",
    "(Jane has no certifications, so there is no Certifications section. Do the",
    "same: only include sections backed by real data.)",
    "",
    "## Example of a strong COVER LETTER (STYLE only — never copy these facts):",
    "```",
    "John Doe",
    "Remote | john.doe@email.com | github.com/johndoe",
    "October 26, 2026",
    "Engineering Hiring Team",
    "Acme Cloud Technologies",
    "Remote / San Francisco, CA",
    "RE: Application for Software Engineer (Distributed Systems & Backend)",
    "",
    "Dear Engineering Hiring Team,",
    "",
    "I am writing to express my enthusiasm for the Software Engineer role at Acme",
    "Cloud Technologies. As a final-year Computer Science student specializing in",
    "backend engineering and distributed systems, I have deployed services using",
    "TypeScript, Python, and Go. Acme's focus on reliable, low-latency cloud",
    "infrastructure aligns with my passion for resilient distributed architectures.",
    "",
    "Throughout my coursework and internships I have applied these principles:",
    "• Distributed Consensus: Implemented the Raft algorithm in Go, handling",
    "  leader election and log replication under simulated partitions.",
    "• Real-Time Concurrency: Built a Node.js/WebSocket messaging app with an",
    "  event-driven architecture for sub-second dispatch.",
    "• Backend & Data: Engineered transactional endpoints on a payments team with",
    "  PostgreSQL and REST APIs, ensuring strict consistency.",
    "",
    "My ambition is to build large-scale distributed systems that stay",
    "fault-tolerant under heavy concurrency, exactly the environment Acme offers.",
    "",
    "Thank you for your time. I look forward to discussing how my background",
    "aligns with your engineering roadmap.",
    "",
    "Sincerely,",
    "John Doe",
    "john.doe@email.com",
    "```",
    "Note: John had no phone number, so none is shown — omit unknown fields.",
    "",
    "## Output format (exactly)",
    "Return the tailored CV in Markdown first. Then a line containing only",
    "'---COVER LETTER---'. Then the cover letter. No other commentary.",
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
  const parsed = parseBaseCv(baseCv);
  const name = parsed.name || "Candidate";

  // Order skills so role-relevant ones lead.
  const reqSet = new Set(opp.requirements.map((r) => r.toLowerCase()));
  const skills = [...parsed.skills].sort((a, b) => {
    const ar = reqSet.has(a.toLowerCase()) ? 0 : 1;
    const br = reqSet.has(b.toLowerCase()) ? 0 : 1;
    return ar - br;
  });

  // Build the CV in the required section format, skipping empty sections.
  const cv: string[] = [`# ${name}`];
  if (parsed.contact) cv.push("", "## Contact", parsed.contact);

  cv.push(
    "",
    "## Professional Summary",
    parsed.summary ||
      `${roleIdentity(parsed, opp)} seeking the ${opp.title} opportunity at ${
        opp.organization
      }, with strengths in ${(skills.slice(0, 4).join(", ") || opp.field)}.`,
  );

  if (skills.length) {
    cv.push("", "## Core Competencies", `Technical: ${skills.join(", ")}`);
  }
  if (parsed.experience.length) {
    cv.push("", "## Professional Experience");
    for (const e of parsed.experience) cv.push(`- ${e}`);
  }
  if (parsed.projects.length) {
    cv.push("", "## Key Projects");
    for (const p of parsed.projects) cv.push(`- ${p}`);
  }
  if (parsed.education.length) {
    cv.push("", "## Education");
    for (const ed of parsed.education) cv.push(ed);
  }

  // Cover letter adapts to the opportunity type.
  const recipient =
    opp.type === "scholarship"
      ? "Scholarship Committee"
      : opp.type === "university_program"
        ? "Admissions Committee"
        : `${opp.organization} Hiring Team`;
  const roleWord =
    opp.type === "scholarship"
      ? "scholarship"
      : opp.type === "university_program"
        ? "program"
        : "role";
  const topSkills = skills.slice(0, 3).join(", ") || opp.field;
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const letterLines = [name];
  if (parsed.contact) letterLines.push(parsed.contact);
  letterLines.push(
    date,
    recipient,
    opp.organization,
    opp.location,
    `RE: Application for ${opp.title}`,
    "",
    `Dear ${recipient},`,
    "",
    `I am writing to express my strong interest in the ${opp.title} ${roleWord} at ${opp.organization}. ${roleIdentity(parsed, opp)} with a focus on ${topSkills}, I am drawn to ${opp.organization}'s work in ${opp.field}.`,
    "",
    `My background aligns closely with what this ${roleWord} calls for:`,
  );

  const proof = [...parsed.experience, ...parsed.projects].slice(0, 3);
  if (proof.length) {
    for (const p of proof) letterLines.push(`• ${p}`);
  } else if (skills.length) {
    letterLines.push(
      `• Hands-on experience with ${skills.slice(0, 5).join(", ")}.`,
    );
  }

  letterLines.push(
    "",
    `I am confident my background in ${topSkills} would let me contribute meaningfully, and I would welcome the chance to discuss my fit for this ${roleWord}.`,
    "",
    "Thank you for your time and consideration.",
    "",
    "Sincerely,",
    name,
  );

  return { cv: cv.join("\n"), letter: letterLines.join("\n") };
}

interface ParsedCv {
  name: string;
  contact: string;
  summary: string;
  skills: string[];
  experience: string[];
  projects: string[];
  education: string[];
}

/** Lightweight section parser for a plain-text base CV (no model needed). */
function parseBaseCv(baseCv: string): ParsedCv {
  const lines = baseCv.split("\n").map((l) => l.trim());
  const result: ParsedCv = {
    name: "",
    contact: "",
    summary: "",
    skills: [],
    experience: [],
    projects: [],
    education: [],
  };

  // First non-empty line that isn't a heading is treated as the name (strip a
  // trailing " — ..." descriptor).
  const firstReal = lines.find((l) => l.length > 0);
  if (firstReal) result.name = firstReal.split(/\s[—-]\s/)[0].trim();

  let section = "";
  for (const line of lines) {
    if (!line) continue;
    const lower = line.toLowerCase();
    if (/^summary\b/.test(lower)) {
      section = "summary";
      continue;
    }
    if (/^experience\b/.test(lower)) {
      section = "experience";
      continue;
    }
    if (/^projects?\b/.test(lower)) {
      section = "projects";
      continue;
    }
    if (/^skills?\b/.test(lower)) {
      section = "skills";
      continue;
    }
    if (/^education\b/.test(lower)) {
      section = "education";
      continue;
    }
    if (line === result.name) continue;

    const bullet = line.replace(/^[-•*]\s*/, "").trim();
    if (!bullet) continue;

    switch (section) {
      case "summary":
        result.summary = result.summary ? `${result.summary} ${bullet}` : bullet;
        break;
      case "experience":
        result.experience.push(bullet);
        break;
      case "projects":
        result.projects.push(bullet);
        break;
      case "education":
        result.education.push(bullet);
        break;
      case "skills":
        result.skills.push(
          ...bullet
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
        break;
      default:
        // Lines before any section: contact info if it looks like one.
        if (/@|\d{3}|linkedin|github|http/i.test(bullet) && !result.contact) {
          result.contact = bullet;
        }
    }
  }

  return result;
}

/** A short identity phrase derived from the CV summary/first line. */
function roleIdentity(parsed: ParsedCv, opp: FederatedOpportunity): string {
  if (/student/i.test(parsed.summary) || /student/i.test(parsed.name)) {
    return "As a motivated student";
  }
  return `As a candidate experienced in ${opp.field}`;
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

  // Attempt the real model call whenever a token is configured. We do NOT gate
  // on a fast autoDetect probe — that 600ms probe is flaky across the container
  // boundary and would wrongly fall back to the (poor) local engine even though
  // the real 180s-timeout call succeeds. If the real call fails, we fall back.
  if (provider.hasValidToken()) {
    try {
      // 75s cap: a fast lane finishes well under this; if the model is slow we
      // fall back to local tailoring rather than hanging the UI for minutes.
      const out = stripReasoning(
        await provider.complete(
          buildPrompt(baseCv, opp, memoryContext),
          mode,
          75_000,
        ),
      );
      const [cvPart, letterPart] = out.split("---COVER LETTER---");
      const tailoredCv = (cvPart ?? out).trim();
      // Guard against an empty/garbage model response.
      if (tailoredCv.length < 20) {
        throw new Error("Model returned an empty or too-short response.");
      }
      return {
        opportunityId: opp.id,
        tailoredCv,
        coverLetter: (letterPart ?? "").trim(),
        baseCv,
        provider: {
          mode,
          online: true,
          note: `Generated via Meterless Runtime (${mode}) at ${provider.getBaseUrl()}.`,
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
          note: `Meterless call failed (${String(
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
      note: `No Meterless runtime token configured; used local fallback tailoring so the demo still works.`,
    },
  };
}
