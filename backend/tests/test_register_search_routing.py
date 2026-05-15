"""
Tests for 3 fixes:
1. Patient registration accepts/persists 'address' field
2. /api/doctors/search keyword aliases (cardiologue -> Cardiologie, etc.)
3. Partner user_type properly handled (not as doctor)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://keneyakafisa-health.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

TS = int(time.time())
PASSWORD = "TestPass123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def patient_creds(session):
    """Register a TEST_ patient with address."""
    payload = {
        "email": f"testflow_v2_patient_{TS}@test.com",
        "name": "TEST_ Patient WithAddress",
        "password": PASSWORD,
        "user_type": "patient",
        "address": "Abidjan, Cocody Riviera 3",
        "whatsapp_number": "+2250777000001"
    }
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return {"email": payload["email"], "token": data["token"], "user": data["user"], "address": payload["address"]}


@pytest.fixture(scope="module")
def partner_creds(session):
    """Register a TEST_ partner."""
    payload = {
        "email": f"testflow_v2_partner_{TS}@test.com",
        "name": "TEST_ Partner Co",
        "password": PASSWORD,
        "user_type": "partner",
        "company_name": "TEST_ Pharma Plus",
        "activity_type": "pharmacie",
        "address": "Abidjan, Plateau",
        "whatsapp_number": "+2250777000002"
    }
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"Partner register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": payload["email"], "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def doctor_creds(session):
    """Register a TEST_ doctor with Pédiatrie specialty (to verify alias)."""
    payload = {
        "email": f"testflow_v2_doctor_{TS}@test.com",
        "name": "TEST_ Dr Pediatre",
        "password": PASSWORD,
        "user_type": "doctor",
        "medical_type": "moderne",
        "specialties": ["Pédiatrie"],
        "whatsapp_number": "+2250777000003"
    }
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"Doctor register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": payload["email"], "token": data["token"], "user": data["user"]}


# --- FIX 1: Patient address persistence ---
class TestPatientAddress:
    def test_register_returns_patient_with_address(self, patient_creds):
        user = patient_creds["user"]
        assert user["user_type"] == "patient"
        # user may not echo address in response, that's OK - we verify via /auth/me below

    def test_auth_me_returns_address(self, session, patient_creds):
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {patient_creds['token']}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == patient_creds["email"]
        assert data.get("address") == patient_creds["address"], f"Address not persisted; got {data.get('address')}"
        assert data["user_type"] == "patient"


# --- FIX 2: Doctor search keyword aliases ---
class TestDoctorSearchAliases:
    def test_search_cardiologue_finds_cardiologie(self, session, doctor_creds):
        # doctor_creds ensures at least registration flow works; existing DB has Cardiologie doctors
        r = session.get(f"{API}/doctors/search", params={"keyword": "cardiologue"})
        assert r.status_code == 200, r.text
        results = r.json()
        assert isinstance(results, list)
        assert len(results) > 0, "Expected to find Cardiologie doctors via 'cardiologue' alias"
        # at least one doctor should have a specialty containing 'cardiolog' (case-insensitive)
        found = any(
            any("cardiolog" in (sp or "").lower() for sp in (d.get("specialties") or []))
            for d in results
        )
        assert found, f"No doctor with cardiolog* specialty in results: {[d.get('specialties') for d in results]}"

    def test_search_pediatre_finds_pediatrie(self, session, doctor_creds):
        r = session.get(f"{API}/doctors/search", params={"keyword": "pédiatre"})
        assert r.status_code == 200
        results = r.json()
        assert len(results) > 0, "Expected to find Pédiatrie doctors via 'pédiatre' alias"
        found = any(
            any("pédiatr" in (sp or "").lower() for sp in (d.get("specialties") or []))
            for d in results
        )
        assert found, f"No Pédiatrie doctor in results"

    def test_search_gyneco_alias(self, session):
        r = session.get(f"{API}/doctors/search", params={"keyword": "gynéco"})
        assert r.status_code == 200
        # may be 0 if no gyneco doctors in DB, but should not 500
        assert isinstance(r.json(), list)

    def test_search_dermato_alias(self, session):
        r = session.get(f"{API}/doctors/search", params={"keyword": "dermato"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search_kine_alias(self, session):
        r = session.get(f"{API}/doctors/search", params={"keyword": "kiné"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search_ophtalmo_alias(self, session):
        r = session.get(f"{API}/doctors/search", params={"keyword": "ophtalmo"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search_exact_cardiologie_still_works(self, session):
        r = session.get(f"{API}/doctors/search", params={"keyword": "Cardiologie"})
        assert r.status_code == 200
        results = r.json()
        assert len(results) > 0, "Exact 'Cardiologie' keyword should still match"


# --- FIX 3: Partner user_type properly handled ---
class TestPartnerUserType:
    def test_partner_user_type_is_partner(self, partner_creds):
        assert partner_creds["user"]["user_type"] == "partner"

    def test_partner_auth_me_returns_partner(self, session, partner_creds):
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {partner_creds['token']}"})
        assert r.status_code == 200
        assert r.json()["user_type"] == "partner"

    def test_partner_login_returns_partner_type(self, session, partner_creds):
        r = session.post(f"{API}/auth/login", json={
            "email": partner_creds["email"],
            "password": PASSWORD
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["user_type"] == "partner"

    def test_doctor_login_returns_doctor_type(self, session, doctor_creds):
        r = session.post(f"{API}/auth/login", json={
            "email": doctor_creds["email"],
            "password": PASSWORD
        })
        assert r.status_code == 200, r.text
        assert r.json()["user"]["user_type"] == "doctor"

    def test_patient_login_returns_patient_type(self, session, patient_creds):
        r = session.post(f"{API}/auth/login", json={
            "email": patient_creds["email"],
            "password": PASSWORD
        })
        assert r.status_code == 200
        assert r.json()["user"]["user_type"] == "patient"
