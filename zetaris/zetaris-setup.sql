-- ---------------------------------------------------------------------------
-- Register the opportunity datasets in Zetaris as Lightning tables.
-- Run these statements ONE AT A TIME in the Zetaris SQL Workspace, waiting for
-- each to finish. Assumes the CSVs were copied into the driver container at
-- /tmp (see SETUP.md, Path A).
--
-- Column layout (all tables identical):
--   id, title, organization, location, field, requirements, rating,
--   financial_value, deadline
-- `requirements` is a ';'-separated list; the app splits it client-side.
-- ---------------------------------------------------------------------------

-- 1. Create the Lightning database that holds all three sources.
CREATE LIGHTNING DATABASE IF NOT EXISTS opportunities;

-- 2. Universities.
CREATE LIGHTNING TABLE opportunities.universities (
  id STRING,
  title STRING,
  organization STRING,
  location STRING,
  field STRING,
  requirements STRING,
  rating DOUBLE,
  financial_value STRING,
  deadline STRING
)
USING csv
OPTIONS (path '/tmp/universities.csv', header 'true', sep ',', quote '"');

-- 3. Scholarships.
CREATE LIGHTNING TABLE opportunities.scholarships (
  id STRING,
  title STRING,
  organization STRING,
  location STRING,
  field STRING,
  requirements STRING,
  rating DOUBLE,
  financial_value STRING,
  deadline STRING
)
USING csv
OPTIONS (path '/tmp/scholarships.csv', header 'true', sep ',', quote '"');

-- 4. Jobs.
CREATE LIGHTNING TABLE opportunities.jobs (
  id STRING,
  title STRING,
  organization STRING,
  location STRING,
  field STRING,
  requirements STRING,
  rating DOUBLE,
  financial_value STRING,
  deadline STRING
)
USING csv
OPTIONS (path '/tmp/jobs.csv', header 'true', sep ',', quote '"');

-- 5. Sanity check: one federated query across all three sources.
SELECT id, title, organization, field FROM opportunities.universities
UNION ALL
SELECT id, title, organization, field FROM opportunities.scholarships
UNION ALL
SELECT id, title, organization, field FROM opportunities.jobs;
