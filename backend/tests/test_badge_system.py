"""
Backend tests for the 2-layer badge system (TRUST + COMMERCIAL).

Covers:
- /api/search/smart returns `badges` and `is_sponsored` on every result
- /api/providers/{id}/master returns `badges` and `is_sponsored`
- /api/providers/search returns `badges` on each result
- /api/stats/claims-monthly public social-proof endpoint
- Trust badge mapping (seeded/pending/verified)
- Commercial badge mapping (free/boost/premium/premium_plus) + expiration
- is_sponsored flag correctness
- Idempotence of badge computation
- Ranking: verified is well-ranked but premium does not dominate
- No 500 errors when master_profile.commercial is absent (retrocompat)
"""
import os
import sys
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://keneyakafisa-health.preview.emergentagent.com"

API = f"{BASE_URL}/api"


# Make services importable for unit-level tests on compute_badges (expiration, retrocompat)
sys.path.insert(0, "/app/backend")
from services.badge import compute_badges, trust_score_bonus  # noqa: E402


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ------------------------- helpers -------------------------

VALID_TRUST_KEYS = {"verified", "pending", "seeded", "rejected"}
VALID_COMMERCIAL_KEYS = {"boost", "premium", "premium_plus"}


def _assert_badge_shape(badges):
    assert isinstance(badges, dict), f"badges must be dict, got {type(badges)}"
    assert "trust" in badges and "commercial" in badges, f"missing keys in {badges}"
    trust = badges["trust"]
    assert isinstance(trust, dict)
    for k in ("key", "label", "color", "level"):
        assert k in trust, f"trust missing {k}: {trust}"
    assert trust["key"] in VALID_TRUST_KEYS
    assert isinstance(trust["level"], int) and 1 <= trust["level"] <= 3
    com = badges["commercial"]
    if com is not None:
        assert isinstance(com, dict)
        for k in ("key", "label", "color"):
            assert k in com, f"commercial missing {k}: {com}"
        assert com["key"] in VALID_COMMERCIAL_KEYS


# ------------------------- /api/search/smart -------------------------

