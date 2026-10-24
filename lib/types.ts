// ---------------------------------------------------------------------------
// Shared domain types for the Tertiary Education & Career Planner
// ---------------------------------------------------------------------------

// ----- Zetaris Federated Data Contract (Blueprint §3.3) --------------------

export type OpportunityType = "job" | "scholarship" | "university_program";

export type ZetarisSource =
  | "zetaris-uni-federation"
  | "zetaris-scholarship-lake"
  | "zetaris-jobmarket-feed";

export interface FederatedOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  organization: string; // University name or Company
  location: string;
  field: string;
  requirements: string[];
  metrics: {
    rating?: number; // e.g. 4.8/5 uni rating or glassdoor score
    financialValue?: string; // $85,000/yr salary or $20,000 scholarship
    deadline?: string;
  };
  source: ZetarisSource;
}

export interface ZetarisQuery {
  types?: OpportunityType[];
  field?: string;
  location?: string;
  keywords?: string[];
  // IDs to exclude (applied / rejected) — fed from H-MEM.
  excludeIds?: string[];
  // Stacks the student has rejected — filters listings referencing them.
  rejectedStacks?: string[];
}

// ----- Scored opportunity (Matching engine, Blueprint §5 Phase 3) ----------

export interface ScoreBreakdown {
  skillsFit: number; // 0..100
  trajectoryAlignment: number; // 0..100
  valueFeasibility: number; // 0..100
  overall: number; // 0..100 weighted
  matchedSkills: string[];
  missingSkills: string[];
  reasoning: string;
}

export interface ScoredOpportunity extends FederatedOpportunity {
  score: ScoreBreakdown;
}

// ----- H-MEM Memory records (Blueprint §3.1) -------------------------------

export type MemoryKind =
  | "profile"
  | "skill"
  | "preference"
  | "rejection"
  | "application"
  | "feedback";

export type FeedbackSignal = "helpful" | "rejected" | "neutral";

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  entity: string; // e.g. "student_profile"
  content: string; // human-readable fact
  tags: string[]; // lexical keys for hybrid retrieval
  trust: number; // 0..1 confidence, decays with contradiction
  createdAt: number;
  updatedAt: number;
  superseded?: boolean; // true when a newer preference overrides this
  supersededBy?: string; // id of superseding record
  feedback?: FeedbackSignal;
  meta?: Record<string, unknown>;
}

// ----- Trust Ledger (Blueprint §3.1.4) -------------------------------------

export type LedgerAction =
  | "create"
  | "update"
  | "supersede"
  | "feedback"
  | "apply"
  | "prune";

export interface LedgerEntry {
  id: string;
  action: LedgerAction;
  recordId: string;
  hash: string; // cryptographic trust hash of the record snapshot
  prevHash: string; // chained to previous entry (append-only integrity)
  summary: string;
  timestamp: number;
}

// ----- Student profile input ------------------------------------------------

export interface StudentProfile {
  name: string;
  targetRole: string;
  stack: string[];
  gpa: string;
  location: string;
  ambition: string;
  baseCv: string;
}

// ----- Application / tailoring artifacts -----------------------------------

export interface TailorResult {
  opportunityId: string;
  tailoredCv: string;
  coverLetter: string;
  baseCv: string;
  provider: {
    mode: string;
    online: boolean;
    note: string;
  };
}

export interface ApplicationRecord {
  opportunityId: string;
  title: string;
  organization: string;
  status: "applied" | "rejected";
  reason?: string;
  tailoredCvSnapshot?: string;
  timestamp: number;
}

// ----- Provider status (Blueprint §3.2) ------------------------------------

export type ProviderStatus = "online" | "unauthorized" | "offline";

export interface ProviderState {
  url: string;
  status: ProviderStatus;
  models: string[];
  note: string;
}
