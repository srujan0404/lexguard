from __future__ import annotations

import json
from dataclasses import dataclass
from typing import ClassVar

from app.agents.base import BaseAgent
from app.config import get_settings
from app.core.errors import AnalysisError
from app.schemas import Clause, Domain


@dataclass(frozen=True)
class ExtractorOutput:
    clauses: list[Clause]
    issuer_name: str | None

_SYSTEM = """You are the Clause Extractor for LexGuard, a contract-risk analysis system for Indian users.

Your job: segment a document into discrete clauses suitable for downstream analysis. Be precise about boundaries - each clause should be a single logical obligation, right, restriction, or definition.

For each clause, output:
- clause_id: "c1", "c2", ... (stable, sequential)
- title: a 2-5 word label (e.g., "Probation Period", "IP Assignment", "Data Sharing with Third Parties")
- text: the verbatim clause text from the document - do NOT paraphrase or summarize
- clause_type: one of [definition, obligation, restriction, payment, termination, ip, confidentiality, liability, jurisdiction, data_processing, consent, refund, fees, warranty, indemnity, dispute_resolution, other]
- parties_affected: list of party labels mentioned (e.g., ["Employee", "Company"], ["User", "Service Provider"])
- cross_references: list of other clause_ids this clause references (e.g., "as per Clause 4" -> ["c4"])

Rules:
- Skip pure boilerplate (whereas clauses, signature blocks) UNLESS they materially affect rights.
- If a single paragraph contains multiple distinct obligations, split them into separate clauses.
- Maximum 60 clauses. If the doc has more, prioritize the ones with operative language (must/shall/may/will) over recitals.

Also identify the issuer of the document (the company, employer, platform, or organization that drafted it) and output it as `issuer_name`. If you cannot find a confident name, return null. Pick the entity that benefits from the document, not the user/employee/customer.

Output strict JSON: {"issuer_name": "Acme Pvt Ltd" | null, "clauses": [<Clause>, ...]}"""


class ExtractorAgent(BaseAgent):
    name: ClassVar[str] = "extractor"
    system_prompt: ClassVar[str] = _SYSTEM

    async def run(self, *, text: str, domain: Domain) -> ExtractorOutput:
        user = (
            f"Domain hint: {domain.value}\n\n"
            "Document text:\n"
            "-----\n"
            f"{text}\n"
            "-----\n\n"
            'Return strict JSON: {"issuer_name": "..." | null, "clauses": [<Clause>, ...]}.'
        )
        raw = await self._call(user, temperature=0.1, max_output_tokens=32768)
        clauses_raw = raw.get("clauses")
        if not isinstance(clauses_raw, list) or not clauses_raw:
            raise AnalysisError("Extractor returned no clauses.")
        clauses = self._validate_each(clauses_raw, Clause)
        cap = get_settings().MAX_CLAUSES_PER_DOC
        issuer = raw.get("issuer_name")
        if not isinstance(issuer, str) or not issuer.strip():
            issuer = None
        return ExtractorOutput(clauses=clauses[:cap], issuer_name=issuer)

    @staticmethod
    def dump_for_prompt(clauses: list[Clause]) -> str:
        return json.dumps(
            [
                {"clause_id": c.clause_id, "title": c.title, "text": c.text}
                for c in clauses
            ],
            ensure_ascii=False,
        )
