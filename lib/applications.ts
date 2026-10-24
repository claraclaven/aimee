// ---------------------------------------------------------------------------
// Application records store. Persists applied/rejected opportunities and feeds
// exclusion IDs back into Zetaris discovery. Blueprint §5 Phase 6.
// ---------------------------------------------------------------------------

import { readJson, writeJson } from "./hmem/persist";
import type { ApplicationRecord } from "./types";

const APPS_FILE = "applications.json";

export async function allApplications(): Promise<ApplicationRecord[]> {
  return readJson<ApplicationRecord[]>(APPS_FILE, []);
}

export async function recordApplication(
  rec: ApplicationRecord,
): Promise<ApplicationRecord[]> {
  const apps = await allApplications();
  const existing = apps.findIndex((a) => a.opportunityId === rec.opportunityId);
  if (existing >= 0) apps[existing] = rec;
  else apps.push(rec);
  await writeJson(APPS_FILE, apps);
  return apps;
}

export async function appliedOrRejectedIds(): Promise<string[]> {
  return (await allApplications()).map((a) => a.opportunityId);
}
