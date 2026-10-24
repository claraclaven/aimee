# Registering the opportunity data in Zetaris

The app federates three opportunity tables through Zetaris:
`universities`, `scholarships`, `jobs` (combined via one UNION ALL query).
This folder holds the source data as CSV and the SQL to register it.

There are two supported paths. **Path A (SQL Editor)** is the quickest.

---

## Path A — Register via the Zetaris SQL Editor (recommended)

1. Make the CSV files reachable by the Zetaris containers. The simplest way is
   to copy them into the running `driver` container:

   ```bash
   # from WSL, in this folder (tertiary-planner/zetaris)
   docker cp universities.csv zetaris-driver-1:/tmp/universities.csv
   docker cp scholarships.csv zetaris-driver-1:/tmp/scholarships.csv
   docker cp jobs.csv         zetaris-driver-1:/tmp/jobs.csv
   ```

2. Open the Zetaris web UI at http://localhost:3000 → **SQL Workspace**.

3. Run the statements in `zetaris-setup.sql` **one at a time**, waiting for
   each to finish. They create a Lightning database called `opportunities` and
   register each CSV as a table.

4. Verify:

   ```sql
   SELECT opp_type, COUNT(*) FROM (
     SELECT 'university_program' AS opp_type FROM opportunities.universities
     UNION ALL SELECT 'scholarship' FROM opportunities.scholarships
     UNION ALL SELECT 'job' FROM opportunities.jobs
   ) t GROUP BY opp_type;
   ```

   Expect 6 universities, 5 scholarships, 7 jobs.

---

## Path B — Register through the UI wizard

Use **Register Data Source → File Source** in the web UI, upload each CSV,
and name the tables `universities`, `scholarships`, `jobs` inside a database
named `opportunities`. Make sure the column names match the CSV headers.

---

## Connect the app

In the project root, copy `.env.example` to `.env.local` and set:

```
ZETARIS_REST_URL=http://localhost:8888/api/v1.0
ZETARIS_ORG_ID=1
ZETARIS_API_KEY=<your key from the Zetaris UI>
ZETARIS_CATALOG=opportunities
```

Then `npm run dev` (the app runs on http://localhost:3001). The Opportunity
Radar will now pull from Zetaris; if the key is missing or the query fails, it
falls back to the bundled mock data so the demo never breaks.

Confirm the live path with:

```bash
npm run zetaris:ping
```
