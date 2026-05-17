from __future__ import annotations

from app.agents.chat import ChatAgent


class _FakeLLM:
    def __init__(self, canned: str) -> None:
        self._canned = canned
        self.last_system: str | None = None
        self.last_user: str | None = None

    async def generate_text(self, system, user, **_):
        self.last_system = system
        self.last_user = user
        return self._canned


SAMPLE_ARTIFACTS = {
    "domain": "employment",
    "language": "en",
    "summary": "Internship offer with several aggressive clauses.",
    "issuer_name": "Acme Technologies Pvt. Ltd.",
    "clauses": [
        {
            "clause_id": "c1",
            "title": "Probation Period",
            "text": "Probation is six months, extendable at the sole discretion of the Company.",
        },
        {
            "clause_id": "c2",
            "title": "Non-Compete",
            "text": "Employee shall not work for any competitor for 24 months after termination.",
        },
    ],
    "verdicts": [
        {"clause_id": "c1", "severity": "high", "plain_language": "Probation can be extended forever."},
        {"clause_id": "c2", "severity": "critical", "plain_language": "Two-year non-compete is unenforceable in India."},
    ],
    "risk": [
        {"clause_id": "c1", "rationale": "Discretionary extension with no cap."},
        {"clause_id": "c2", "rationale": "Restraint of trade."},
    ],
    "rights": [
        {
            "clause_id": "c2",
            "applicable_statutes": ["Indian Contract Act 1872, §27"],
            "conflicts_with_rights": ["Right to lawful profession"],
        }
    ],
    "redteam": [
        {"clause_id": "c2", "exploitation_scenario": "Used to threaten ex-employees joining competitors."}
    ],
    "retrieved_statutes": {
        "c2": [
            {
                "id": "ica_s27",
                "act": "Indian Contract Act, 1872",
                "section": "27",
                "title": "Agreements in restraint of trade are void",
                "summary": "Restraint of trade is void in India except for the sale-of-goodwill exception.",
            }
        ]
    },
}


async def test_in_scope_question_cites_clause():
    fake = _FakeLLM("Clause c2 (Non-Compete) is generally unenforceable in India under Indian Contract Act 1872, Section 27.")
    agent = ChatAgent(llm=fake)  # type: ignore[arg-type]
    answer = await agent.run(
        artifacts=SAMPLE_ARTIFACTS,
        history=[],
        question="Is the non-compete enforceable?",
        language="en",
    )
    assert "c2" in answer
    assert "c2" in fake.last_user  # the agent fed structured clause data including ids


async def test_out_of_scope_refuses():
    fake = _FakeLLM(
        "I'm focused on this specific document. For anything else, I'd suggest a general AI assistant or qualified professional."
    )
    agent = ChatAgent(llm=fake)  # type: ignore[arg-type]
    answer = await agent.run(
        artifacts=SAMPLE_ARTIFACTS,
        history=[],
        question="What's the capital of France?",
        language="en",
    )
    assert "focused on this specific document" in answer


async def test_should_i_sign_returns_disclaimer():
    fake = _FakeLLM(
        "LexGuard provides risk intelligence, not legal advice. The decision is yours, but here's what to weigh: c1 and c2 are both significantly one-sided."
    )
    agent = ChatAgent(llm=fake)  # type: ignore[arg-type]
    answer = await agent.run(
        artifacts=SAMPLE_ARTIFACTS,
        history=[],
        question="Should I sign this?",
        language="en",
    )
    assert "risk intelligence" in answer.lower()
    assert "legal advice" in answer.lower()


async def test_hinglish_passthrough():
    fake = _FakeLLM(
        "Clause c2 (Non-Compete) India mein generally enforce nahi hoti - Indian Contract Act 1872, Section 27 ke under restraint of trade void hota hai."
    )
    agent = ChatAgent(llm=fake)  # type: ignore[arg-type]
    answer = await agent.run(
        artifacts=SAMPLE_ARTIFACTS,
        history=[],
        question="non-compete enforce hogi kya?",
        language="hinglish",
    )
    assert "c2" in answer
    assert "hinglish" in fake.last_user.lower()


async def test_history_truncated_to_last_5():
    fake = _FakeLLM("ack")
    agent = ChatAgent(llm=fake)  # type: ignore[arg-type]
    long_history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"turn {i}"} for i in range(20)
    ]
    await agent.run(
        artifacts=SAMPLE_ARTIFACTS,
        history=long_history,
        question="next",
        language="en",
    )
    assert "turn 15" in fake.last_user
    assert "turn 0" not in fake.last_user
