export type Severity = "low" | "medium" | "high" | "critical";

export type Domain =
  | "employment"
  | "privacy"
  | "ticketing"
  | "consumer"
  | "rental"
  | "generic";

export type Language = "en" | "hinglish";

export type RiskCategory =
  | "unilateral_changes"
  | "auto_renewal"
  | "hidden_fees"
  | "weak_refund"
  | "wage_leave_ambiguity"
  | "overbroad_liability"
  | "forced_arbitration"
  | "excessive_data_sharing"
  | "silent_consent"
  | "vague_termination"
  | "one_sided_indemnity"
  | "jurisdiction_trap"
  | "extended_probation"
  | "overbroad_ip_assignment"
  | "non_compete_overreach"
  | "non_refundable"
  | "unilateral_rescheduling"
  | "pii_lockin"
  | "third_party_sharing";

export interface ClauseVerdict {
  clause_id: string;
  title: string;
  severity: Severity;
  plain_language: string;
  why_it_matters: string;
  what_to_do: string;
  safer_version: string | null;
  risk_categories: RiskCategory[];
  statutes_cited: string[];
  statute_refs: string[];
  confidence: number;
  seen_in_n_others: number;
}

export interface Statute {
  id: string;
  act: string;
  section: string;
  title: string;
  summary: string;
  applies_to: string[];
  domains: string[];
}

export interface SeverityCounts {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface DocumentScorecard {
  document_id: string;
  domain: Domain;
  overall_severity: Severity;
  risk_score: number;
  counts: SeverityCounts;
  top_concerns: string[];
  pre_sign_checklist: string[];
  clauses: ClauseVerdict[];
  summary: string;
  processing_ms: number;
  model_versions: Record<string, string>;
  source_url: string | null;
  issuer_name: string | null;
  seen_before: number;
  suggested_questions: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface FollowupResponse {
  answer: string;
  document_id: string;
  cited_clause_ids: string[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: unknown;
  };
}
