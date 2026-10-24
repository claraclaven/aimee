# 🎓 Tertiary Education & Career Planner

An autonomous, local-first agent that **knows you, finds matching opportunities across federated data, and continuously prepares applications for you with human approval.**

Built from the Open Agent Hackathon 2026 blueprint. Integrates:

- **Meterless H-MEM** — a compounding, tiered memory graph (mining, store, hybrid retrieval, append-only trust ledger, sleep-cycle consolidation).
- **Meterless Runtime Provider (Power Contract 0.90.0)** — first-class LLM provider with URL normalization, model discovery, status probing, port auto-detect, and a 180s timeout. Falls back to local tailoring when no runtime is present, so the app always demos.
- **Zetaris Federated Data Harness** — one query surface over universities, scholarships, and jobs.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Then walk the 6-phase loop:

1. **Profile & CV** (`/profile`) — fill in your details + base CV, click **Save to H-MEM**. Facts are mined and hashed into the ledger.
2. **Opportunity Radar** (`/radar`) — click **Match & Rank**. A single Zetaris query federates jobs, scholarships, and programs, ranked against your memory.
3. **Prepare Application** — routes your CV + the listing through Meterless Runtime (`meterless/auto`).
4. **Review & Diff** (`/applications`) — side-by-side CV diff (+green / -red), cover letter, and the human-in-the-loop decision gate.
5. **Approve** records an audited application; **Reject** mines your reason into H-MEM.
6. **Memory Ledger** (`/memory`) — inspect the compounding graph, verify the hash chain, and run a **Sleep Cycle** to consolidate.

### The "wow" moment
Reject a role with *"I dislike PHP and strictly want TypeScript/Rust"*, then re-run discovery on the Radar — the PHP listing is gone. The rejection superseded the old assumption automatically.

## Meterless Runtime (optional)

The app auto-detects a runtime on ports `8088`, `8090`, `8787`, `11434` across `127.0.0.1`, `localhost`, `[::1]`. Set a token via `METERLESS_RUNTIME_TOKEN`. With no runtime, a deterministic local tailoring engine is used so every feature still works offline.

## Conformance tests

```bash
npm run conformance
```

Validates the Power Contract URL rules, H-MEM store/ledger integrity, retrieval, feedback supersession, and Zetaris federation + scoring.

## Architecture

| Feature | Engine service | Source |
|---|---|---|
| Save profile & CV | `MemoryMiningService` + `MemoryStoreService` | `lib/hmem/mining.ts`, `lib/hmem/store.ts` |
| Context retrieval for tailoring | `MemoryRetrievalService` (hybrid) | `lib/hmem/retrieval.ts` |
| Preference supersession & pruning | `SleepCycleService` | `lib/hmem/sleep.ts` |
| Audit of past applications | `TrustLedgerService` (append-only) | `lib/hmem/ledger.ts` |
| Feedback loop | Memory Feedback API | `lib/hmem/feedback.ts` |
| AI model execution | Meterless Runtime provider | `lib/meterless-provider.ts` |
| Federated discovery | Zetaris client + scoring | `lib/zetaris-client.ts` |

Memory and ledger persist to `./.data/*.json` across restarts.
