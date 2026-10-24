// ---------------------------------------------------------------------------
// MemoryMiningService — extract structured facts from profile forms, CV text,
// and free-form feedback. Blueprint §3.1.1 / §5 Phase 1.
//
// Uses lightweight deterministic heuristics (no network) so mining works fully
// offline and is reproducible for the demo.
// ---------------------------------------------------------------------------

import type { MemoryRecord, StudentProfile } from "../types";
import { memoryStore } from "./store";

// A compact tech-skill lexicon used to pull skills out of free text.
const SKILL_LEXICON = [
  "typescript", "javascript", "react", "next.js", "node", "node.js", "python",
  "rust", "go", "golang", "java", "kotlin", "swift", "c++", "c#", "php",
  "ruby", "scala", "elixir", "sql", "postgres", "postgresql", "mysql",
  "mongodb", "redis", "graphql", "rest", "grpc", "docker", "kubernetes",
  "aws", "gcp", "azure", "terraform", "distributed systems", "machine learning",
  "ml", "ai", "deep learning", "pytorch", "tensorflow", "llm", "nlp",
  "data engineering", "devops", "microservices", "tailwind", "fastapi",
  "django", "flask", "spring", "express",
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+.# ]/g, " ").replace(/\s+/g, " ").trim();
}

export function extractSkills(text: string): string[] {
  const hay = ` ${normalize(text)} `;
  const found = new Set<string>();
  for (const skill of SKILL_LEXICON) {
    if (hay.includes(` ${skill} `)) found.add(skill);
  }
  return [...found];
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

export class MemoryMiningService {
  /**
   * Phase 1: ingest a full student profile. Seeds a profile record, individual
   * skill records, and preference records. Returns all created records.
   */
  async mineProfile(profile: StudentProfile): Promise<MemoryRecord[]> {
    const created: MemoryRecord[] = [];

    created.push(
      await memoryStore.create({
        kind: "profile",
        entity: "student_profile",
        content: `${profile.name || "Student"} — targeting ${
          profile.targetRole
        } (GPA ${profile.gpa}, prefers ${profile.location}). Ambition: ${
          profile.ambition
        }`,
        tags: [
          ...tokenize(profile.targetRole),
          ...tokenize(profile.ambition),
          ...tokenize(profile.location),
        ],
        trust: 0.95,
        meta: { gpa: profile.gpa, location: profile.location },
      }),
    );

    // Skills from the declared stack + mined from the CV text.
    const stackSkills = profile.stack.map((s) => normalize(s)).filter(Boolean);
    const cvSkills = extractSkills(profile.baseCv);
    const allSkills = [...new Set([...stackSkills, ...cvSkills])];
    for (const skill of allSkills) {
      created.push(
        await memoryStore.create({
          kind: "skill",
          entity: "student_profile",
          content: `Has skill: ${skill}`,
          tags: [skill, ...tokenize(skill)],
          trust: stackSkills.includes(skill) ? 0.9 : 0.7,
          meta: { declared: stackSkills.includes(skill) },
        }),
      );
    }

    // Preferred stack becomes a positive preference.
    if (profile.stack.length) {
      created.push(
        await memoryStore.create({
          kind: "preference",
          entity: "student_profile",
          content: `Prefers working with: ${profile.stack.join(", ")}`,
          tags: ["preference", "stack", ...stackSkills],
          trust: 0.9,
        }),
      );
    }

    return created;
  }

  /** Mine a free-form feedback / rejection reason into memory. */
  async mineFeedbackText(reason: string): Promise<MemoryRecord | null> {
    const trimmed = reason.trim();
    if (!trimmed) return null;
    const skills = extractSkills(trimmed);
    const dislike = /don'?t|dislike|hate|avoid|no |not |reject/i.test(trimmed);
    return memoryStore.create({
      kind: dislike ? "rejection" : "preference",
      entity: "student_profile",
      content: trimmed,
      tags: [dislike ? "rejection" : "preference", ...skills, ...tokenize(trimmed)],
      trust: 0.85,
      meta: { skills },
    });
  }
}

export const memoryMining = new MemoryMiningService();
