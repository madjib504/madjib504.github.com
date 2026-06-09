"""
Backend regression tests for Master Model V2 (doctor + partner profiles).
Covers: admin stats, migrate, dedupe, providers/{id}/master, smart-search modes,
structures/add (auto master_profile), claims, backwards-compat routes.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://keneyakafisa-health.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 45

ADMIN_USER = "MADJIB"
ADMIN_PASS = "48851132kl"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _orientation(d):
    """Helper: support both flat and nested orientation responses."""
    o = d.get("orientation") or {}
    return {
        "urgency_level": d.get("urgency_level") or o.get("urgency_level"),
        "emergency_number": d.get("emergency_number") or o.get("emergency_number"),
        "suggestions": d.get("suggestions") or o.get("suggestions") or [],
    }


# ---------- Admin: master-model stats ----------
class TestMasterModelStats:
    def test_stats_returns_100_percent_coverage(self, admin_headers):
        r = requests.get(f"{API}/admin/master-model/stats", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        d = data["doctor_profiles"]
        p = data["partner_profiles"]
        assert d["total"] > 0 and p["total"] > 0
        assert d["with_master_profile"] == d["total"], f"doctor coverage {d}"
        assert p["with_master_profile"] == p["total"], f"partner coverage {p}"


# ---------- Admin: migrate (idempotent) ----------
class TestMigrateMasterModel:
    def test_migrate_idempotent(self, admin_headers):
        r = requests.post(f"{API}/admin/migrate-master-model", headers=admin_headers, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True, d
        assert d.get("doctors_with_master", 0) > 0
        assert d.get("partners_with_master", 0) > 0


# ---------- Admin: dedupe (idempotent) ----------
class TestDedupeProviders:
    def test_dedupe_idempotent_second_run(self, admin_headers):
        # First run (idempotent — DB already deduped per spec)
        r1 = requests.post(f"{API}/admin/dedupe-providers", headers=admin_headers, timeout=120)
        assert r1.status_code == 200, r1.text
        # Second run should remove 0 / 0
        r2 = requests.post(f"{API}/admin/dedupe-providers", headers=admin_headers, timeout=120)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        stats = d2.get("stats", d2)
        assert stats.get("doctors_removed", 0) == 0, f"dedupe not idempotent doctors: {stats}"
        assert stats.get("partners_removed", 0) == 0, f"dedupe not idempotent partners: {stats}"


# ---------- GET /providers/{id}/master ----------
class TestProviderMasterEndpoint:
    def _master_sections_present(self, mp):
        for k in ["identity", "classification", "ai_matching", "contact", "booking", "trust"]:
            assert k in mp, f"missing section {k} in master_profile keys: {list(mp.keys())}"

    def test_doctor_master_profile(self):
        r = requests.get(f"{API}/doctors/search", params={"keyword": "cardio"}, timeout=TIMEOUT)
        assert r.status_code == 200
        doctors = r.json()
        assert isinstance(doctors, list) and len(doctors) > 0
        did = doctors[0].get("id")
        assert did
        rr = requests.get(f"{API}/providers/{did}/master", timeout=TIMEOUT)
        assert rr.status_code == 200, rr.text
        data = rr.json()
        assert data.get("kind") == "doctor"
        self._master_sections_present(data["master_profile"])

    def test_partner_master_profile(self):
        # find a partner via smart-search q=ordonnance
        r = requests.get(f"{API}/search/smart", params={"q": "ordonnance"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        partners = [it for it in r.json().get("results", []) if it.get("provider_kind") == "partner"]
        assert partners, "no partners returned for 'ordonnance'"
        pid = partners[0].get("id")
        assert pid
        rr = requests.get(f"{API}/providers/{pid}/master", timeout=TIMEOUT)
        assert rr.status_code == 200, rr.text
        data = rr.json()
        assert data.get("kind") == "partner"
        self._master_sections_present(data["master_profile"])


# ---------- /search/smart ----------
class TestSmartSearch:
    def test_diabete_orientation(self):
        r = requests.get(f"{API}/search/smart", params={"q": "diabète"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("mode") == "orientation", d.get("mode")
        ori = _orientation(d)
        assert ori["urgency_level"] in ("low", "moderate"), f"urgency_level={ori['urgency_level']}"
        sugg = ori["suggestions"]
        flat = " ".join([(s.get("specialty") if isinstance(s, dict) else str(s)) for s in sugg]).lower()
        assert "endocrin" in flat or "nutrition" in flat, f"suggestions={sugg}"
        results = d.get("results", [])
        assert len(results) >= 5, f"expected >=5 got {len(results)}"
        for it in results:
            assert it.get("provider_kind") in ("doctor", "partner"), it
            assert it.get("master_profile") is not None, f"missing master_profile on {it.get('name')}"

    def test_ordonnance_returns_pharmacies(self):
        r = requests.get(f"{API}/search/smart", params={"q": "ordonnance"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("mode") in ("directory", "hybrid"), d.get("mode")
        results = d.get("results", [])
        assert results, "no results for ordonnance"
        names = [it.get("name") for it in results]
        assert len(names) == len(set(names)), f"duplicates in ordonnance: {names}"
        pharmacie_found = False
        for it in results:
            mp = it.get("master_profile") or {}
            cat = ((mp.get("classification") or {}).get("categorie") or "").lower()
            if "pharmacie" in cat:
                pharmacie_found = True
                break
        assert pharmacie_found, f"no pharmacie in results: {[(r.get('name'), ((r.get('master_profile') or {}).get('classification') or {}).get('categorie')) for r in results]}"

    def test_mal_de_tete_suggestions(self):
        r = requests.get(f"{API}/search/smart", params={"q": "mal de tête"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("mode") == "orientation"
        ori = _orientation(d)
        assert ori["urgency_level"] in ("low", "moderate"), f"urgency_level={ori['urgency_level']}"
        sugg = ori["suggestions"]
        flat = " ".join([(s.get("specialty") if isinstance(s, dict) else str(s)) for s in sugg]).lower()
        assert "neuro" in flat or "générale" in flat or "generale" in flat, f"suggestions={sugg}"

    def test_urgence(self):
        r = requests.get(f"{API}/search/smart", params={"q": "urgence"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        # Per spec: mode='orientation', urgency_level='urgent', emergency_number='185'
        assert d.get("mode") == "orientation", f"BUG: 'urgence' should trigger orientation mode, got {d.get('mode')}"
        ori = _orientation(d)
        assert ori["urgency_level"] == "urgent", f"urgency_level={ori['urgency_level']}"
        assert ori["emergency_number"] == "185", f"emergency_number={ori['emergency_number']}"

    def test_massage_returns_partner(self):
        r = requests.get(f"{API}/search/smart", params={"q": "massage"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        results = d.get("results", [])
        assert results, "no results for massage"
        kinds = [it.get("provider_kind") for it in results]
        assert "partner" in kinds, f"no partner kind in massage: {kinds}"

    def test_smart_dedup_by_name_diabete(self):
        r = requests.get(f"{API}/search/smart", params={"q": "diabète"}, timeout=TIMEOUT)
        assert r.status_code == 200
        names = [it.get("name") for it in r.json().get("results", [])]
        assert len(names) == len(set(names)), f"duplicates in diabète: {names}"

    def test_trust_ranking_descending(self):
        # Use a medical query with many results
        r = requests.get(f"{API}/search/smart", params={"q": "diabète"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json().get("results", [])[:8]
        priorities = []
        for it in results:
            mp = it.get("master_profile") or {}
            tp = (mp.get("trust") or {}).get("triage_priority")
            if isinstance(tp, (int, float)):
                priorities.append(tp)
        if len(priorities) >= 2:
            assert priorities == sorted(priorities, reverse=True), f"trust ranking not descending: {priorities}"

    @pytest.mark.parametrize("q", [" ", "xyz123nonexistent", "cardio,diabète", ""])
    def test_robustness_edge_queries(self, q):
        r = requests.get(f"{API}/search/smart", params={"q": q}, timeout=TIMEOUT)
        # Must NOT crash with 500
        assert r.status_code in (200, 400, 422), f"crash on q='{q}': {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            d = r.json()
            assert "results" in d


# ---------- POST /structures/add (auto master_profile generation) ----------
class TestStructuresAdd:
    def test_create_pharmacie_with_master_profile(self):
        ts = int(time.time())
        payload = {
            "structure_name": f"TEST_Pharmacie_MM_{ts}",
            "phone": "+22501020304",
            "full_name": "TEST Gérant",
            "password": "TestPass123!",
            "categorie": "Pharmacie",
            "sous_categorie": "Pharmacie",
            "ville": "Abidjan",
            "commune": "Cocody",
            "address": "Rue du test, Cocody",
            "function_role": "owner",
            "description": "Pharmacie de test pour master model v2",
        }
        r = requests.post(f"{API}/structures/add", json=payload, timeout=TIMEOUT)
        assert r.status_code in (200, 201), r.text
        # Find created id via smart-search
        time.sleep(1)
        sr = requests.get(f"{API}/search/smart", params={"q": payload["structure_name"]}, timeout=TIMEOUT)
        pid = None
        if sr.status_code == 200:
            for it in sr.json().get("results", []):
                if it.get("name") == payload["structure_name"]:
                    pid = it.get("id")
                    break
        # Fallback: list pharmacies via ordonnance
        if not pid:
            sr2 = requests.get(f"{API}/search/smart", params={"q": "ordonnance"}, timeout=TIMEOUT)
            for it in sr2.json().get("results", []):
                if it.get("name") == payload["structure_name"]:
                    pid = it.get("id")
                    break
        assert pid, f"created structure not found in smart-search: {payload['structure_name']}"
        rr = requests.get(f"{API}/providers/{pid}/master", timeout=TIMEOUT)
        assert rr.status_code == 200, rr.text
        data = rr.json()
        mp = data["master_profile"]
        cat = ((mp.get("classification") or {}).get("categorie") or "").lower()
        assert "pharmacie" in cat, f"categorie not Pharmacie: {cat}"
        ident = mp.get("identity") or {}
        trust = mp.get("trust") or {}
        # is_verified can be in identity or trust depending on impl
        is_verified = ident.get("is_verified") if "is_verified" in ident else trust.get("is_verified")
        assert is_verified is True, f"is_verified should be true: identity={ident} trust={trust}"
        ai = mp.get("ai_matching") or {}
        symptoms = ai.get("symptomes_pris_en_charge") or []
        assert len(symptoms) > 0, f"symptomes_pris_en_charge empty: {ai}"


# ---------- POST /claims ----------
class TestClaims:
    def test_create_claim_flow(self, admin_headers):
        # find an unclaimed partner via smart-search
        r = requests.get(f"{API}/search/smart", params={"q": "ordonnance"}, timeout=TIMEOUT)
        assert r.status_code == 200
        candidates = [it for it in r.json().get("results", []) if it.get("provider_kind") == "partner"]
        # Pick one that is not already claimed/pending
        target = None
        for c in candidates:
            cs_top = c.get("claim_status")
            # POST /claims only blocks if top-level claim_status == 'verified'
            if cs_top not in ("verified", "claim_pending"):
                target = c
                break
        if not target:
            pytest.skip("no unclaimed partner candidate found")
        pid = target.get("id")
        ts = int(time.time())
        payload = {
            "provider_id": pid,
            "provider_kind": "partner",
            "full_name": "TEST Claimant",
            "email": f"test_claim_{ts}@test.com",
            "phone": "+22501020305",
            "function_role": "owner",
            "justification": "Test claim",
            "password": "TestPass123!",
        }
        r = requests.post(f"{API}/claims", json=payload, timeout=TIMEOUT)
        # If already claimed (verified) we may get 400 — pick any unclaimed instead
        if r.status_code == 400 and "déjà revendiquée" in r.text:
            pytest.skip("partner already verified; no candidate available")
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d.get("success") is True
        assert d.get("status") == "pending"

        # Verify the fiche claim_status updated
        rr = requests.get(f"{API}/providers/{pid}/master", timeout=TIMEOUT)
        assert rr.status_code == 200
        # claim_status on partner doc directly (flat) — read via providers/{id}/master returns only master_profile.
        # Use admin listing instead.

        # Verify user created
        ur = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=TIMEOUT)
        if ur.status_code == 200:
            users = ur.json() if isinstance(ur.json(), list) else ur.json().get("users", [])
            assert any(u.get("email") == payload["email"] for u in users), "claim user not created"

        # Verify claim listed
        ar = requests.get(f"{API}/admin/claims", headers=admin_headers, timeout=TIMEOUT)
        assert ar.status_code == 200, ar.text
        claims = ar.json() if isinstance(ar.json(), list) else ar.json().get("claims", [])
        assert any((c.get("provider_id") == pid and c.get("email") == payload["email"]) for c in claims), \
            f"claim not listed for {pid}/{payload['email']}"


# ---------- Backwards compatibility ----------
class TestBackwardsCompat:
    def test_doctors_search_keyword_cardio(self):
        r = requests.get(f"{API}/doctors/search", params={"keyword": "cardio"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert len(items) > 0, "no cardio doctor results from /api/doctors/search"

    def test_doctors_search_no_keyword_returns_list(self):
        # /api/doctors/search without keyword acts as listing
        r = requests.get(f"{API}/doctors/search", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
