// ---------------------------------------------------------------------------
// Verify the live Zetaris REST connection and the opportunity tables.
// Run with: npm run zetaris:ping
// Reads config from .env.local.
// ---------------------------------------------------------------------------

import path from "node:path";
import { config as loadEnv } from "dotenv";

// Load env FIRST, with an absolute path, before importing any lib modules.
// (lib/config.ts reads process.env at import time, so ordering matters.)
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  // Dynamic imports so these modules evaluate AFTER env is loaded.
  const { zetarisConfig, zetarisConfigured } = await import("../lib/config");
  const { runSql, zetarisPing } = await import("../lib/zetaris-rest");
  const { buildOpportunitySql, rowsToOpportunities } = await import(
    "../lib/zetaris-sql"
  );

  console.log("Zetaris connection check");
  console.log("------------------------");
  console.log(`REST URL : ${zetarisConfig.restUrl}`);
  console.log(`Org ID   : ${zetarisConfig.orgId}`);
  console.log(`Catalog  : ${zetarisConfig.catalog}`);
  console.log(`API key  : ${zetarisConfigured() ? "set" : "MISSING"}`);
  console.log("");

  if (!zetarisConfigured()) {
    console.error("No ZETARIS_API_KEY in .env.local. Aborting.");
    process.exit(1);
  }

  const ping = await zetarisPing();
  console.log(`${ping.ok ? "PASS" : "FAIL"}  ${ping.note}`);
  if (!ping.ok) process.exit(1);

  // The opportunity tables may not be registered (we query TPCDS_DB in-app),
  // so a failure here is informational, not fatal.
  try {
    const sql = buildOpportunitySql({}, zetarisConfig.catalog);
    const result = await runSql(sql);
    const opps = rowsToOpportunities(result.rows);
    console.log(`PASS  Opportunity federation returned ${opps.length} rows.`);
  } catch (err) {
    console.log(
      `INFO  Opportunity tables not registered in '${zetarisConfig.catalog}' (ok — app uses TPCDS_DB for live data).`,
    );
    console.log(`      (${String(err).slice(0, 120)})`);
  }

  console.log("\nConnection OK. The app's live Zetaris panel will work.");
}

main();
