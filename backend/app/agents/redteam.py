from __future__ import annotations

from typing import ClassVar

from app.agents.base import BaseAgent
from app.agents.extractor import ExtractorAgent
from app.core.errors import AnalysisError
from app.schemas import Clause, Domain, RedTeamFinding

_SYSTEM = """You are the Red-Team Agent for LexGuard. Your job: argue from the perspective of the party who DRAFTED the contract (employer, platform, vendor, etc.). For each clause, describe how it could be used against the signing user in practice.

For each clause output:
- clause_id
- exploitation_scenario: 1-2 sentences describing a concrete way the clause could be enforced or invoked to the user's detriment.
- who_benefits: short string identifying the party who gains from this clause as written.
- harm_example: 1 sentence describing a plausible real-world harm to a typical Indian user (be specific - e.g., "an intern in Bangalore", "a customer who bought a Diwali sale ticket"). Make it concrete, not abstract.

Rules:
- Be pragmatic, not paranoid. If a clause is genuinely neutral, say "No realistic exploitation path." for the scenario.
- Focus on enforceability in India and typical drafter behavior, not theoretical worst cases.
- Output strict JSON: {"findings": [<RedTeamFinding>, ...]}"""


class RedTeamAgent(BaseAgent):
    name: ClassVar[str] = "redteam"
    system_prompt: ClassVar[str] = _SYSTEM

    async def run(self, *, clauses: list[Clause], domain: Domain) -> list[RedTeamFinding]:
        user = (
            f"Domain: {domain.value}\n\n"
            "Clauses to red-team:\n"
            f"{ExtractorAgent.dump_for_prompt(clauses)}\n\n"
            'Return strict JSON: {"findings": [<RedTeamFinding>, ...]}'
        )
        raw = await self._call(user, temperature=0.3, max_output_tokens=32768)
        findings_raw = raw.get("findings")
        if not isinstance(findings_raw, list):
            raise AnalysisError("Red-Team agent did not return a 'findings' array.")
        return self._validate_each(findings_raw, RedTeamFinding)
