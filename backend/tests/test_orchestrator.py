from __future__ import annotations

from typing import Any

import pytest

from app.core.errors import AnalysisError
from app.orchestrator import analyze_document
from app.schemas import DocumentScorecard, Domain, Severity


class FakeLLM:
    def __init__(self, responses: dict[str, dict[str, Any]]) -> None:
        self._responses = responses
        self.calls: list[tuple[str, int]] = []

    async def generate_json(
        self,
        system: str,
        user: str,
        *,
        heavy: bool = False,
        temperature: float = 0.2,
        max_output_tokens: int = 4096,
    ) -> dict[str, Any]:
        for marker, response in self._responses.items():
            if marker in system:
                self.calls.append((marker, len(user)))
                return response
        raise AssertionError(f"FakeLLM: no canned response matches system: {system[:80]!r}")


SAMPLE_TEXT = (
    "1. Probation: The probation period is six months and may be extended at the sole "
    "discretion of the Company without prior notice.\n\n"
    "2. Non-Compete: Employee shall not engage in any business similar to the Company "
    "for 24 months following termination.\n\n"
    "3. Termination: The Company may terminate this agreement at any time without notice "
    "for any reason whatsoever."
)


def _make_responses() -> dict[str, dict[str, Any]]:
    return {
        "Clause Extractor for LexGuard": {
            "issuer_name": "Acme Technologies Pvt. Ltd.",
            "clauses": [
                {
                    "clause_id": "c1",
                    "title": "Probation Period",
                    "text": "The probation period is six months and may be extended at the sole discretion of the Company without prior notice.",
                    "clause_type": "obligation",
                    "parties_affected": ["Employee", "Company"],
                    "cross_references": [],
                },
                {
                    "clause_id": "c2",
                    "title": "Non-Compete",
                    "text": "Employee shall not engage in any business similar to the Company for 24 months following termination.",
                    "clause_type": "restriction",
                    "parties_affected": ["Employee"],
                    "cross_references": [],
                },
                {
                    "clause_id": "c3",
                    "title": "Termination Without Notice",
                    "text": "The Company may terminate this agreement at any time without notice for any reason whatsoever.",
                    "clause_type": "termination",
                    "parties_affected": ["Employee", "Company"],
                    "cross_references": [],
                },
            ]
        },
        "Risk Classifier for LexGuard": {
            "findings": [
                {
                    "clause_id": "c1",
                    "severity": "high",
                    "categories": ["extended_probation", "wage_leave_ambiguity"],
                    "rationale": "Probation extendable indefinitely by the Company.",
                    "confidence": 0.88,
                },
                {
                    "clause_id": "c2",
                    "severity": "critical",
                    "categories": ["non_compete_overreach"],
                    "rationale": "Post-termination non-compete is generally void under Indian law.",
                    "confidence": 0.92,
                },
                {
                    "clause_id": "c3",
                    "severity": "high",
                    "categories": ["vague_termination"],
                    "rationale": "Termination without notice for any reason is grossly one-sided.",
                    "confidence": 0.85,
                },
            ]
        },
        "Rights Agent for LexGuard": {
            "findings": [
                {
                    "clause_id": "c1",
                    "applicable_statutes": [
                        "Industrial Employment (Standing Orders) Act 1946 - Schedule"
                    ],
                    "conflicts_with_rights": [
                        "IESO standing-order requirement on conditions of service"
                    ],
                    "legal_explanation": "Standing-order conditions cannot be changed unilaterally.",
                    "citations": ["ieso_1946"],
                },
                {
                    "clause_id": "c2",
                    "applicable_statutes": [
                        "Indian Contract Act 1872 §27 - Agreements in restraint of trade are void"
                    ],
                    "conflicts_with_rights": [
                        "ICA §27 freedom to engage in any lawful profession"
                    ],
                    "legal_explanation": "Post-employment non-compete restrictions are unenforceable in India.",
                    "citations": ["ica_s27"],
                },
                {
                    "clause_id": "c3",
                    "applicable_statutes": ["Industrial Disputes Act 1947 §2A"],
                    "conflicts_with_rights": ["ID Act §2A right to raise an industrial dispute"],
                    "legal_explanation": "An individual workman can directly challenge dismissal.",
                    "citations": ["id_act_s2a"],
                },
            ]
        },
        "Red-Team Agent for LexGuard": {
            "findings": [
                {
                    "clause_id": "c1",
                    "exploitation_scenario": "Company keeps extending probation to avoid confirming benefits.",
                    "who_benefits": "Company",
                    "harm_example": "An intern in Bangalore is held on probation for 18 months with no confirmation.",
                },
                {
                    "clause_id": "c2",
                    "exploitation_scenario": "Company sends legal notices to chill the employee's next job.",
                    "who_benefits": "Company",
                    "harm_example": "A developer in Pune is forced to decline a competing offer.",
                },
                {
                    "clause_id": "c3",
                    "exploitation_scenario": "Company terminates without notice citing 'business reasons'.",
                    "who_benefits": "Company",
                    "harm_example": "A junior employee in Hyderabad is let go mid-month with no severance.",
                },
            ]
        },
        "Judge Agent for LexGuard": {
            "clauses": [
                {
                    "clause_id": "c1",
                    "title": "Probation Period",
                    "severity": "high",
                    "plain_language": "Probation can be extended for as long as the company wants.",
                    "why_it_matters": "You may stay on probation indefinitely with reduced benefits.",
                    "what_to_do": "Ask HR to fix a maximum probation duration in writing.",
                    "safer_version": "Probation is six months; any extension shall not exceed three additional months and must be communicated in writing.",
                    "risk_categories": ["extended_probation", "wage_leave_ambiguity"],
                    "statutes_cited": [
                        "Industrial Employment (Standing Orders) Act 1946 - Schedule"
                    ],
                    "confidence": 0.88,
                },
                {
                    "clause_id": "c2",
                    "title": "Non-Compete",
                    "severity": "critical",
                    "plain_language": "You can't work at competing companies for 2 years after leaving.",
                    "why_it_matters": "Indian courts generally void post-employment non-competes.",
                    "what_to_do": "Request removal of the post-termination non-compete clause.",
                    "safer_version": "Employee will not solicit existing Company customers for 6 months after exit.",
                    "risk_categories": ["non_compete_overreach"],
                    "statutes_cited": [
                        "Indian Contract Act 1872 §27 - Agreements in restraint of trade are void"
                    ],
                    "confidence": 0.92,
                },
                {
                    "clause_id": "c3",
                    "title": "Termination Without Notice",
                    "severity": "high",
                    "plain_language": "The company can fire you any time for any reason.",
                    "why_it_matters": "No notice period or severance protection.",
                    "what_to_do": "Insist on a mutual notice period of at least 30 days.",
                    "safer_version": "Either party may terminate with 30 days written notice.",
                    "risk_categories": ["vague_termination"],
                    "statutes_cited": ["Industrial Disputes Act 1947 §2A"],
                    "confidence": 0.85,
                },
            ],
            "overall_severity": "critical",
            "risk_score": 78,
            "top_concerns": [
                "Probation can be extended indefinitely",
                "Non-compete unenforceable under ICA §27",
                "Termination at any time without notice",
            ],
            "pre_sign_checklist": [
                "Ask HR to fix a maximum probation duration in writing.",
                "Request removal of the 24-month non-compete clause.",
                "Insist on a mutual notice period of at least 30 days.",
            ],
            "summary": "Three clauses are significantly tilted toward the Company; two conflict with Indian civil law.",
        },
    }


