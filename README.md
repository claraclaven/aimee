# 🎓 Tertiary Education & Career Planner

An autonomous, local-first agent that **knows you, finds matching opportunities across federated data, and continuously prepares applications for you with human approval.**

Built from the Open Agent Hackathon 2026 blueprint. Integrates:

- **Meterless H-MEM** — a compounding, tiered memory graph (mining, store, hybrid retrieval, append-only trust ledger, sleep-cycle consolidation).
- **Meterless Runtime Provider (Power Contract 0.90.0)** — first-class LLM provider with URL normalization, model discovery, status probing, port auto-detect, and a 180s timeout. Falls back to local tailoring when no runtime is present, so the app always demos.
- **Zetaris Federated Data Harness** — one query surface over universities, scholarships, and jobs.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Zetaris + Meterless values
npm run dev                  # http://localhost:3001
```

> The app runs on **port 3001** so it coexists with the Zetaris web UI on 3000.

## Connecting real Zetaris (Data layer)

The Opportunity Radar federates three tables — `universities`, `scholarships`,
`jobs` — through your local Zetaris instance in a single UNION ALL query. To
wire it up:

1. Start Zetaris locally (see the Participant Setup Guide), then register the
   opportunity data: follow `zetaris/SETUP.md` (copy the CSVs into the driver
   container and run `zetaris/zetaris-setup.sql` in the SQL Workspace).
2. Create an API key in the Zetaris UI and put your connection details in
   `.env.local` (`ZETARIS_REST_URL`, `ZETARIS_ORG_ID`, `ZETARIS_API_KEY`,
   `ZETARIS_CATALOG`).
3. Verify the live connection:
   ```bash
   npm run zetaris:ping
   ```

When Zetaris is reachable the Radar shows a green **"Live Zetaris federation"**
badge; if the key is missing or a query fails, it shows an amber **"Mock
fallback"** badge and serves the bundled dataset so the demo never breaks.

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

## Agent activity logs

Every agent run writes a structured **JSONL** trace to
`logs/agent-activity.jsonl`, one JSON object per step, so the agent's real work
is auditable (not hardcoded output). Each entry records the acting agent, the
action, status, and relevant detail (Zetaris queries, rows returned, the model
call, H-MEM ledger hashes, the human decision).

View the most recent entries live at **`GET /api/activity`** while the app runs.

A single "find → tailor → approve" cycle produces a trace like this:

```jsonl
{"ts":"2026-10-26T09:12:01.004Z","runId":"a1b2","step":"discover","agent":"orchestrator","action":"received user request to find & rank opportunities","status":"ok","detail":{"rank":true}}
{"ts":"2026-10-26T09:12:01.051Z","runId":"a1b2","step":"memory-retrieval","agent":"hmem","action":"loaded memory to filter the search","status":"ok","detail":{"activeMemories":14,"excludeIds":[],"rejectedStacks":["php"]}}
{"ts":"2026-10-26T09:12:03.233Z","runId":"a1b2","step":"zetaris-federation","agent":"zetaris-client","action":"federated query across universities, scholarships, jobs","status":"ok","detail":{"dataSource":"zetaris-rest","rowsReturned":18,"note":"Federated 18 rows via Zetaris REST"}}
{"ts":"2026-10-26T09:12:03.260Z","runId":"a1b2","step":"match","agent":"scoring-engine","action":"ranked opportunities by skills fit, trajectory, value","status":"ok","detail":{"targetRole":"Software Engineer","candidates":18,"topMatch":{"id":"job-stripe-swe","title":"Software Engineer, Payments Infrastructure","score":67}}}
{"ts":"2026-10-26T09:12:09.880Z","runId":"a1b2","step":"tailor","agent":"meterless-provider","action":"generate tailored CV + cover letter","status":"ok","detail":{"provider":"Meterless Runtime → NVIDIA Nemotron","mode":"meterless/auto","cvChars":1840,"coverLetterChars":720}}
{"ts":"2026-10-26T09:12:40.512Z","runId":"a1b2","step":"human-approval","agent":"human","action":"student approved Software Engineer, Payments Infrastructure","status":"ok","detail":{"decision":"approve"}}
{"ts":"2026-10-26T09:12:40.600Z","runId":"a1b2","step":"memory-write","agent":"hmem","action":"recorded application to append-only trust ledger","status":"ok","detail":{"ledgerAction":"apply","hash":"9f3c…","prevHash":"7a1b…"}}
```

## Three sample inputs and outputs

### 1. Job search for a final-year CS student
**Input** (profile + goal):
```json
{ "name": "John Doe", "targetRole": "Software Engineer",
  "stack": ["TypeScript","React","Python"], "gpa": "3.8",
  "ambition": "Build large-scale distributed systems" }
```
**Output** (ranked via Zetaris + H-MEM): top matches
`Software Engineer, Payments Infrastructure @ Stripe (67% match)`,
`Full-Stack Engineer @ Vercel (61%)`, `Systems Engineer (Rust) @ Fermyon (57%)`,
each with a skills-fit breakdown and a `zetaris-jobmarket-feed` source badge.

### 2. Tailoring a CV + cover letter for a chosen role
**Input**: base CV + the Stripe Software Engineer listing, sent to
`POST /api/tailor`.
**Output**: a role-targeted CV (summary rewritten for payments/distributed
systems, bullets reordered, STAR phrasing) plus a matching cover letter,
generated through **Meterless Runtime → NVIDIA Nemotron**
(`"online": true`, `note: "Generated via Meterless Runtime (meterless/auto)"`),
with a green/red diff vs. the original and a downloadable PDF.

### 3. Learning from a rejection (memory supersession)
**Input**: reject the `PHP Web Developer` role with reason
*"I dislike PHP and strictly want TypeScript/Rust"* (`POST /api/applications`,
`decision: "reject"`).
**Output**: a rejection memory is mined into H-MEM, clashing preferences are
superseded, and on the **next** discovery run the PHP role is filtered out, the
`/api/zetaris` response shows `rejectedStacks` now includes `"php"` and the
listing no longer appears. The agent's search got sharper without a restart.

## Limitations

### Data is the real challenge, not the AI.

We demoed with a curated set of opportunities. Scaling to live, deduplicated,
trustworthy feeds of jobs/scholarships/programs is the hard problem — and it's
where we'd focus next.

- **Different portal constraints.** Different application portals have different
  structures and requirements, so the agent needs to keep learning and
  reinforcing itself to obtain better efficiency.
- **Compounding memory needs real usage to prove itself.** The system gets
  smarter as you give feedback. In a demo that's a few interactions — the
  genuine payoff only shows over weeks of real use, which we haven't been able
  to validate yet.
- **Output quality scales with model size.** Smaller models return empty or thin
  results on complex tailoring; we need a large model (Nemotron Ultra 550B) for
  reliable quality. That's a real cost/hardware tradeoff for anyone self-hosting.
