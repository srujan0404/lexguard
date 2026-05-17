from __future__ import annotations

import json
from typing import Any, ClassVar

from app.agents.base import BaseAgent
from app.core.errors import AnalysisError
from app.schemas import Clause, Domain, RightsFinding

_SYSTEM = """You are the Rights Agent for LexGuard. For each clause + retrieved Indian statutory context, determine which statutes apply and whether the clause conflicts with statutory rights.

IMPORTANT:
- Cite ONLY statutes from the provided knowledge base context. If no provided statute clearly applies to a clause, return an empty applicable_statutes list - do NOT fabricate citations.
- Indian Penal Code (IPC) is criminal law and does NOT apply to contract clauses. Never cite IPC sections here.
- Frame conflicts factually ("clause restricts X which is protected under Y") - do not give legal advice.

For each clause output:
- clause_id
- applicable_statutes: list of strings, format "Act Name §Section - Title" (taken from the KB context, not invented)
- conflicts_with_rights: list of short phrases describing what statutory right the clause may infringe, e.g., "DPDP §11 right to data erasure", "ICA §27 freedom to engage in lawful profession". Empty list if no conflict.
- legal_explanation: 2-3 sentences in plain English explaining the legal landscape for this clause type in India.
- citations: list of statute IDs (from KB) you actually used.

Output strict JSON: {"findings": [<RightsFinding>, ...]}"""


class RightsAgent(BaseAgent):
    name: ClassVar[str] = "rights"
    system_prompt: ClassVar[str] = _SYSTEM

    async def run(
        self,
        *,
        clauses: list[Clause],
        retrieved_context: dict[str, list[dict[str, Any]]],
        domain: Domain,
    ) -> list[RightsFinding]:
        payload = []
        for c in clauses:
            payload.append(
                {
                    "clause_id": c.clause_id,
                    "title": c.title,
                    "text": c.text,
                    "statutes": [
                        {
                            "id": s["id"],
                            "act": s["act"],
                            "section": s["section"],
                            "title": s["title"],
                            "summary": s["summary"],
                        }
                        for s in retrieved_context.get(c.clause_id, [])
                    ],
                }
            )
        user = (
            f"Domain: {domain.value}\n\n"
            "Clauses with retrieved Indian-statute context (cite only from these):\n"
            f"{json.dumps(payload, ensure_ascii=False)}\n\n"
            'Return strict JSON: {"findings": [<RightsFinding>, ...]}'
        )
        raw = await self._call(user, temperature=0.1, max_output_tokens=32768)
        findings_raw = raw.get("findings")
        if not isinstance(findings_raw, list):
            raise AnalysisError("Rights agent did not return a 'findings' array.")
        return self._validate_each(findings_raw, RightsFinding)
