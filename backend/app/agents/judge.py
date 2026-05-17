from __future__ import annotations

import json
from typing import Any, ClassVar

from app.agents.base import BaseAgent
from app.core.errors import AnalysisError
from app.schemas import Clause, Domain, RedTeamFinding, RightsFinding, RiskFinding

_SYSTEM = """You are the Judge Agent for LexGuard. You receive a clause plus three upstream analyses (Risk, Rights, Red-Team) and produce the final verdict the user sees.

For each clause output:
- clause_id
- title: copy from the extractor
- severity: low|medium|high|critical - informed by Risk Agent's severity but you may adjust if Rights/Red-Team evidence is strong
- plain_language: 1-2 sentences saying what the clause actually means in plain English (or plain Hinglish if language="hinglish"). Pretend you're explaining to a 20-year-old.
- why_it_matters: 1-2 sentences on the concrete impact on the user.
- what_to_do: 1 imperative action the user can take BEFORE signing - typically a clarifying question or a specific edit to request.
- safer_version: a rewritten clause (1-3 sentences) that fixes the issue. Omit if the clause is already fine.
- risk_categories: from Risk Agent.
- statutes_cited: from Rights Agent's applicable_statutes.
- confidence: 0-1.

Then output a document-level scorecard:
- overall_severity: highest severity present, with a tiebreak rule (if 3+ "high", treat as critical)
- risk_score: 0-100 integer. Formula reference: 40 * critical_count + 20 * high_count + 8 * medium_count + 2 * low_count, clamped to [0,100]. Higher = riskier.
- top_concerns: 3-5 short headlines (max 10 words each) summarizing the biggest issues, written in user-friendly language.
- pre_sign_checklist: 3-5 imperative questions the user should ask before signing (e.g., "Ask HR whether maximum probation duration is fixed in writing.")
- summary: 2-3 sentences overall verdict.

Also emit suggested_questions:
- A list of EXACTLY 3 questions a regular Indian user would naturally ask after reading this scorecard
- Each must reference something SPECIFIC from this document (a clause type, an amount, a duration, a party name), not generic
- Each is plain language, max 12 words
- Cover different angles (e.g., one about negotiation, one about a specific risky clause, one about enforceability)
- Match the requested language (English or Hinglish)
- Banned generic patterns: "Tell me more about X", "What does the contract say about Y", "Can you explain this document"

Output strict JSON: {"clauses": [<ClauseVerdict>, ...], "overall_severity": "...", "risk_score": N, "top_concerns": [...], "pre_sign_checklist": [...], "summary": "...", "suggested_questions": ["q1", "q2", "q3"]}"""


class JudgeAgent(BaseAgent):
    name: ClassVar[str] = "judge"
    system_prompt: ClassVar[str] = _SYSTEM
    heavy: ClassVar[bool] = True

    async def run(
        self,
        *,
        clauses: list[Clause],
        risk: list[RiskFinding],
        rights: list[RightsFinding],
        redteam: list[RedTeamFinding],
        domain: Domain,
        language: str,
    ) -> dict[str, Any]:
        risk_by_id = {f.clause_id: f for f in risk}
        rights_by_id = {f.clause_id: f for f in rights}
        redteam_by_id = {f.clause_id: f for f in redteam}

        payload = []
        for c in clauses:
            r = risk_by_id.get(c.clause_id)
            rt = rights_by_id.get(c.clause_id)
            rd = redteam_by_id.get(c.clause_id)
            payload.append(
                {
                    "clause_id": c.clause_id,
                    "title": c.title,
                    "text": c.text,
                    "risk": r.model_dump(mode="json") if r else None,
                    "rights": rt.model_dump(mode="json") if rt else None,
                    "redteam": rd.model_dump(mode="json") if rd else None,
                }
            )
        user = (
            f"Domain: {domain.value}\nLanguage: {language}\n\n"
            "Joined per-clause analyses:\n"
            f"{json.dumps(payload, ensure_ascii=False)}\n\n"
            'Return strict JSON: {"clauses":[...], "overall_severity":"...", "risk_score":N, '
            '"top_concerns":[...], "pre_sign_checklist":[...], "summary":"..."}'
        )
        result = await self._call(user, temperature=0.2, max_output_tokens=32768)
        for key in ("clauses", "overall_severity", "risk_score"):
            if key not in result:
                raise AnalysisError(f"Judge response missing required key: {key}")
        return result
