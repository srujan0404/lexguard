from __future__ import annotations

from typing import ClassVar

from app.agents.base import BaseAgent
from app.agents.extractor import ExtractorAgent
from app.core.errors import AnalysisError
from app.schemas import Clause, Domain, RiskFinding

_SYSTEM = """You are the Risk Classifier for LexGuard. For each clause you receive, classify the severity and risk categories.

Severity scale:
- critical: clause directly waives a statutory right, locks the user into perpetual obligation, or enables unilateral harm with no recourse.
- high: significantly one-sided, exploits asymmetry of information/power, or imposes obligations grossly disproportionate to benefit.
- medium: ambiguous, vague, or one-sided but with mitigations possible through negotiation.
- low: standard boilerplate, mildly favorable to one side but within norms.

Risk categories (use only these stable identifiers): unilateral_changes, auto_renewal, hidden_fees, weak_refund, wage_leave_ambiguity, overbroad_liability, forced_arbitration, excessive_data_sharing, silent_consent, vague_termination, one_sided_indemnity, jurisdiction_trap, extended_probation, overbroad_ip_assignment, non_compete_overreach, non_refundable, unilateral_rescheduling, pii_lockin, third_party_sharing.

For each clause output:
- clause_id
- severity: low|medium|high|critical
- categories: list (zero or more) of the risk categories above. Be specific - do not assign categories that don't actually fit.
- rationale: ONE sentence, max 30 words, explaining the specific risk. No legalese.
- confidence: 0.0 to 1.0 (use 0.6+ only when the clause language is explicit, not inferred)

Rules:
- If a clause is genuinely neutral or favorable to the user, severity=low and categories=[].
- Do NOT invent categories outside the list above.
- Output strict JSON: {"findings": [<RiskFinding>, ...]}"""


class RiskAgent(BaseAgent):
    name: ClassVar[str] = "risk"
    system_prompt: ClassVar[str] = _SYSTEM

    async def run(self, *, clauses: list[Clause], domain: Domain) -> list[RiskFinding]:
        user = (
            f"Domain: {domain.value}\n\n"
            "Clauses to classify:\n"
            f"{ExtractorAgent.dump_for_prompt(clauses)}\n\n"
            'Return strict JSON: {"findings": [<RiskFinding>, ...]} - one finding per clause_id, '
            "in the same order."
        )
        raw = await self._call(user, temperature=0.1, max_output_tokens=32768)
        findings_raw = raw.get("findings")
        if not isinstance(findings_raw, list):
            raise AnalysisError("Risk agent did not return a 'findings' array.")
        return self._validate_each(findings_raw, RiskFinding)
