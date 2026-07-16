"""Tests for provider scaffolding (AliExpress + Rakuten) and regression on core endpoints."""
import os
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") \
    else None


# ---------- Providers status ----------
class TestProvidersStatus:
    def test_status_endpoint_returns_200_and_three_keys(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/providers/status", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) == {"aliexpress", "rakuten", "fallback_catalog"}, data

    def test_aliexpress_not_configured_with_signup_url(self, api_client):
        data = api_client.get(f"{BASE_URL}/api/providers/status").json()
        ae = data["aliexpress"]
        assert ae["configured"] is False
        assert ae.get("signup", "").startswith("https://"), ae
        assert "aliexpress" in ae["signup"].lower()

    def test_rakuten_not_configured_with_signup_url(self, api_client):
        data = api_client.get(f"{BASE_URL}/api/providers/status").json()
        rk = data["rakuten"]
        assert rk["configured"] is False
        assert rk.get("signup", "").startswith("https://"), rk
        assert "rakuten" in rk["signup"].lower()

    def test_fallback_catalog_active_with_products(self, api_client):
        data = api_client.get(f"{BASE_URL}/api/providers/status").json()
        fb = data["fallback_catalog"]
        assert fb["active"] is True
        assert isinstance(fb["products_count"], int)
        assert fb["products_count"] > 0


# ---------- Providers search (fallback path) ----------
class TestProvidersSearch:
    def test_search_returns_empty_results_without_error(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/providers/search", params={"q": "iphone"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) == {"aliexpress", "rakuten"}, data
        assert data["aliexpress"] == {"active": False, "results": []}
        assert data["rakuten"] == {"active": False, "results": []}

    def test_search_missing_query_returns_422(self, api_client):
        # q is required (no default), FastAPI returns 422 on missing
        r = api_client.get(f"{BASE_URL}/api/providers/search", timeout=15)
        assert r.status_code == 422


# ---------- Regression on existing endpoints ----------
class TestRegression:
    def test_root_api(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_shops_list(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/shops", timeout=15)
        assert r.status_code == 200
        shops = r.json()
        assert isinstance(shops, list)
        assert len(shops) >= 20  # 24 seeded
        assert all("id" in s and "name" in s and "country" in s for s in shops)

    def test_products_list_seeded(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/products", timeout=15)
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        # Original seed size ~140. Accept >=100 to tolerate small drift.
        assert len(products) >= 100, f"Only {len(products)} products, expected >=100"
        # Ensure no _id leak
        assert all("_id" not in p for p in products)

    def test_config_endpoint(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/config", timeout=15)
        assert r.status_code == 200
        cfg = r.json()
        assert "rates" in cfg and "EUR" in cfg["rates"]

    def test_auth_flow_still_works(self, api_client):
        phone = "+2250799887766"
        r = api_client.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": phone}, timeout=15)
        assert r.status_code == 200
        r = api_client.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": phone, "code": "1234"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and "user" in body

    def test_cart_and_orders_endpoints_accessible(self, api_client, auth_headers):
        # cart list should work (may be empty)
        r = api_client.get(f"{BASE_URL}/api/cart", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        # orders list should work
        r = api_client.get(f"{BASE_URL}/api/orders", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
