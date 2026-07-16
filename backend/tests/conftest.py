import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load frontend .env to get public URL as required
load_dotenv(Path(__file__).parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token():
    """Login and return a bearer token for test user."""
    phone = "+2250701234599"  # TEST_ prefixed via unique last digits
    r = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": phone}, timeout=15)
    assert r.status_code == 200, r.text
    r = requests.post(
        f"{BASE_URL}/api/auth/verify-otp",
        json={"phone": phone, "code": "1234"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
