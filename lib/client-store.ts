"use client";

// Small localStorage-backed helper so the Profile / Radar / Applications pages
// share the base CV and selected opportunity across navigation without a
// server session. Demo convenience only.

import type { ScoredOpportunity, TailorResult } from "./types";

const KEYS = {
  baseCv: "tp.baseCv",
  selected: "tp.selectedOpp",
  tailor: "tp.tailorResult",
} as const;

function get<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const clientStore = {
  getBaseCv: () => get<string>(KEYS.baseCv) ?? "",
  setBaseCv: (cv: string) => set(KEYS.baseCv, cv),
  getSelected: () => get<ScoredOpportunity>(KEYS.selected),
  setSelected: (o: ScoredOpportunity) => set(KEYS.selected, o),
  getTailor: () => get<TailorResult>(KEYS.tailor),
  setTailor: (t: TailorResult) => set(KEYS.tailor, t),
};
