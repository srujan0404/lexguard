from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_HERE = Path(__file__).parent
_STATUTES: list[dict[str, Any]] = json.loads((_HERE / "indian_laws.json").read_text())
_RED_FLAG_PACKS: list[dict[str, Any]] = json.loads((_HERE / "red_flags.json").read_text())


@dataclass(frozen=True)
class _CompiledPattern:
    id: str
    name: str
    regex: re.Pattern[str] | None
    phrase_examples: tuple[str, ...]
    risk_categories: tuple[str, ...]
    severity_hint: str
    domain: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "phrase_examples": list(self.phrase_examples),
            "risk_categories": list(self.risk_categories),
            "severity_hint": self.severity_hint,
            "domain": self.domain,
        }


_RED_FLAGS_BY_DOMAIN: dict[str, list[_CompiledPattern]] = {}
for _pack in _RED_FLAG_PACKS:
    _compiled: list[_CompiledPattern] = []
    for _p in _pack["patterns"]:
        _regex = re.compile(_p["regex"], re.IGNORECASE | re.DOTALL) if _p.get("regex") else None
        _compiled.append(
            _CompiledPattern(
                id=_p["id"],
                name=_p["name"],
                regex=_regex,
                phrase_examples=tuple(_p.get("phrase_examples", [])),
                risk_categories=tuple(_p.get("risk_categories", [])),
                severity_hint=_p.get("severity_hint", "medium"),
                domain=_pack["domain"],
            )
        )
    _RED_FLAGS_BY_DOMAIN[_pack["domain"]] = _compiled


_TOKEN_RE = re.compile(r"[a-z][a-z0-9]*")
_STOPWORDS = frozenset(
    {"a", "an", "the", "of", "for", "and", "or", "to", "in", "on", "by", "is", "be", "with"}
)


def _tokens(text: str) -> set[str]:
    return {t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS}


def _score_statute(
    entry: dict[str, Any], query: str, query_tokens: set[str], domain: str | None
) -> int:
    score = 0
    q_lower = query.lower()
    for kw in entry.get("keywords", []):
        kw_lower = kw.lower()
        if kw_lower in q_lower:
            score += 3
            continue
        kw_tokens = _tokens(kw)
        if kw_tokens and kw_tokens.issubset(query_tokens):
            score += 2
        elif kw_tokens and kw_tokens & query_tokens:
            score += 1
    if domain and domain in entry.get("domains", []):
        score += 3
    for rc in entry.get("applies_to", []):
        rc_tokens = _tokens(rc.replace("_", " "))
        if not rc_tokens:
            continue
        overlap = rc_tokens & query_tokens
        if len(rc_tokens) > 1 and len(overlap) >= 2:
            score += 2
        elif overlap and len(rc_tokens) == 1:
            score += 1
    return score


def retrieve_statutes(
    query: str, domain: str | None = None, top_k: int = 5
) -> list[dict[str, Any]]:
    query_tokens = _tokens(query)
    scored: list[tuple[int, str, dict[str, Any]]] = []
    for entry in _STATUTES:
        score = _score_statute(entry, query, query_tokens, domain)
        if score > 0:
            scored.append((score, entry["id"], entry))
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [dict(entry) for _, _, entry in scored[:top_k]]


def retrieve_red_flags(text: str, domain: str | None = None) -> list[dict[str, Any]]:
    if not text:
        return []
    haystack = text.lower()
    domains = [domain] if domain else list(_RED_FLAGS_BY_DOMAIN.keys())
    hits: list[dict[str, Any]] = []
    seen: set[str] = set()
    for d in domains:
        for pattern in _RED_FLAGS_BY_DOMAIN.get(d, []):
            if pattern.id in seen:
                continue
            matched = bool(pattern.regex and pattern.regex.search(text))
            if not matched:
                for example in pattern.phrase_examples:
                    if example.lower() in haystack:
                        matched = True
                        break
            if matched:
                hits.append(pattern.to_dict())
                seen.add(pattern.id)
    return hits


def available_domains() -> list[str]:
    return list(_RED_FLAGS_BY_DOMAIN.keys())


def statute_by_id(statute_id: str) -> dict[str, Any] | None:
    for entry in _STATUTES:
        if entry["id"] == statute_id:
            return dict(entry)
    return None


def all_statutes() -> list[dict[str, Any]]:
    return [dict(e) for e in _STATUTES]
