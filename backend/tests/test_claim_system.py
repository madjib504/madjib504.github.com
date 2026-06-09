"""End-to-end tests for the Provider Claim system.

Covers:
  - /api/admin/claims/stats (7 KPIs)
  - /api/claims/upload (PDF/PNG, size limit, content-type filter)
  - /api/claims (create, validation, trust score, duplicate guards)
  - /api/admin/claims (list filters), /api/admin/claims/{id} (detail + 404)
  - /api/admin/claims/{id}/decide (approve full mutation, double-decide guard)
  - E2E: created user can login after approve.
  - Cleanup TEST_* claimants
"""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://keneyakafisa-health.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USERNAME = "MADJIB"
ADMIN_PASSWORD = "48851132kl"


# Minimal valid 1x1 PNG
PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
    "0000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)

# Minimal valid PDF
PDF_BYTES = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000095 00000 n\n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n140\n%%EOF\n"
)


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


SEARCH_QUERIES = ["cl", "po", "ph", "ca", "ce", "ho", "ma", "sa"]


def _find_fresh_provider(exclude_ids=()):
    """Search for an un-claimed provider not in exclude_ids."""
    seen = set()
    for q in SEARCH_QUERIES:
        r = requests.get(f"{API}/providers/search", params={"q": q, "limit": 50}, timeout=15)
        if r.status_code != 200:
            continue
        for p in r.json():
            pid = p.get("id")
            if pid in seen or pid in exclude_ids:
                continue
            seen.add(pid)
            status = (p.get("claim_status") or "seeded")
            if status not in ("verified", "claim_pending"):
                return p
    return None


@pytest.fixture(scope="session")
def existing_provider(admin_headers):
    """Find an existing un-claimed provider to claim against."""
    p = _find_fresh_provider()
    if not p:
        pytest.skip("No unclaimed provider available")
    return p


CREATED_CLAIM_IDS = []
CREATED_USER_IDS = []


# ============ STATS ============

