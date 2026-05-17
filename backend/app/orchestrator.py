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
from app.core.errors import IngestionError
from app.knowledge.retriever import retrieve_statutes
from app.llm import LLMClient
from app.persistence.artifacts import get_artifact_store
from app.persistence.risk_memory import (
    ScanContext,
    clause_hash,
    doc_hash,
    get_repo,
)
from app.schemas import (
    ClauseVerdict,
    DocumentScorecard,
    Domain,
    Language,
    Severity,
    SeverityCounts,
)

log = logging.getLogger(__name__)
_BACKGROUND_TASKS: set[asyncio.Task] = set()


async def analyze_document(
    *,
    text: str,
    domain: Domain = Domain.GENERIC,
    language: Language = "en",
    source_url: str | None = None,
    llm: LLMClient | None = None,
) -> DocumentScorecard:
    if not text or len(text.strip()) < 20:
        raise IngestionError(
            "Document text is too short to analyze. Paste at least a few sentences of "
            "legal/contract text or send a working public URL."
        )

    start = time.monotonic()
    settings = get_settings()
    repo = get_repo()

    extractor = ExtractorAgent(llm)
    risk = RiskAgent(llm)
    rights = RightsAgent(llm)
    redteam = RedTeamAgent(llm)
    judge = JudgeAgent(llm)

    log.info("orchestrator_start", extra={"domain": domain.value, "text_length": len(text)})

    extracted = await extractor.run(text=text, domain=domain)
    clauses = extracted.clauses
    log.info(
        "extractor_done",
        extra={"clauses": len(clauses), "issuer_name": extracted.issuer_name},
    )

    ctx = ScanContext(
        doc_hash=doc_hash(text),
        clause_hashes={c.clause_id: clause_hash(c.text) for c in clauses},
    )

    retrieved_context: dict[str, list[dict[str, Any]]] = {
        c.clause_id: retrieve_statutes(
            f"{c.title}\n{c.text[:200]}", domain=domain.value, top_k=5
        )
        for c in clauses
    }

    risk_findings, rights_findings, redteam_findings, lookup = await asyncio.gather(
        risk.run(clauses=clauses, domain=domain),
        rights.run(clauses=clauses, retrieved_context=retrieved_context, domain=domain),
        redteam.run(clauses=clauses, domain=domain),
        repo.lookup(ctx),
    )
    log.info(
        "parallel_agents_done",
        extra={
            "risk": len(risk_findings),
            "rights": len(rights_findings),
            "redteam": len(redteam_findings),
            "doc_seen_before": lookup.doc_seen_before,
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
        v.seen_in_n_others = lookup.clause_seen_in_n_others.get(v.clause_id, 0)

    counts = SeverityCounts(
        low=sum(1 for v in verdicts if v.severity == Severity.LOW),
        medium=sum(1 for v in verdicts if v.severity == Severity.MEDIUM),
        high=sum(1 for v in verdicts if v.severity == Severity.HIGH),
        critical=sum(1 for v in verdicts if v.severity == Severity.CRITICAL),
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)
    risk_score = max(0, min(100, int(judge_result["risk_score"])))
    suggested_questions = list(judge_result.get("suggested_questions", []) or [])[:3]
    document_id = uuid.uuid4().hex[:12]

    # Persist full artifacts for the followup chat (1h TTL).
    artifacts_payload = {
        "domain": domain.value,
        "language": language,
        "summary": judge_result.get("summary", ""),
        "issuer_name": extracted.issuer_name,
        "clauses": [c.model_dump(mode="json") for c in clauses],
        "risk": [f.model_dump(mode="json") for f in risk_findings],
        "rights": [f.model_dump(mode="json") for f in rights_findings],
        "redteam": [f.model_dump(mode="json") for f in redteam_findings],
        "verdicts": [v.model_dump(mode="json") for v in verdicts],
        "retrieved_statutes": retrieved_context,
        "suggested_questions": suggested_questions,
        "risk_score": risk_score,
    }
    artifact_task = asyncio.create_task(
        get_artifact_store().put(document_id, artifacts_payload)
    )
    _BACKGROUND_TASKS.add(artifact_task)
    artifact_task.add_done_callback(_BACKGROUND_TASKS.discard)

    # Fire-and-forget write so the response isn't delayed by Firestore latency.
    record_task = asyncio.create_task(
        repo.record(
            ctx,
            domain=domain.value,
            risk_score=risk_score,
            issuer_name=extracted.issuer_name,
        )
    )
    _BACKGROUND_TASKS.add(record_task)
    record_task.add_done_callback(_BACKGROUND_TASKS.discard)

    log.info("orchestrator_done", extra={"processing_ms": elapsed_ms})

    return DocumentScorecard(
        document_id=document_id,
        domain=domain,
        overall_severity=Severity(judge_result["overall_severity"]),
        risk_score=risk_score,
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
        issuer_name=extracted.issuer_name,
        seen_before=lookup.doc_seen_before,
        suggested_questions=suggested_questions,
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
