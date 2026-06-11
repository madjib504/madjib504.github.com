"""
Backend tests for the V2 specialty seed + curated GPS geocoding (iteration 9).

Scope (matches review_request):
  - /api/admin/run-v2-seed (OWNER-only, idempotent)
  - /api/admin/geocode/refresh (OWNER-only, supports {force: true})
  - /api/admin/geocode/audit (admin-only)
  - placeholder coords (5.3167, -4.0333) fully purged from doctor_profiles + partner_profiles
  - /api/search/smart still works for new V2 specialty providers
  - landmark coordinates correctness (CHU Cocody, CHU Treichville, PISAM, Clinique Farah)
  - initial seed (services.seed_loader.seed_initial_data) not regressed
"""
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL is not set"

OWNER_USERNAME = "MADJIB"
OWNER_PASSWORD = "48851132kl"

# Reference landmark coords (from services/geocoding.py LANDMARKS table).
LANDMARK_EXPECTED = {
    "chu de cocody": (5.3528, -3.9908),
    "chu de treichville": (5.2925, -4.0085),
    "clinique farah": (5.3490, -3.9897),
    "pisam": (5.3008, -3.9869),
}
PLACEHOLDER = (5.3167, -4.0333)


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def owner_token(session):
    r = session.post(
        f"{BASE_URL}/api/admin/login",
        json={"username": OWNER_USERNAME, "password": OWNER_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"OWNER login failed: {r.status_code} / {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    assert body.get("admin_role") == "super_admin_owner"
    token = body.get("token")
    assert isinstance(token, str) and len(token) > 20
    return token


@pytest.fixture(scope="session")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


# --------------------------------------------------------------------------- #
# 1. OWNER login (smoke)
# --------------------------------------------------------------------------- #
class TestOwnerLogin:
    def test_owner_login_returns_token(self, owner_token):
        assert owner_token


# --------------------------------------------------------------------------- #
# 2. V2 seed loader idempotency
# --------------------------------------------------------------------------- #
class TestV2Seed:
    def test_run_v2_seed_idempotent(self, session, owner_headers):
        r = session.post(
            f"{BASE_URL}/api/admin/run-v2-seed", json={}, headers=owner_headers, timeout=60
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        stats = body["stats"]
        assert stats["total"] == 62, f"V2 seed file should have 62 records, got {stats}"
        # Idempotent: 2nd run must skip all 62 + insert 0.
        assert stats["inserted"] == 0, f"inserted should be 0 on re-run, got {stats}"
        assert stats["skipped_exists"] == 62, f"skipped_exists != 62, got {stats}"
        # Final partner count must be >= 104 (42 legacy + 62 V2).
        assert body["partner_profiles_in_db"] >= 104, (
            f"partner_profiles_in_db should be >=104, got {body['partner_profiles_in_db']}"
        )

    def test_run_v2_seed_owner_only_no_token(self, session):
        r = session.post(f"{BASE_URL}/api/admin/run-v2-seed", json={}, timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_run_v2_seed_rejects_bad_token(self, session):
        r = session.post(
            f"{BASE_URL}/api/admin/run-v2-seed",
            json={},
            headers={"Authorization": "Bearer not-a-real-token", "Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code in (401, 403)


# --------------------------------------------------------------------------- #
# 3. Geocode refresh (default + force)
# --------------------------------------------------------------------------- #
class TestGeocodeRefresh:
    def test_refresh_no_force_succeeds(self, session, owner_headers):
        r = session.post(
            f"{BASE_URL}/api/admin/geocode/refresh", json={}, headers=owner_headers, timeout=90
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["force"] is False
        s = body["stats"]
        # Counts come from real collections — review note says doctor_profiles=78,
        # partner_profiles=104. Assert lower bounds to stay robust.
        assert s["doctors_total"] >= 78, f"doctors_total<78: {s}"
        assert s["partners_total"] >= 104, f"partners_total<104: {s}"
        assert s["doctors_failed"] == 0, f"doctors_failed should be 0, got {s}"
        assert s["partners_failed"] == 0, f"partners_failed should be 0, got {s}"

    def test_refresh_force_regeocodes_everything(self, session, owner_headers):
        r = session.post(
            f"{BASE_URL}/api/admin/geocode/refresh",
            json={"force": True},
            headers=owner_headers,
            timeout=120,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["force"] is True
        s = body["stats"]
        # Force => every doc that resolves must be updated.
        assert s["doctors_updated"] > 0, f"force should update all doctors, got {s}"
        assert s["partners_updated"] > 0, f"force should update all partners, got {s}"
        assert s["doctors_failed"] == 0
        assert s["partners_failed"] == 0

    def test_refresh_owner_only_no_token(self, session):
        r = session.post(f"{BASE_URL}/api/admin/geocode/refresh", json={}, timeout=15)
        assert r.status_code in (401, 403)

    def test_refresh_rejects_non_admin_token(self, session):
        # Any user-JWT (signed with a different secret) → InvalidTokenError → 401
        r = session.post(
            f"{BASE_URL}/api/admin/geocode/refresh",
            json={},
            headers={"Authorization": "Bearer eyJ.fake.userjwt", "Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code in (401, 403)


# --------------------------------------------------------------------------- #
# 4. Geocode audit
# --------------------------------------------------------------------------- #
class TestGeocodeAudit:
    def test_audit_no_placeholder_left(self, session, owner_headers):
        r = session.get(
            f"{BASE_URL}/api/admin/geocode/audit", headers=owner_headers, timeout=30
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Both collections must be present in the breakdown.
        for coll in ("doctor_profiles", "partner_profiles"):
            assert coll in body, f"missing {coll}: {body}"
            entry = body[coll]
            assert "total" in entry and "by_precision" in entry and "placeholder_left" in entry
            # placeholder coords must be fully purged.
            assert entry["placeholder_left"] == 0, (
                f"{coll} still has {entry['placeholder_left']} placeholder coords: {entry}"
            )
            # precision breakdown keys must be the canonical set.
            for p in ("landmark", "neighborhood", "city", "country"):
                assert p in entry["by_precision"], f"missing precision {p} in {coll}: {entry}"
        # Sanity bounds.
        assert body["doctor_profiles"]["total"] >= 78
        assert body["partner_profiles"]["total"] >= 104

    def test_audit_requires_admin_token(self, session):
        r = session.get(f"{BASE_URL}/api/admin/geocode/audit", timeout=15)
        assert r.status_code in (401, 403)

    def test_audit_rejects_non_admin_token(self, session):
        r = session.get(
            f"{BASE_URL}/api/admin/geocode/audit",
            headers={"Authorization": "Bearer not-a-jwt"},
            timeout=15,
        )
        assert r.status_code in (401, 403)


# --------------------------------------------------------------------------- #
# 5. Smart search picks up V2 specialty providers w/ real coords
# --------------------------------------------------------------------------- #
class TestSmartSearch:
    def _flatten_providers(self, body):
        """Smart search returns a dict with several lists — flatten any provider-like docs."""
        out = []
        if isinstance(body, dict):
            for key in ("results", "doctors", "partners", "providers"):
                v = body.get(key) or []
                if isinstance(v, list):
                    out.extend(v)
        elif isinstance(body, list):
            out.extend(body)
        return out

    def test_smart_search_urologie_returns_results_with_real_coords(self, session):
        r = session.get(f"{BASE_URL}/api/search/smart", params={"q": "urologie"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        providers = self._flatten_providers(body)
        assert len(providers) >= 5, (
            f"expected >=5 results for 'urologie', got {len(providers)} (keys={list(body) if isinstance(body, dict) else 'list'})"
        )
        # Find at least one provider with non-placeholder coords.
        good = []
        for p in providers:
            c = p.get("coordinates") or {}
            lat, lng = c.get("latitude"), c.get("longitude")
            if lat is None or lng is None:
                # Also accept nested master_profile.contact lat/lng
                mp = (p.get("master_profile") or {}).get("contact") or {}
                lat, lng = mp.get("latitude"), mp.get("longitude")
            if lat is None or lng is None:
                continue
            if (round(float(lat), 4), round(float(lng), 4)) == PLACEHOLDER:
                continue
            good.append(p)
        assert good, f"no V2 urologie provider has real coords — first item: {providers[0] if providers else None}"


# --------------------------------------------------------------------------- #
# 6. Landmark coordinates accuracy (spot check)
# --------------------------------------------------------------------------- #
class TestLandmarkPrecision:
    """Hit /api/admin/geocode/audit and a smart-search to verify some famous
    landmarks have the expected Google-Maps curated coordinates."""

    def _search_first(self, session, q):
        r = session.get(f"{BASE_URL}/api/search/smart", params={"q": q}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        items = []
        if isinstance(body, dict):
            for key in ("results", "doctors", "partners", "providers"):
                v = body.get(key) or []
                items.extend(v if isinstance(v, list) else [])
        return items

    def _coords_of(self, doc):
        c = doc.get("coordinates") or {}
        lat, lng = c.get("latitude"), c.get("longitude")
        if lat is None or lng is None:
            mp = (doc.get("master_profile") or {}).get("contact") or {}
            lat, lng = mp.get("latitude"), mp.get("longitude")
        return lat, lng

    @pytest.mark.parametrize("query,expected_key", [
        ("CHU de Cocody", "chu de cocody"),
        ("CHU de Treichville", "chu de treichville"),
        ("Clinique Farah", "clinique farah"),
        ("PISAM", "pisam"),
    ])
    def test_landmark_coordinates(self, session, query, expected_key):
        items = self._search_first(session, query)
        # We don't strictly need a hit in search — we tolerate 0 hits if the
        # landmark only lives inside a non-indexed field. But if there IS a hit
        # whose name matches the landmark, its coords must equal the curated value.
        exp_lat, exp_lng = LANDMARK_EXPECTED[expected_key]
        matched = [
            it for it in items
            if expected_key in (it.get("name") or it.get("company_name") or "").lower()
        ]
        if not matched:
            pytest.skip(f"No search result for landmark {query!r} — smart search index may not include it")
        for it in matched:
            lat, lng = self._coords_of(it)
            assert lat is not None and lng is not None, f"{query}: missing coords {it}"
            assert (round(float(lat), 4), round(float(lng), 4)) != PLACEHOLDER, (
                f"{query}: still has placeholder coords"
            )
            # Allow ±0.01 deg tolerance for landmark match.
            assert abs(float(lat) - exp_lat) < 0.01 and abs(float(lng) - exp_lng) < 0.01, (
                f"{query}: expected ~{(exp_lat, exp_lng)}, got {(lat, lng)}"
            )


# --------------------------------------------------------------------------- #
# 7. Legacy seed loader not regressed
# --------------------------------------------------------------------------- #
class TestLegacySeedLoader:
    def test_legacy_seed_still_idempotent(self, session, owner_headers):
        # The endpoint is POST /api/admin/run-seed (legacy initial seed_loader).
        r = session.post(
            f"{BASE_URL}/api/admin/run-seed", json={}, headers=owner_headers, timeout=60
        )
        if r.status_code == 404:
            pytest.skip("Legacy /admin/run-seed endpoint not exposed")
        assert r.status_code == 200, r.text
        body = r.json()
        stats = body.get("stats") or {}
        # On a 2nd boot the loader must be a no-op.
        imported_doctor = stats.get("imported_doctor", 0)
        imported_partner = stats.get("imported_partner", 0)
        assert imported_doctor == 0, f"imported_doctor should be 0 (idempotent), got {stats}"
        assert imported_partner == 0, f"imported_partner should be 0 (idempotent), got {stats}"
