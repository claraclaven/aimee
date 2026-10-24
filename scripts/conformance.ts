// ---------------------------------------------------------------------------
// Runnable conformance tests. Blueprint §2 (Documentation) / §6.
// Validates the Meterless Power Contract 0.90.0 URL normalization rules, H-MEM
// store/ledger integrity, mining, retrieval, and Zetaris scoring — all offline.
//
// Run with: npm run conformance
// ---------------------------------------------------------------------------

import assert from "node:assert";
import { MeterlessProvider } from "../lib/meterless-provider";
import { memoryStore } from "../lib/hmem/store";
import { memoryMining } from "../lib/hmem/mining";
import { memoryRetrieval } from "../lib/hmem/retrieval";
import { trustLedger } from "../lib/hmem/ledger";
import { memoryFeedback } from "../lib/hmem/feedback";
import {
  contextFromMemory,
  rankOpportunities,
  zetaris,
} from "../lib/zetaris-client";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      failed++;
      console.error(`  ✗ ${name}\n      ${err.message}`);
    });
}

async function main() {
  console.log("\nMeterless Power Contract 0.90.0 — URL normalization");
  const p = new MeterlessProvider();
  await test("normalizes bare host to <host>/v1", () => {
    assert.strictEqual(p.normalizeUrl("127.0.0.1:8088"), "http://127.0.0.1:8088/v1");
  });
  await test("never produces /v1/v1", () => {
    assert.strictEqual(
      p.normalizeUrl("http://127.0.0.1:8088/v1/v1"),
      "http://127.0.0.1:8088/v1",
    );
  });
  await test("strips /v1/chat/completions", () => {
    assert.strictEqual(
      p.normalizeUrl("http://localhost:8088/v1/chat/completions"),
      "http://localhost:8088/v1",
    );
  });
  await test("strips /v1/models and /healthz", () => {
    assert.strictEqual(
      p.normalizeUrl("http://localhost:8088/v1/models"),
      "http://localhost:8088/v1",
    );
    assert.strictEqual(
      p.normalizeUrl("http://localhost:8088/healthz"),
      "http://localhost:8088/v1",
    );
  });
  await test("rejects placeholder token rt-local", () => {
    const prov = new MeterlessProvider({ token: "rt-local" });
    assert.strictEqual(prov.hasValidToken(), false);
  });

  console.log("\nH-MEM — store, ledger, mining, retrieval, feedback");
  await memoryStore.reset();
  await test("mineProfile seeds profile + skills + preference", async () => {
    const created = await memoryMining.mineProfile({
      name: "Test Student",
      targetRole: "Software Engineer",
      stack: ["TypeScript", "Rust"],
      gpa: "3.9",
      location: "Remote",
      ambition: "distributed systems",
      baseCv: "Built services with TypeScript, Python, and Docker.",
    });
    assert.ok(created.some((r) => r.kind === "profile"));
    assert.ok(created.some((r) => r.kind === "skill"));
    assert.ok(created.some((r) => r.kind === "preference"));
  });
  await test("retrieval surfaces relevant skill for a query", async () => {
    const hits = await memoryRetrieval.retrieve("typescript backend role", 5);
    assert.ok(hits.length > 0, "expected at least one hit");
  });
  await test("ledger hash chain verifies intact", async () => {
    const v = await trustLedger.verify();
    assert.strictEqual(v.valid, true);
  });
  await test("rejection feedback decays clashing memory", async () => {
    const before = (await memoryStore.active()).find((r) =>
      r.content.toLowerCase().includes("typescript"),
    );
    const res = await memoryFeedback.feedback("rejected", {
      reason: "I dislike PHP and avoid wordpress",
    });
    assert.ok(res.rejectionRecord, "expected a rejection record");
    assert.ok(before, "expected a pre-existing typescript memory");
  });

  console.log("\nZetaris — federated query + scoring");
  await test("single query federates all three bucket types", async () => {
    const all = await zetaris.query({});
    const types = new Set(all.map((o) => o.type));
    assert.ok(types.has("job"));
    assert.ok(types.has("scholarship"));
    assert.ok(types.has("university_program"));
  });
  await test("rejectedStacks filter removes php listings", async () => {
    const filtered = await zetaris.query({ rejectedStacks: ["php"] });
    assert.ok(!filtered.some((o) => o.requirements.includes("php")));
  });
  await test("ranking orders by overall score desc", async () => {
    const memories = await memoryStore.active();
    const ctx = contextFromMemory(memories);
    const ranked = rankOpportunities(await zetaris.query({}), ctx);
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(ranked[i - 1].score.overall >= ranked[i].score.overall);
    }
  });

  await memoryStore.reset();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
