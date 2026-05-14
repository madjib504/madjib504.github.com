"""
Tests for social media links and presentation video upload feature.
Covers: doctor registration, partner registration, /api/profile/social-links (PUT),
/api/upload/video (POST), /api/media/{path} (GET), /api/doctors/{id} (GET) exposing
the new fields, /api/partner/profile (GET) exposing the new fields, and the 403
permission check for patients trying to upload videos.
"""
import os
import time
import struct
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://keneyakafisa-health.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TS = int(time.time())
DOCTOR_EMAIL = f"testflow_doctor_{TS}@test.com"
PARTNER_EMAIL = f"testflow_partner_{TS}@test.com"
PATIENT_EMAIL = f"testflow_patient_{TS}@test.com"
PASSWORD = "TestPass123!"


def _minimal_mp4_bytes() -> bytes:
    """Return a tiny but well-formed-enough MP4 byte sequence (an ftyp box).
    Backend only checks file.content_type and total length, not actual MP4 parsing.
    """
    # ftyp box: size(4) + 'ftyp' + 'isom' + minor_version(4) + compatible brands
    payload = b"isom" + struct.pack(">I", 512) + b"isomiso2avc1mp41"
    box = struct.pack(">I", 8 + len(payload)) + b"ftyp" + payload
    # pad to ~1KB
    return box + b"\x00" * (1024 - len(box))