class TestClaimsStats:
    def test_stats_keys_and_types(self, admin_headers):
        r = requests.get(f"{API}/admin/claims/stats", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        expected = ["providers_total", "providers_doctors", "providers_partners",
                    "providers_claimed", "claims_pending", "claims_approved", "claims_rejected"]
        for k in expected:
            assert k in data, f"missing key {k}"
            assert isinstance(data[k], int), f"{k} not int: {data[k]}"
            assert data[k] >= 0, f"{k} negative"


# ============ UPLOAD ============

class TestClaimsUpload:
    def test_upload_pdf_ok(self):
        files = {"file": ("test.pdf", PDF_BYTES, "application/pdf")}
        r = requests.post(f"{API}/claims/upload", files=files, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["url"].startswith("/api/media/")
        assert data["content_type"] == "application/pdf"
        assert data["size"] == len(PDF_BYTES)
        # Try to GET back via media endpoint
        r2 = requests.get(f"{BASE_URL}{data['url']}", timeout=15)
        assert r2.status_code in (200, 302), f"media fetch failed: {r2.status_code}"

    def test_upload_png_ok(self):
        files = {"file": ("test.png", PNG_BYTES, "image/png")}
        r = requests.post(f"{API}/claims/upload", files=files, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["content_type"] == "image/png"

    def test_upload_rejects_zip(self):
        files = {"file": ("evil.zip", b"PK\x03\x04fake", "application/zip")}
        r = requests.post(f"{API}/claims/upload", files=files, timeout=10)
        assert r.status_code == 400, r.text

    def test_upload_rejects_oversize(self):
        big = b"\x00" * (10 * 1024 * 1024 + 100)
        files = {"file": ("big.pdf", big, "application/pdf")}
        r = requests.post(f"{API}/claims/upload", files=files, timeout=60)
        assert r.status_code == 400, r.text


# ============ CREATE CLAIM ============

def _create_claim(provider, claim_type="owner", email=None, docs=None, justification=None, phone=None, full_name=None, password="TestPass123!"):
    kind = provider.get("kind") or provider.get("provider_kind") or "doctor"
    provider_kind = "doctor" if kind == "doctor" else "partner"
    payload = {
        "provider_id": provider.get("id"),
        "provider_kind": provider_kind,
        "full_name": full_name or f"TEST Claimant {uuid.uuid4().hex[:6]}",
        "phone": phone or f"+22507{uuid.uuid4().int % 100000000:08d}",
        "email": email,
        "claim_type": claim_type,
        "justification": justification if justification is not None else "Je suis le propriétaire/gestionnaire de cette structure depuis plus de 5 ans et je gère l'équipe quotidiennement.",
        "password": password,
        "proof_documents": docs or [],
    }
    return requests.post(f"{API}/claims", json=payload, timeout=20), payload


class TestClaimCreate:
    def test_invalid_claim_type(self, existing_provider):
        r, _ = _create_claim(existing_provider, claim_type="invalid_role")
        assert r.status_code == 400, r.text

    def test_high_trust_score(self, existing_provider):
        # 2 docs uploaded
        docs = []
        for _ in range(2):
            up = requests.post(f"{API}/claims/upload",
                               files={"file": ("doc.pdf", PDF_BYTES, "application/pdf")}, timeout=15).json()
            docs.append({"url": up["url"], "name": up["name"], "content_type": up["content_type"]})
        email = f"test.pro.{uuid.uuid4().hex[:6]}@clinique-pro.ci"
        justification = "A" * 80
        r, p = _create_claim(existing_provider, claim_type="owner", email=email,
                             docs=docs, justification=justification)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["trust_score"] >= 70, f"trust_score too low: {data['trust_score']}"
        CREATED_CLAIM_IDS.append(data["claim_id"])

    def test_low_trust_score_then_reject(self, admin_headers, existing_provider):
        target = _find_fresh_provider(exclude_ids=[existing_provider.get("id")])
        if not target:
            pytest.skip("No second unclaimed provider")
        email = f"low.{uuid.uuid4().hex[:6]}@gmail.com"
        r, _ = _create_claim(target, claim_type="owner", email=email, docs=[], justification="trop court")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["trust_score"] <= 25, f"trust_score should be low: {data['trust_score']}"
        CREATED_CLAIM_IDS.append(data["claim_id"])

        # Reject this one to free the provider
        rj = requests.put(f"{API}/admin/claims/{data['claim_id']}/decide",
                          headers=admin_headers, json={"action": "reject", "reason": "low trust test"}, timeout=15)
        assert rj.status_code == 200, rj.text

    def test_duplicate_pending_blocked(self, existing_provider):
        target = _find_fresh_provider(exclude_ids=[existing_provider.get("id")])
        if not target:
            pytest.skip("No third unclaimed provider")
        phone = f"+22507{uuid.uuid4().int % 100000000:08d}"
        email1 = f"dup1.{uuid.uuid4().hex[:6]}@gmail.com"
        r1, _ = _create_claim(target, phone=phone, email=email1)
        assert r1.status_code == 200, r1.text
        CREATED_CLAIM_IDS.append(r1.json()["claim_id"])
        # Same phone, same provider → duplicate
        email2 = f"dup2.{uuid.uuid4().hex[:6]}@gmail.com"
        r2, _ = _create_claim(target, phone=phone, email=email2)
        assert r2.status_code == 400, f"expected 400, got {r2.status_code}: {r2.text}"
        assert "déjà" in r2.json().get("detail", "").lower() or "exist" in r2.json().get("detail", "").lower()


# ============ LIST / DETAIL ============

class TestClaimList:
    def test_filter_pending(self, admin_headers):
        r = requests.get(f"{API}/admin/claims", params={"status": "pending"}, headers=admin_headers, timeout=10)
        assert r.status_code == 200
        for c in r.json():
            assert c["status"] == "pending"

    def test_filter_all(self, admin_headers):
        r_all = requests.get(f"{API}/admin/claims", params={"status": "all"}, headers=admin_headers, timeout=10).json()
        r_p = requests.get(f"{API}/admin/claims", params={"status": "pending"}, headers=admin_headers, timeout=10).json()
        assert len(r_all) >= len(r_p)
        statuses = {c["status"] for c in r_all}
        assert statuses.issubset({"pending", "approved", "rejected"})

    def test_detail_404(self, admin_headers):
        r = requests.get(f"{API}/admin/claims/does-not-exist-xyz", headers=admin_headers, timeout=10)
        assert r.status_code == 404

    def test_detail_shape(self, admin_headers):
        if not CREATED_CLAIM_IDS:
            pytest.skip("No claim created")
        cid = CREATED_CLAIM_IDS[0]
        r = requests.get(f"{API}/admin/claims/{cid}", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("claim", "provider", "user", "other_claims", "trust_score_current"):
            assert k in data, f"missing {k}"
        assert isinstance(data["trust_score_current"], int)
        assert data["provider"] is not None
        assert data["user"] is not None


# ============ DECIDE / APPROVE ============

class TestClaimDecide:
    def test_approve_flow_full(self, admin_headers):
        # Create dedicated claim for approval
        target = _find_fresh_provider()
        if not target:
            pytest.skip("No fresh provider for approve test")
        email = f"approve.{uuid.uuid4().hex[:6]}@pro-clinic.ci"
        password = "Strong#Pass1"
        r, payload = _create_claim(target, claim_type="manager", email=email,
                                   docs=[], justification="Manager légal de cette structure depuis 3 ans avec mandat écrit.",
                                   password=password)
        assert r.status_code == 200, r.text
        claim_id = r.json()["claim_id"]
        CREATED_CLAIM_IDS.append(claim_id)

        # Approve
        r2 = requests.put(f"{API}/admin/claims/{claim_id}/decide",
                         headers=admin_headers,
                         json={"action": "approve", "reason": "verified docs"}, timeout=15)
        assert r2.status_code == 200, r2.text

        # Verify claim status, provider, user
        detail = requests.get(f"{API}/admin/claims/{claim_id}", headers=admin_headers, timeout=10).json()
        assert detail["claim"]["status"] == "approved"
        assert detail["claim"].get("decided_at")
        assert detail["claim"].get("decision_reason") == "verified docs"
        assert detail["provider"]["claim_status"] == "verified"
        mp_trust = (detail["provider"].get("master_profile") or {}).get("trust", {})
        assert mp_trust.get("claim_status") == "verified"
        assert detail["user"]["verified"] is True
        assert detail["user"].get("claim_pending") is False
        assert detail["user"]["email_verified"] is True
        CREATED_USER_IDS.append(detail["user"]["id"])

        # Login as that user
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
        assert login.status_code == 200, f"login failed for approved claimant: {login.status_code} {login.text}"

        # Second decision must fail
        r3 = requests.put(f"{API}/admin/claims/{claim_id}/decide",
                          headers=admin_headers, json={"action": "approve", "reason": "again"}, timeout=10)
        assert r3.status_code == 400, r3.text
        assert "approved" in r3.json().get("detail", "").lower()

    def test_already_claimed_blocked(self, admin_headers):
        # The provider approved above is now verified — a new claim must 400
        approved_claim = None
        all_claims = requests.get(f"{API}/admin/claims", params={"status": "approved"}, headers=admin_headers, timeout=10).json()
        if not all_claims:
            pytest.skip("no approved claim")
        approved_claim = all_claims[0]
        # Find the provider object
        kind = approved_claim["provider_kind"]
        # Best effort: search & find
        r = requests.get(f"{API}/providers/search", params={"q": approved_claim.get("provider_name") or "", "limit": 50}, timeout=15)
        provs = r.json()
        target = next((p for p in provs if p.get("id") == approved_claim["provider_id"]), None)
        if not target:
            pytest.skip("provider not found in search after approve")
        target["provider_kind"] = kind  # ensure routing
        r2, _ = _create_claim(target, claim_type="owner", email=f"x.{uuid.uuid4().hex[:6]}@pro.ci")
        assert r2.status_code == 400, r2.text


# ============ CLEANUP ============

def test_zz_cleanup(admin_headers):
    """Delete any TEST users created during this run."""
    # Find all users whose name starts with "TEST Claimant"
    try:
        r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=15)
        if r.status_code != 200:
            return
        users = r.json()
        if isinstance(users, dict):
            users = users.get("users", [])
        for u in users:
            if (u.get("name") or "").startswith("TEST Claimant") or u.get("id") in CREATED_USER_IDS:
                uid = u.get("id")
                if uid:
                    requests.delete(f"{API}/admin/users/{uid}", headers=admin_headers, timeout=10)
    except Exception as e:
        print(f"cleanup warn: {e}")