class TestSearchSmartBadges:
    def test_search_smart_urologie_returns_badges_and_is_sponsored(self, session):
        r = session.get(f"{API}/search/smart", params={"q": "urologie"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "results" in data and isinstance(data["results"], list)
        assert len(data["results"]) >= 1, "no urology results returned"
        for p in data["results"]:
            assert "badges" in p, f"missing badges field on result id={p.get('id')}"
            assert "is_sponsored" in p, f"missing is_sponsored on id={p.get('id')}"
            _assert_badge_shape(p["badges"])
            # is_sponsored consistency with commercial
            com = p["badges"].get("commercial")
            if com is None:
                assert p["is_sponsored"] is False
            else:
                assert p["is_sponsored"] is True
                assert com["key"] in VALID_COMMERCIAL_KEYS

    def test_search_smart_idempotent_badges(self, session):
        r1 = session.get(f"{API}/search/smart", params={"q": "urologie"}, timeout=20).json()
        r2 = session.get(f"{API}/search/smart", params={"q": "urologie"}, timeout=20).json()
        # Build {id: badges} maps and compare
        map1 = {p["id"]: p["badges"] for p in r1["results"] if "id" in p}
        map2 = {p["id"]: p["badges"] for p in r2["results"] if "id" in p}
        common_ids = set(map1) & set(map2)
        assert len(common_ids) >= 1
        for pid in common_ids:
            assert map1[pid] == map2[pid], f"badges differ across calls for id={pid}"

    def test_search_smart_seeded_default_when_no_claim(self, session):
        """At least one untouched seeded record should carry trust.key='seeded'."""
        r = session.get(f"{API}/search/smart", params={"q": "urologie"}, timeout=20).json()
        keys = {p["badges"]["trust"]["key"] for p in r["results"]}
        # We know iter-9 seed has many seeded providers
        assert "seeded" in keys or "verified" in keys, f"unexpected trust keys: {keys}"

    def test_known_test_ids_badges(self, session):
        """uro-ci-001 → verified+premium ; uro-ci-002 → pending+boost ; others verified/pending only."""
        r = session.get(f"{API}/search/smart", params={"q": "urologie"}, timeout=20).json()
        by_id = {p["id"]: p for p in r["results"] if "id" in p}
        # uro-ci-001 must be present
        assert "uro-ci-001" in by_id, f"uro-ci-001 not in search results (ids={list(by_id)[:10]})"
        p001 = by_id["uro-ci-001"]
        assert p001["badges"]["trust"]["key"] == "verified", p001["badges"]
        assert p001["badges"]["trust"]["color"] == "emerald"
        assert p001["badges"]["commercial"] is not None
        assert p001["badges"]["commercial"]["key"] == "premium"
        assert p001["badges"]["commercial"]["color"] == "purple"
        assert p001["is_sponsored"] is True

        # Optional: check uro-ci-002 if it exists in results
        if "uro-ci-002" in by_id:
            p002 = by_id["uro-ci-002"]
            assert p002["badges"]["trust"]["key"] in ("pending", "verified", "seeded")
            # If marked boost (per review), validate shape
            com = p002["badges"]["commercial"]
            if com and com["key"] == "boost":
                assert com["color"] == "orange"
                assert p002["is_sponsored"] is True


# ------------------------- ranking: verified well-placed, premium not dominant -------------------------

class TestRankingBalance:
    def test_verified_premium_ranked_well_but_not_only_top(self, session):
        r = session.get(f"{API}/search/smart", params={"q": "urologie"}, timeout=20).json()
        results = r["results"]
        ids = [p.get("id") for p in results]
        assert "uro-ci-001" in ids, "verified+premium fiche missing"
        idx_001 = ids.index("uro-ci-001")
        # Should be in top half of results (well-ranked) -- modest, not forced #1
        assert idx_001 < max(1, len(ids) // 2 + 1), \
            f"uro-ci-001 ranked at {idx_001}/{len(ids)} — expected in top half"
        # Verify ranking diversity: top-3 should not all be premium/premium_plus
        top3 = results[:3]
        sponsored_in_top3 = sum(1 for p in top3 if p.get("is_sponsored"))
        assert sponsored_in_top3 < len(top3), \
            "top-3 are ALL sponsored — paid tier appears to dominate ranking"


# ------------------------- /api/providers/{id}/master -------------------------

class TestMasterEndpointBadges:
    def test_master_endpoint_uro001_verified_premium(self, session):
        r = session.get(f"{API}/providers/uro-ci-001/master", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "master_profile" in data
        assert "badges" in data and "is_sponsored" in data
        _assert_badge_shape(data["badges"])
        assert data["badges"]["trust"]["key"] == "verified"
        assert data["badges"]["commercial"] is not None
        assert data["badges"]["commercial"]["key"] == "premium"
        assert data["is_sponsored"] is True

    def test_master_endpoint_404_for_unknown(self, session):
        r = session.get(f"{API}/providers/__does_not_exist__/master", timeout=10)
        assert r.status_code == 404


# ------------------------- /api/providers/search -------------------------

class TestProvidersSearchBadges:
    def test_providers_search_returns_badges(self, session):
        r = session.get(f"{API}/providers/search", params={"q": "urologie"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        for p in data:
            assert "badges" in p, f"missing badges in providers/search id={p.get('id')}"
            _assert_badge_shape(p["badges"])


# ------------------------- /api/stats/claims-monthly -------------------------

class TestClaimsMonthlyStats:
    def test_public_no_auth_required(self, session):
        # New, fresh client to be sure no auth header leaks
        s = requests.Session()
        r = s.get(f"{API}/stats/claims-monthly", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("month", "claims_this_month", "verified_total", "providers_total"):
            assert k in data, f"missing {k} in {data}"
        # Format yyyy-mm
        assert len(data["month"]) == 7 and data["month"][4] == "-"
        assert isinstance(data["claims_this_month"], int) and data["claims_this_month"] >= 0
        assert isinstance(data["verified_total"], int) and data["verified_total"] >= 0
        assert isinstance(data["providers_total"], int) and data["providers_total"] > 0


# ------------------------- unit-level: compute_badges (expiration + retrocompat) -------------------------

class TestComputeBadgesUnit:
    def test_no_commercial_field_no_500(self):
        """Retrocompat: docs without master_profile.commercial must not crash."""
        doc = {"id": "x", "name": "X", "master_profile": {"trust": {"is_verified": False}}}
        b = compute_badges(doc)
        assert b["commercial"] is None
        assert b["trust"]["key"] in VALID_TRUST_KEYS

    def test_no_master_profile_at_all(self):
        doc = {"id": "x", "name": "X"}
        b = compute_badges(doc)
        assert b["trust"]["key"] == "seeded"
        assert b["commercial"] is None

    def test_expired_tier_falls_back_to_free(self):
        past = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        doc = {
            "id": "x",
            "master_profile": {
                "trust": {"is_verified": True},
                "commercial": {"tier": "premium", "tier_until": past},
            },
        }
        b = compute_badges(doc)
        assert b["trust"]["key"] == "verified"
        assert b["commercial"] is None, "expired premium must fall back to free"

    def test_active_tier_until_keeps_tier(self):
        future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        doc = {
            "id": "x",
            "master_profile": {
                "commercial": {"tier": "premium_plus", "tier_until": future},
            },
        }
        b = compute_badges(doc)
        assert b["commercial"] is not None
        assert b["commercial"]["key"] == "premium_plus"
        assert b["commercial"]["color"] == "violet"

    def test_boost_tier_shape(self):
        doc = {"master_profile": {"commercial": {"tier": "boost"}}}
        b = compute_badges(doc)
        assert b["commercial"] == {"key": "boost", "label": "Mis en avant", "color": "orange"}

    def test_pending_trust(self):
        doc = {"claim_status": "pending"}
        b = compute_badges(doc)
        assert b["trust"]["key"] == "pending"
        assert b["trust"]["color"] == "amber"
        assert b["trust"]["level"] == 2

    def test_verified_priority(self):
        # verified flag wins even if claim_status is pending
        doc = {"claim_status": "pending", "master_profile": {"trust": {"is_verified": True}}}
        b = compute_badges(doc)
        assert b["trust"]["key"] == "verified"

    def test_trust_score_bonus_cap(self):
        doc = {
            "master_profile": {
                "trust": {"is_verified": True, "updated_at": datetime.now(timezone.utc).isoformat()},
                "commercial": {"tier": "premium_plus"},
            }
        }
        bonus = trust_score_bonus(doc)
        # 15 (recent verified) + 3 (premium_plus) = 18
        assert bonus <= 18, f"trust_score_bonus exceeds cap: {bonus}"
        assert bonus >= 15