async def test_orchestrator_end_to_end_with_mocked_llm() -> None:
    fake = FakeLLM(_make_responses())
    result = await analyze_document(
        text=SAMPLE_TEXT,
        domain=Domain.EMPLOYMENT,
        language="en",
        llm=fake,  # type: ignore[arg-type]
    )

    assert isinstance(result, DocumentScorecard)
    assert result.domain == Domain.EMPLOYMENT
    assert len(result.clauses) == 3
    assert result.overall_severity == Severity.CRITICAL
    assert result.risk_score == 78
    assert result.counts.high == 2
    assert result.counts.critical == 1
    assert result.counts.low == 0
    assert len(result.top_concerns) >= 3
    assert len(result.pre_sign_checklist) >= 3
    assert result.processing_ms >= 0
    assert "judge" in result.model_versions
    assert len(result.document_id) == 12

    markers = {marker for marker, _ in fake.calls}
    assert markers == {
        "Clause Extractor for LexGuard",
        "Risk Classifier for LexGuard",
        "Rights Agent for LexGuard",
        "Red-Team Agent for LexGuard",
        "Judge Agent for LexGuard",
    }


async def test_orchestrator_rejects_short_text() -> None:
    from app.core.errors import IngestionError

    fake = FakeLLM(_make_responses())
    with pytest.raises(IngestionError):
        await analyze_document(text="too short", llm=fake)  # type: ignore[arg-type]


async def test_extractor_rejects_empty_clauses() -> None:
    fake = FakeLLM({"Clause Extractor": {"clauses": []}})
    with pytest.raises(AnalysisError):
        await analyze_document(
            text=SAMPLE_TEXT, domain=Domain.EMPLOYMENT, llm=fake  # type: ignore[arg-type]
        )


async def test_judge_missing_keys_raises() -> None:
    responses = _make_responses()
    responses["Judge Agent for LexGuard"] = {"clauses": []}
    fake = FakeLLM(responses)
    with pytest.raises(AnalysisError):
        await analyze_document(
            text=SAMPLE_TEXT, domain=Domain.EMPLOYMENT, llm=fake  # type: ignore[arg-type]
        )


async def test_risk_score_is_clamped_to_0_100() -> None:
    responses = _make_responses()
    responses["Judge Agent for LexGuard"] = {
        **responses["Judge Agent for LexGuard"],
        "risk_score": 999,
    }
    fake = FakeLLM(responses)
    result = await analyze_document(
        text=SAMPLE_TEXT, domain=Domain.EMPLOYMENT, llm=fake  # type: ignore[arg-type]
    )
    assert result.risk_score == 100
