"""Bump Firestore scan + clause counters for a seeded sample.

Idempotent: rerunning sets the same target; it does not stack.
Costs zero LLM tokens - it only touches Firestore.

Usage (from backend/):
    .venv/bin/python -m scripts.seed_firestore \\
        --issuer "Acme Technologies Pvt. Ltd." \\
        --target 5
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from google.cloud import firestore

from app.config import get_settings


async def _bump(issuer: str, target: int) -> None:
    settings = get_settings()
    if not settings.GCP_PROJECT_ID:
        sys.exit("error: GCP_PROJECT_ID not set in environment.")

    client = firestore.AsyncClient(project=settings.GCP_PROJECT_ID)

    scans = 0
    async for snap in client.collection("scans").where("issuer_name", "==", issuer).stream():
        await snap.reference.set({"count": target}, merge=True)
        scans += 1
    print(f"scans updated: {scans}  (count -> {target})")

    clauses = 0
    async for snap in (
        client.collection("clauses").where("issuers", "array_contains", issuer).stream()
    ):
        await snap.reference.set({"count": target}, merge=True)
        clauses += 1
    print(f"clauses updated: {clauses}  (count -> {target})")

    if scans == 0 and clauses == 0:
        print(
            "\n(no documents matched. Run one real scan first so Firestore has "
            "issuer-tagged entries to seed against.)"
        )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--issuer", required=True, help="issuer_name exact match")
    ap.add_argument("--target", type=int, default=5, help="desired count value")
    args = ap.parse_args()
    asyncio.run(_bump(args.issuer, args.target))


if __name__ == "__main__":
    main()
