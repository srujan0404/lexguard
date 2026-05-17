from __future__ import annotations

import json
from typing import Any, ClassVar

from app.agents.base import BaseAgent
from app.llm import LLMClient

_SYSTEM = """You are LexGuard's follow-up assistant. The user has already received a complete scorecard for a specific document they uploaded. They are now asking a follow-up question about that document.

You receive structured artifacts from the prior analysis:
- The full document summary
- All extracted clauses with their IDs
- Risk findings, rights findings, and red-team findings per clause
- Retrieved Indian statutes that the Rights Agent grounded against
- The Judge Agent's final verdicts per clause
- Previous Q&A history in this conversation (last 5 turns)

STRICT RULES:
1. Answer using ONLY information present in the provided artifacts. If the answer is not derivable from the artifacts, say "I can only speak to what's in this document - that question goes beyond what I analyzed."
2. When you reference a clause, cite its clause_id explicitly in this format: "Clause c4 (Probation Period)".
3. When you reference law, cite only statute IDs that appear in the retrieved_statutes context. Format: "Indian Contract Act 1872, Section 27" - do not invent statute citations.
4. Indian Penal Code is criminal law. NEVER cite IPC for contract questions, no matter what the user asks.
5. Keep responses under 120 words unless the user explicitly asks for more detail. Plain English, no legalese.
6. If the user asks in Hinglish, respond in Hinglish. Otherwise English.
7. If the user asks "should I sign?" or "is this legal advice?" - respond: "LexGuard provides risk intelligence, not legal advice. The decision is yours, but here's what to weigh: ..." and summarize the key risks from the document.
8. NEVER hallucinate facts about the contracting parties, dates, amounts, or terms that don't appear in the clauses. If a fact isn't in the document, say so.
9. If asked about anything unrelated to the document (weather, other contracts, general advice), respond: "I'm focused on this specific document. For anything else, I'd suggest a general AI assistant or qualified professional."

Output: plain text response. No JSON, no markdown headers, no bullet lists unless the user explicitly asks for a list."""


class ChatAgent(BaseAgent):
    name: ClassVar[str] = "chat"
    system_prompt: ClassVar[str] = _SYSTEM
    heavy: ClassVar[bool] = False

    def __init__(self, llm: LLMClient | None = None) -> None:
        super().__init__(llm)

    async def run(
        self,
        *,
        artifacts: dict[str, Any],
        history: list[dict[str, str]],
        question: str,
        language: str = "en",
    ) -> str:
        unique_statutes = _dedupe_statutes(artifacts.get("retrieved_statutes", {}))

        clause_blocks = []
        verdict_by_id = {v["clause_id"]: v for v in artifacts.get("verdicts", [])}
        risk_by_id = {r["clause_id"]: r for r in artifacts.get("risk", [])}
        rights_by_id = {r["clause_id"]: r for r in artifacts.get("rights", [])}
        redteam_by_id = {r["clause_id"]: r for r in artifacts.get("redteam", [])}

        for c in artifacts.get("clauses", []):
            cid = c["clause_id"]
            v = verdict_by_id.get(cid, {})
            r = risk_by_id.get(cid, {})
            rights = rights_by_id.get(cid, {})
            rt = redteam_by_id.get(cid, {})
            clause_blocks.append(
                {
                    "clause_id": cid,
                    "title": c.get("title"),
                    "text_excerpt": (c.get("text") or "")[:300],
                    "severity": v.get("severity") or r.get("severity"),
                    "plain_language": v.get("plain_language"),
                    "risk_rationale": r.get("rationale"),
                    "rights_conflicts": rights.get("conflicts_with_rights", []),
                    "rights_statutes": rights.get("applicable_statutes", []),
                    "redteam_scenario": rt.get("exploitation_scenario"),
                }
            )

        history_lines = [
            f"{turn.get('role','user').upper()}: {turn.get('content','')}"
            for turn in history[-5:]
        ]

        user_prompt = (
            f"Domain: {artifacts.get('domain','generic')}\n"
            f"Output language: {language}\n"
            f"Document summary: {artifacts.get('summary','')}\n"
            f"Issuer: {artifacts.get('issuer_name') or 'unknown'}\n\n"
            f"Clauses ({len(clause_blocks)}):\n{json.dumps(clause_blocks, ensure_ascii=False)}\n\n"
            f"Indian statutes available for citation:\n{json.dumps(unique_statutes, ensure_ascii=False)}\n\n"
            f"Conversation so far:\n"
            + ("\n".join(history_lines) if history_lines else "(no prior turns)")
            + f"\n\nUser's question:\n{question}\n\nAnswer (plain text, under 120 words):"
        )

        return await self._llm.generate_text(
            self.system_prompt,
            user_prompt,
            heavy=False,
            temperature=0.2,
            max_output_tokens=2048,
        )


def _dedupe_statutes(retrieved: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for statutes in retrieved.values():
        for s in statutes:
            sid = s.get("id")
            if not sid or sid in seen:
                continue
            seen.add(sid)
            out.append(
                {
                    "id": sid,
                    "act": s.get("act"),
                    "section": s.get("section"),
                    "title": s.get("title"),
                    "summary": s.get("summary"),
                }
            )
    return out
