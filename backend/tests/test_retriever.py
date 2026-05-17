from __future__ import annotations

import pytest

from app.knowledge.retriever import (
    available_domains,
    retrieve_red_flags,
    retrieve_statutes,
    statute_by_id,
)


def _ids(results: list[dict]) -> list[str]:
    return [r["id"] for r in results]


def test_non_compete_query_returns_ica_s27():
    results = retrieve_statutes("non-compete clause for two years post termination", "employment")
    assert results, "expected at least one statute"
    assert "ica_s27" in _ids(results)
    assert _ids(results)[0] == "ica_s27"


def test_third_party_sharing_query_returns_dpdp():
    results = retrieve_statutes("share data with third parties without consent", "privacy")
    ids = _ids(results)
    assert any(i.startswith("dpdp_") for i in ids)
    assert "dpdp_s4" in ids or "dpdp_s11" in ids


def test_unfair_refund_query_returns_consumer_act():
    results = retrieve_statutes(
        "all sales are final and non-refundable under any circumstances", "consumer"
    )
    ids = _ids(results)
    assert any(i.startswith("cpa_") for i in ids)


def test_employment_probation_pattern_is_detected():
    text = "Probation period may be extended at the sole discretion of the company."
    flags = retrieve_red_flags(text, "employment")
    assert any(f["id"] == "emp_probation_extendable" for f in flags)


def test_ticketing_non_refundable_pattern_is_detected():
    text = "All ticket sales are final and non-refundable under any circumstances."
    flags = retrieve_red_flags(text, "ticketing")
    assert any(f["id"] == "tic_non_refundable" for f in flags)


def test_privacy_consent_by_use_is_detected():
    text = "By using our Services, you consent to the collection of your personal data."
    flags = retrieve_red_flags(text, "privacy")
    assert any(f["id"] == "priv_consent_by_use" for f in flags)


def test_consumer_indemnity_pattern_is_detected():
    text = "You agree to indemnify us against all claims arising from your use of the service."
    flags = retrieve_red_flags(text, "consumer")
    assert any(f["id"] == "con_indemnify_company" for f in flags)


def test_red_flags_without_domain_scan_all_domains():
    text = "Probation may be extended at the sole discretion of the company."
    flags = retrieve_red_flags(text)
    assert flags, "expected hits when domain is omitted"


def test_clean_text_yields_no_red_flags():
    text = "The employee will receive standard statutory maternity leave per Indian law."
    flags = retrieve_red_flags(text, "employment")
    assert flags == [] or all(f["severity_hint"] in {"low", "medium"} for f in flags)


def test_retrieve_statutes_returns_at_most_top_k():
    results = retrieve_statutes("data consent share retain third party", "privacy", top_k=3)
    assert len(results) <= 3


def test_empty_query_returns_empty():
    assert retrieve_statutes("") == []


def test_statute_lookup_by_id():
    entry = statute_by_id("ica_s27")
    assert entry and entry["section"] == "27"
    assert statute_by_id("does_not_exist") is None


def test_domains_advertised_by_red_flag_packs():
    assert set(available_domains()) >= {"employment", "privacy", "ticketing", "consumer"}


@pytest.mark.parametrize(
    "query, expected_id",
    [
        ("unilateral changes to privacy policy without notice", "dpdp_"),
        ("retain data indefinitely as we deem necessary", "dpdp_s12"),
        ("class action waiver and exclusive foreign jurisdiction", "ica_s28"),
        ("liquidated damages for early termination from internship", "ica_s74"),
    ],
)
def test_query_hits_expected_statute_prefix(query: str, expected_id: str):
    results = retrieve_statutes(query)
    ids = _ids(results)
    assert any(expected_id in i for i in ids), f"got {ids} for {query!r}"
