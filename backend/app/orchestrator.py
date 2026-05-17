from __future__ import annotations

import asyncio
import json
import logging
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from app.agents import (
    ExtractorAgent,
    JudgeAgent,
    RedTeamAgent,
    RightsAgent,
    RiskAgent,
)
from app.config import get_settings
from app.core.errors import AnalysisError
from app.knowledge.retriever import retrieve_statutes
from app.llm import LLMClient
from app.schemas import (
    ClauseVerdict,
    DocumentScorecard,
    Domain,
    Language,
    Severity,
    SeverityCounts,
)

log = logging.getLogger(__name__)


async def analyze_document(
    *,
    text: str,
    domain: Domain = Domain.GENERIC,
    language: Language = "en",
    source_url: str | None = None,
    llm: LLMClient | None = None,
) -> DocumentScorecard:
    if not text or len(text.strip()) < 20:
        raise AnalysisError("Document text is too short to analyze.")

    start = time.monotonic()
    settings = get_settings()

    extractor = ExtractorAgent(llm)
    risk = RiskAgent(llm)
    rights = RightsAgent(llm)
    redteam = RedTeamAgent(llm)
    judge = JudgeAgent(llm)

    log.info("orchestrator_start", extra={"domain": domain.value, "text_length": len(text)})

    clauses = await extractor.run(text=text, domain=domain)
    log.info("extractor_done", extra={"clauses": len(clauses)})

    retrieved_context: dict[str, list[dict[str, Any]]] = {
        c.clause_id: retrieve_statutes(
            f"{c.title}\n{c.text[:200]}", domain=domain.value, top_k=5
        )
        for c in clauses
    }

    risk_findings, rights_findings, redteam_findings = await asyncio.gather(
        risk.run(clauses=clauses, domain=domain),
        rights.run(clauses=clauses, retrieved_context=retrieved_context, domain=domain),
        redteam.run(clauses=clauses, domain=domain),
    )
    log.info(
        "parallel_agents_done",
        extra={
            "risk": len(risk_findings),
            "rights": len(rights_findings),
            "redteam": len(redteam_findings),
        },
    )

    judge_result = await judge.run(
        clauses=clauses,
        risk=risk_findings,
        rights=rights_findings,
        redteam=redteam_findings,
        domain=domain,
        language=language,
    )

    verdicts = [ClauseVerdict(**c) for c in judge_result["clauses"]]

    # Rights agent is the source of truth for statute IDs - override what Judge
    # returned so frontends can resolve clickable citations against the KB.
    rights_by_id = {f.clause_id: f for f in rights_findings}
    for v in verdicts:
        rf = rights_by_id.get(v.clause_id)
        if rf:
            v.statutes_cited = list(rf.applicable_statutes)
            v.statute_refs = list(rf.citations)

    counts = SeverityCounts(
        low=sum(1 for v in verdicts if v.severity == Severity.LOW),
        medium=sum(1 for v in verdicts if v.severity == Severity.MEDIUM),
        high=sum(1 for v in verdicts if v.severity == Severity.HIGH),
        critical=sum(1 for v in verdicts if v.severity == Severity.CRITICAL),
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)
    log.info("orchestrator_done", extra={"processing_ms": elapsed_ms})

    return DocumentScorecard(
        document_id=uuid.uuid4().hex[:12],
        domain=domain,
        overall_severity=Severity(judge_result["overall_severity"]),
        risk_score=max(0, min(100, int(judge_result["risk_score"]))),
        counts=counts,
        top_concerns=judge_result.get("top_concerns", []),
        pre_sign_checklist=judge_result.get("pre_sign_checklist", []),
        clauses=verdicts,
        summary=judge_result.get("summary", ""),
        processing_ms=elapsed_ms,
        model_versions={
            "extractor": settings.GEMINI_MODEL,
            "risk": settings.GEMINI_MODEL,
            "rights": settings.GEMINI_MODEL,
            "redteam": settings.GEMINI_MODEL,
            "judge": settings.GEMINI_MODEL_HEAVY,
        },
        source_url=source_url,  # type: ignore[arg-type]
    )


def _cli() -> None:
    if len(sys.argv) < 2:
        print("usage: python -m app.orchestrator <path> [domain] [language]", file=sys.stderr)
        raise SystemExit(2)
    path = Path(sys.argv[1])
    domain = Domain(sys.argv[2]) if len(sys.argv) > 2 else Domain.GENERIC
    language: Language = sys.argv[3] if len(sys.argv) > 3 else "en"  # type: ignore[assignment]

    text = path.read_text(encoding="utf-8")
    scorecard = asyncio.run(analyze_document(text=text, domain=domain, language=language))
    print(json.dumps(scorecard.model_dump(mode="json"), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _cli()