@pytest.fixture(scope="module")
def doctor_ctx():
    payload = {
        "email": DOCTOR_EMAIL,
        "name": "Dr Test Flow",
        "user_type": "doctor",
        "password": PASSWORD,
        "medical_type": "moderne",
        "specialties": ["Cardiologie"],
        "whatsapp_number": "+22312345678",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"Doctor register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return {"token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def partner_ctx():
    payload = {
        "email": PARTNER_EMAIL,
        "name": "Partner Test Flow",
        "user_type": "partner",
        "password": PASSWORD,
        "company_name": "TestCo",
        "activity_type": "pharmacie",
        "address": "Bamako",
        "whatsapp_number": "+22398765432",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"Partner register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def patient_ctx():
    payload = {
        "email": PATIENT_EMAIL,
        "name": "Patient Test Flow",
        "user_type": "patient",
        "password": PASSWORD,
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"Patient register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"]}


# ============ REGISTRATION ============

def test_doctor_registered(doctor_ctx):
    assert doctor_ctx["user"]["user_type"] == "doctor"
    assert doctor_ctx["user"]["email"] == DOCTOR_EMAIL


def test_partner_registered(partner_ctx):
    assert partner_ctx["user"]["user_type"] == "partner"
    assert partner_ctx["user"]["email"] == PARTNER_EMAIL


# ============ SOCIAL LINKS ============

def test_doctor_save_social_links(doctor_ctx):
    headers = {"Authorization": f"Bearer {doctor_ctx['token']}"}
    body = {
        "tiktok_url": "https://tiktok.com/@drtest",
        "facebook_url": "https://facebook.com/drtest",
        "instagram_url": "https://instagram.com/drtest",
        "video_url": "https://youtube.com/watch?v=abcd1234",
    }
    r = requests.put(f"{API}/profile/social-links", json=body, headers=headers, timeout=15)
    assert r.status_code == 200, f"Doctor social-links failed: {r.status_code} {r.text}"
    prof = r.json()
    assert prof.get("tiktok_url") == body["tiktok_url"]
    assert prof.get("facebook_url") == body["facebook_url"]
    assert prof.get("instagram_url") == body["instagram_url"]
    assert prof.get("video_url") == body["video_url"]
    assert "_id" not in prof


def test_partner_save_social_links(partner_ctx):
    headers = {"Authorization": f"Bearer {partner_ctx['token']}"}
    body = {
        "tiktok_url": "https://tiktok.com/@partner",
        "facebook_url": "https://facebook.com/partner",
        "instagram_url": "https://instagram.com/partner",
        "video_url": "https://vimeo.com/12345",
    }
    r = requests.put(f"{API}/profile/social-links", json=body, headers=headers, timeout=15)
    assert r.status_code == 200, f"Partner social-links failed: {r.status_code} {r.text}"
    prof = r.json()
    assert prof.get("tiktok_url") == body["tiktok_url"]
    assert prof.get("video_url") == body["video_url"]


# ============ VIDEO UPLOAD ============

def test_patient_cannot_upload_video(patient_ctx):
    headers = {"Authorization": f"Bearer {patient_ctx['token']}"}
    files = {"file": ("test.mp4", _minimal_mp4_bytes(), "video/mp4")}
    r = requests.post(f"{API}/upload/video", files=files, headers=headers, timeout=30)
    assert r.status_code == 403, f"Expected 403 for patient upload, got {r.status_code} {r.text}"


def test_doctor_upload_video(doctor_ctx):
    headers = {"Authorization": f"Bearer {doctor_ctx['token']}"}
    files = {"file": ("doctor_intro.mp4", _minimal_mp4_bytes(), "video/mp4")}
    r = requests.post(f"{API}/upload/video", files=files, headers=headers, timeout=60)
    assert r.status_code == 200, f"Doctor video upload failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    assert "video_url" in data
    assert data["video_url"].startswith("/api/media/keneyakafisa/videos/"), data["video_url"]
    # Persist for later test
    pytest.doctor_video_url = data["video_url"]


def test_partner_upload_video(partner_ctx):
    headers = {"Authorization": f"Bearer {partner_ctx['token']}"}
    files = {"file": ("partner_intro.mp4", _minimal_mp4_bytes(), "video/mp4")}
    r = requests.post(f"{API}/upload/video", files=files, headers=headers, timeout=60)
    assert r.status_code == 200, f"Partner video upload failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    assert data["video_url"].startswith("/api/media/keneyakafisa/videos/")
    pytest.partner_video_url = data["video_url"]


# ============ MEDIA SERVING ============

def test_serve_media_returns_video_bytes():
    url = getattr(pytest, "doctor_video_url", None)
    if not url:
        pytest.skip("doctor video upload did not run")
    full = f"{BASE_URL}{url}"
    r = requests.get(full, timeout=30)
    assert r.status_code == 200, f"GET media failed: {r.status_code}"
    assert r.headers.get("content-type", "").startswith("video/"), r.headers.get("content-type")
    assert len(r.content) > 100


# ============ DOCTOR PUBLIC PROFILE INCLUDES FIELDS ============

def test_doctor_public_profile_has_social_and_video(doctor_ctx):
    # Find doctor_profile id via search
    r = requests.get(f"{API}/doctors/search", params={}, timeout=15)
    assert r.status_code == 200
    doctors = r.json()
    me = next((d for d in doctors if d.get("email") == DOCTOR_EMAIL), None)
    assert me is not None, "Newly registered doctor not found in /doctors/search"
    doctor_id = me["id"]
    r2 = requests.get(f"{API}/doctors/{doctor_id}", timeout=15)
    assert r2.status_code == 200, r2.text
    prof = r2.json()
    assert prof.get("tiktok_url") == "https://tiktok.com/@drtest"
    assert prof.get("facebook_url") == "https://facebook.com/drtest"
    assert prof.get("instagram_url") == "https://instagram.com/drtest"
    assert prof.get("video_url") == "https://youtube.com/watch?v=abcd1234"
    assert prof.get("presentation_video", "").startswith("/api/media/keneyakafisa/videos/")
    # expose doctor_id for frontend test
    pytest.doctor_id = doctor_id


# ============ PARTNER PROFILE GET ============

def test_partner_profile_has_social_and_video(partner_ctx):
    headers = {"Authorization": f"Bearer {partner_ctx['token']}"}
    r = requests.get(f"{API}/partner/profile", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    prof = r.json()
    assert prof.get("tiktok_url") == "https://tiktok.com/@partner"
    assert prof.get("facebook_url") == "https://facebook.com/partner"
    assert prof.get("instagram_url") == "https://instagram.com/partner"
    assert prof.get("video_url") == "https://vimeo.com/12345"
    assert prof.get("presentation_video", "").startswith("/api/media/keneyakafisa/videos/")


# ============ BAD CONTENT TYPE ============

def test_upload_video_rejects_non_video(doctor_ctx):
    headers = {"Authorization": f"Bearer {doctor_ctx['token']}"}
    files = {"file": ("notvideo.txt", b"not a video", "text/plain")}
    r = requests.post(f"{API}/upload/video", files=files, headers=headers, timeout=30)
    assert r.status_code == 400, f"Expected 400 for non-video, got {r.status_code} {r.text}"
