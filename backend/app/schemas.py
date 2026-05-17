from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Domain(str, Enum):
    EMPLOYMENT = "employment"
    PRIVACY = "privacy"
    TICKETING = "ticketing"
    CONSUMER = "consumer"
    RENTAL = "rental"
    GENERIC = "generic"


# Stable identifiers - frontends key off these strings. Never rename, only deprecate.
class RiskCategory(str, Enum):
    UNILATERAL_CHANGES = "unilateral_changes"
    AUTO_RENEWAL = "auto_renewal"
    HIDDEN_FEES = "hidden_fees"
    WEAK_REFUND = "weak_refund"
    WAGE_LEAVE_AMBIGUITY = "wage_leave_ambiguity"
    OVERBROAD_LIABILITY = "overbroad_liability"
    FORCED_ARBITRATION = "forced_arbitration"
    EXCESSIVE_DATA_SHARING = "excessive_data_sharing"
    SILENT_CONSENT = "silent_consent"
    VAGUE_TERMINATION = "vague_termination"
    ONE_SIDED_INDEMNITY = "one_sided_indemnity"
    JURISDICTION_TRAP = "jurisdiction_trap"
    EXTENDED_PROBATION = "extended_probation"
    OVERBROAD_IP_ASSIGNMENT = "overbroad_ip_assignment"
    NON_COMPETE_OVERREACH = "non_compete_overreach"
    NON_REFUNDABLE = "non_refundable"
    UNILATERAL_RESCHEDULING = "unilateral_rescheduling"
    PII_LOCKIN = "pii_lockin"
    THIRD_PARTY_SHARING = "third_party_sharing"


class ClauseType(str, Enum):
    DEFINITION = "definition"
    OBLIGATION = "obligation"
    RESTRICTION = "restriction"
    PAYMENT = "payment"
    TERMINATION = "termination"
    IP = "ip"
    CONFIDENTIALITY = "confidentiality"
    LIABILITY = "liability"
    JURISDICTION = "jurisdiction"
    DATA_PROCESSING = "data_processing"
    CONSENT = "consent"
    REFUND = "refund"
    FEES = "fees"
    WARRANTY = "warranty"
    INDEMNITY = "indemnity"
    DISPUTE_RESOLUTION = "dispute_resolution"
    OTHER = "other"


Language = Literal["en", "hinglish"]


class _ReqBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class AnalyzeTextRequest(_ReqBase):
    text: str = Field(..., min_length=20)
    domain_hint: Domain = Domain.GENERIC
    source_url: HttpUrl | None = None
    language: Language = "en"


class AnalyzeUrlRequest(_ReqBase):
    url: HttpUrl
    domain_hint: Domain = Domain.GENERIC
    language: Language = "en"


# protected_namespaces=() so `model_versions` on DocumentScorecard doesn't collide with Pydantic's "model_" guard.
class _DomBase(BaseModel):
    model_config = ConfigDict(extra="ignore", protected_namespaces=())


class Clause(_DomBase):
    clause_id: str
    title: str
    text: str
    clause_type: ClauseType = ClauseType.OTHER
    parties_affected: list[str] = Field(default_factory=list)
    cross_references: list[str] = Field(default_factory=list)
    start_offset: int | None = Field(default=None, ge=0)
    end_offset: int | None = Field(default=None, ge=0)


class RiskFinding(_DomBase):
    clause_id: str
    severity: Severity
    categories: list[RiskCategory] = Field(default_factory=list)
    rationale: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class RightsFinding(_DomBase):
    clause_id: str
    applicable_statutes: list[str] = Field(default_factory=list)
    conflicts_with_rights: list[str] = Field(default_factory=list)
    legal_explanation: str = ""
    citations: list[str] = Field(default_factory=list)


class RedTeamFinding(_DomBase):
    clause_id: str
    exploitation_scenario: str
    who_benefits: str
    harm_example: str


class ClauseVerdict(_DomBase):
    clause_id: str
    title: str
    severity: Severity
    plain_language: str
    why_it_matters: str
    what_to_do: str
    safer_version: str | None = None
    risk_categories: list[RiskCategory] = Field(default_factory=list)
    statutes_cited: list[str] = Field(default_factory=list)
    statute_refs: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.6, ge=0.0, le=1.0)
    seen_in_n_others: int = Field(default=0, ge=0)


class StatuteResponse(BaseModel):
    id: str
    act: str
    section: str
    title: str
    summary: str
    applies_to: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)


class SeverityCounts(_DomBase):
    low: int = 0
    medium: int = 0
    high: int = 0
    critical: int = 0


class DocumentScorecard(_DomBase):
    document_id: str
    domain: Domain
    overall_severity: Severity
    risk_score: int = Field(..., ge=0, le=100)
    counts: SeverityCounts
    top_concerns: list[str] = Field(default_factory=list)
    pre_sign_checklist: list[str] = Field(default_factory=list)
    clauses: list[ClauseVerdict] = Field(default_factory=list)
    summary: str = ""
    processing_ms: int = Field(..., ge=0)
    model_versions: dict[str, str] = Field(default_factory=dict)
    source_url: HttpUrl | None = None
    issuer_name: str | None = None
    seen_before: int = Field(default=0, ge=0)
    suggested_questions: list[str] = Field(default_factory=list)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class FollowupRequest(_ReqBase):
    question: str = Field(..., min_length=2, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list)
    language: Language = "en"


class FollowupResponse(BaseModel):
    answer: str
    document_id: str
    cited_clause_ids: list[str] = Field(default_factory=list)


class SuggestionsResponse(BaseModel):
    document_id: str
    suggestions: list[str]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"] = "ok"
    llm_backend: Literal["vertex", "aistudio"]
    version: str
    environment: Literal["dev", "prod"]
