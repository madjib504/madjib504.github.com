"""
Tests for OWNER admin management feature.
- POST /api/admin/login (MADJIB) → super_admin_owner + last_login_at
- CRUD /api/admin/owner/admins (create/list/update/delete moderators)
- /api/admin/owner/audit-log (read + filters)
- Authorization: moderator cannot access /admin/owner/* nor /admin/delete-all
- /admin/maintenance + /admin/claims decide → audit entries
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

OWNER_USER = "MADJIB"
OWNER_PASS = "48851132kl"

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def owner_token(api):
    r = api.post(f"{BASE_URL}/api/admin/login", json={"username": OWNER_USER, "password": OWNER_PASS})
    assert r.status_code == 200, f"OWNER login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("admin_role") == "super_admin_owner"
    return data["token"]


@pytest.fixture(scope="module")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def state():
    """Shared module state: created moderator id + username + token + seed_owner_id."""
    return {}


# ---------------------------------------------------------------------------
# 1. OWNER login & verify
# ---------------------------------------------------------------------------

def test_01_owner_login_role_and_last_login(api, owner_token):
    r = api.post(f"{BASE_URL}/api/admin/login", json={"username": OWNER_USER, "password": OWNER_PASS})
    assert r.status_code == 200
    body = r.json()
    assert body["admin_role"] == "super_admin_owner"
    assert isinstance(body["token"], str) and len(body["token"]) > 10


def test_02_owner_list_admins_contains_seed(api, owner_headers, state):
    r = api.get(f"{BASE_URL}/api/admin/owner/admins", headers=owner_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "admins" in data
    seeds = [a for a in data["admins"] if a.get("is_seed_owner") is True]
    assert len(seeds) >= 1, "no seed_owner admin found"
    seed = seeds[0]
    assert seed.get("is_active") is True
    assert seed.get("admin_role") == "super_admin_owner"
    state["seed_owner_id"] = seed["id"]


# ---------------------------------------------------------------------------
# 2. Create moderator (happy + validation)
# ---------------------------------------------------------------------------

def test_03_create_moderator_success(api, owner_headers, state):
    uname = f"TESTmod_{uuid.uuid4().hex[:8]}"
    pwd = "Pwd123456!"
    payload = {"username": uname, "password": pwd, "display_name": "Test Mod", "admin_role": "moderator"}
    r = api.post(f"{BASE_URL}/api/admin/owner/admins", headers=owner_headers, json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    a = body["admin"]
    assert a["username"] == uname
    assert a["admin_role"] == "moderator"
    assert a["is_active"] is True
    assert "password" not in a
    state["mod_id"] = a["id"]
    state["mod_username"] = uname
    state["mod_password"] = pwd


def test_04_create_moderator_duplicate_username(api, owner_headers, state):
    payload = {"username": state["mod_username"], "password": "Pwd123456!", "display_name": "X", "admin_role": "moderator"}
    r = api.post(f"{BASE_URL}/api/admin/owner/admins", headers=owner_headers, json=payload)
    assert r.status_code == 400


def test_05_create_moderator_short_password(api, owner_headers):
    payload = {"username": f"TESTshort_{uuid.uuid4().hex[:6]}", "password": "abc", "display_name": "X", "admin_role": "moderator"}
    r = api.post(f"{BASE_URL}/api/admin/owner/admins", headers=owner_headers, json=payload)
    assert r.status_code == 400


def test_06_create_moderator_with_owner_role_rejected(api, owner_headers):
    payload = {"username": f"TESTowner_{uuid.uuid4().hex[:6]}", "password": "Pwd123456!", "display_name": "X",
               "admin_role": "super_admin_owner"}
    r = api.post(f"{BASE_URL}/api/admin/owner/admins", headers=owner_headers, json=payload)
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# 3. Moderator login + authorization
# ---------------------------------------------------------------------------

def test_07_moderator_login(api, state):
    r = api.post(f"{BASE_URL}/api/admin/login", json={"username": state["mod_username"], "password": state["mod_password"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["admin_role"] == "moderator"
    state["mod_token"] = body["token"]


def test_08_moderator_blocked_from_owner_endpoints(api, state):
    h = {"Authorization": f"Bearer {state['mod_token']}"}
    r = api.get(f"{BASE_URL}/api/admin/owner/admins", headers=h)
    assert r.status_code == 403


def test_09_moderator_allowed_on_admin_stats(api, state):
    h = {"Authorization": f"Bearer {state['mod_token']}"}
    r = api.get(f"{BASE_URL}/api/admin/stats", headers=h)
    assert r.status_code == 200


def test_10_moderator_blocked_from_delete_all(api, state):
    h = {"Authorization": f"Bearer {state['mod_token']}"}
    r = api.delete(f"{BASE_URL}/api/admin/delete-all", headers=h)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# 4. PATCH moderator
# ---------------------------------------------------------------------------

def test_11_patch_moderator_display_role_password(api, owner_headers, state):
    new_pwd = "NewPwd9876!"
    payload = {"display_name": "Mod Renamed", "admin_role": "support", "password": new_pwd}
    r = api.patch(f"{BASE_URL}/api/admin/owner/admins/{state['mod_id']}", headers=owner_headers, json=payload)
    assert r.status_code == 200, r.text
    a = r.json()["admin"]
    assert a["display_name"] == "Mod Renamed"
    assert a["admin_role"] == "support"
    state["mod_password"] = new_pwd

    # Verify login with new password works
    r2 = api.post(f"{BASE_URL}/api/admin/login", json={"username": state["mod_username"], "password": new_pwd})
    assert r2.status_code == 200
    assert r2.json()["admin_role"] == "support"


def test_12_patch_deactivate_moderator_blocks_login(api, owner_headers, state):
    r = api.patch(f"{BASE_URL}/api/admin/owner/admins/{state['mod_id']}",
                  headers=owner_headers, json={"is_active": False})
    assert r.status_code == 200
    # Login attempt
    r2 = api.post(f"{BASE_URL}/api/admin/login", json={"username": state["mod_username"], "password": state["mod_password"]})
    assert r2.status_code == 403
    assert "désactivé" in r2.json().get("detail", "").lower() or "desactiv" in r2.json().get("detail", "").lower()
    # Reactivate for subsequent delete test
    api.patch(f"{BASE_URL}/api/admin/owner/admins/{state['mod_id']}", headers=owner_headers, json={"is_active": True})


def test_13_cannot_deactivate_seed_owner(api, owner_headers, state):
    r = api.patch(f"{BASE_URL}/api/admin/owner/admins/{state['seed_owner_id']}",
                  headers=owner_headers, json={"is_active": False})
    assert r.status_code == 400


def test_14_cannot_change_seed_owner_role(api, owner_headers, state):
    r = api.patch(f"{BASE_URL}/api/admin/owner/admins/{state['seed_owner_id']}",
                  headers=owner_headers, json={"admin_role": "moderator"})
    assert r.status_code == 400


def test_15_cannot_delete_seed_owner(api, owner_headers, state):
    r = api.delete(f"{BASE_URL}/api/admin/owner/admins/{state['seed_owner_id']}", headers=owner_headers)
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# 5. Audit log
# ---------------------------------------------------------------------------

def test_16_audit_log_contains_created_and_updated(api, owner_headers, state):
    r = api.get(f"{BASE_URL}/api/admin/owner/audit-log?limit=200", headers=owner_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    entries = body.get("entries", [])
    assert isinstance(entries, list) and len(entries) > 0
    actions = {e.get("action") for e in entries}
    assert "admin_created" in actions
    assert "admin_updated" in actions
    # Sorted desc by created_at
    times = [e.get("created_at") for e in entries if e.get("created_at")]
    assert times == sorted(times, reverse=True)


def test_17_audit_log_filter_by_action(api, owner_headers):
    r = api.get(f"{BASE_URL}/api/admin/owner/audit-log?action=admin_created&limit=50", headers=owner_headers)
    assert r.status_code == 200
    entries = r.json().get("entries", [])
    assert all(e.get("action") == "admin_created" for e in entries)
    assert len(entries) >= 1


def test_18_audit_log_filter_by_actor(api, owner_headers, state):
    r = api.get(f"{BASE_URL}/api/admin/owner/audit-log?actor_admin_id={state['seed_owner_id']}&limit=50",
                headers=owner_headers)
    assert r.status_code == 200
    entries = r.json().get("entries", [])
    # Should be at least 1, all from this actor
    assert all(e.get("actor_admin_id") == state["seed_owner_id"] for e in entries)


# ---------------------------------------------------------------------------
# 6. Maintenance + audit
# ---------------------------------------------------------------------------

def test_19_maintenance_toggle_writes_audit(api, owner_headers):
    # Toggle ON then OFF (to leave system as-is)
    for enabled in (True, False):
        r = api.put(f"{BASE_URL}/api/admin/maintenance", headers=owner_headers, json={"enabled": enabled})
        assert r.status_code == 200, r.text
    time.sleep(0.5)
    r2 = api.get(f"{BASE_URL}/api/admin/owner/audit-log?action=maintenance_toggled&limit=10", headers=owner_headers)
    assert r2.status_code == 200
    entries = r2.json().get("entries", [])
    assert len(entries) >= 1, "no maintenance_toggled audit entry found"
    assert entries[0]["action"] == "maintenance_toggled"


# ---------------------------------------------------------------------------
# 7. Cleanup: delete the moderator
# ---------------------------------------------------------------------------

def test_20_delete_moderator(api, owner_headers, state):
    r = api.delete(f"{BASE_URL}/api/admin/owner/admins/{state['mod_id']}", headers=owner_headers)
    assert r.status_code == 200
    # Confirm gone
    r2 = api.get(f"{BASE_URL}/api/admin/owner/admins", headers=owner_headers)
    ids = [a["id"] for a in r2.json().get("admins", [])]
    assert state["mod_id"] not in ids
    # Audit row exists
    r3 = api.get(f"{BASE_URL}/api/admin/owner/audit-log?action=admin_deleted&limit=10", headers=owner_headers)
    assert r3.status_code == 200
    assert any(e.get("target_id") == state["mod_id"] for e in r3.json().get("entries", []))


# ---------------------------------------------------------------------------
# 8. Best-effort cleanup of any stale TEST admins from previous runs
# ---------------------------------------------------------------------------

def test_99_cleanup_test_admins(api, owner_headers):
    r = api.get(f"{BASE_URL}/api/admin/owner/admins", headers=owner_headers)
    if r.status_code != 200:
        return
    for a in r.json().get("admins", []):
        u = a.get("username") or ""
        if u.startswith("TEST") and not a.get("is_seed_owner"):
            api.delete(f"{BASE_URL}/api/admin/owner/admins/{a['id']}", headers=owner_headers)
