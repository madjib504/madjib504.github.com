"""Backend API tests for Cross-border Mall (Côte d'Ivoire).
Covers: health/config, shops, auth OTP, me, quote, cart, orders (create/list/advance).
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


# ---------- Health / config ----------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert "message" in data

    def test_config(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/config")
        assert r.status_code == 200
        d = r.json()
        assert "rates" in d and "EUR" in d["rates"]
        assert d["import_fee_pct"] == 0.15
        assert d["service_fee_pct"] == 0.08
        assert d["local_delivery_xof"] == 3000


# ---------- Shops ----------
class TestShops:
    def test_list_all_shops(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/shops")
        assert r.status_code == 200
        shops = r.json()
        assert isinstance(shops, list)
        assert len(shops) == 24, f"Expected 24 shops, got {len(shops)}"
        # Validate schema
        s = shops[0]
        for key in ("id", "name", "country", "currency", "website", "logo_url", "rating"):
            assert key in s

    @pytest.mark.parametrize("country,expected", [("FR", 8), ("US", 8), ("CN", 8)])
    def test_filter_shops_by_country(self, api_client, country, expected):
        r = api_client.get(f"{BASE_URL}/api/shops?country={country}")
        assert r.status_code == 200
        shops = r.json()
        assert len(shops) == expected
        assert all(s["country"] == country for s in shops)

    def test_get_shop_by_id(self, api_client):
        shops = api_client.get(f"{BASE_URL}/api/shops").json()
        sid = shops[0]["id"]
        r = api_client.get(f"{BASE_URL}/api/shops/{sid}")
        assert r.status_code == 200
        assert r.json()["id"] == sid

    def test_get_shop_not_found(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/shops/does-not-exist")
        assert r.status_code == 404


# ---------- Auth OTP ----------
class TestAuth:
    PHONE = "+2250701234501"

    def test_send_otp_returns_dev_code(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": self.PHONE})
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["dev_code"] == "1234"

    def test_verify_otp_wrong_code(self, api_client):
        api_client.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": self.PHONE})
        r = api_client.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": self.PHONE, "code": "0000"},
        )
        assert r.status_code == 400

    def test_verify_otp_success_returns_token_user(self, api_client):
        api_client.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": self.PHONE})
        r = api_client.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": self.PHONE, "code": "1234"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and len(data["token"]) > 20
        assert data["user"]["phone"] == self.PHONE

    def test_me_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/me")
        assert r.status_code == 401


class TestMe:
    def test_get_me(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/me", headers=auth_headers)
        assert r.status_code == 200
        assert "phone" in r.json()

    def test_patch_me_updates_name_address(self, api_client, auth_headers):
        r = api_client.patch(
            f"{BASE_URL}/api/me",
            json={"name": "TEST_User", "address": "TEST_Cocody"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_User"
        assert r.json()["address"] == "TEST_Cocody"
        # Verify persistence via GET
        r2 = api_client.get(f"{BASE_URL}/api/me", headers=auth_headers)
        assert r2.json()["name"] == "TEST_User"


# ---------- Quote ----------
class TestQuote:
    def test_quote_eur_fr(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/quote",
            json={"original_price": 100, "original_currency": "EUR", "country": "FR", "quantity": 1},
        )
        assert r.status_code == 200
        q = r.json()
        # 100 * 655.957 = 65595.7
        assert abs(q["product_xof"] - 65596) <= 1
        assert q["intl_shipping_xof"] == 12000
        assert q["local_delivery_xof"] == 3000
        # total = 65596 + 15% + 8% + 12000 + 3000
        expected = 65595.7 + 65595.7 * 0.15 + 65595.7 * 0.08 + 12000 + 3000
        assert abs(q["total_xof"] - round(expected)) <= 2

    def test_quote_usd_us(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/quote",
            json={"original_price": 50, "original_currency": "USD", "country": "US"},
        )
        assert r.status_code == 200
        assert r.json()["intl_shipping_xof"] == 15000

    def test_quote_cny_cn(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/quote",
            json={"original_price": 200, "original_currency": "CNY", "country": "CN"},
        )
        assert r.status_code == 200
        assert r.json()["intl_shipping_xof"] == 9000


# ---------- Cart ----------
class TestCart:
    def _get_shop(self, api_client, country="FR"):
        return api_client.get(f"{BASE_URL}/api/shops?country={country}").json()[0]

    def test_cart_flow(self, api_client, auth_headers):
        # Clean state: get and delete all
        cart = api_client.get(f"{BASE_URL}/api/cart", headers=auth_headers).json()
        for it in cart:
            api_client.delete(f"{BASE_URL}/api/cart/{it['id']}", headers=auth_headers)

        shop = self._get_shop(api_client, "FR")
        payload = {
            "shop_id": shop["id"],
            "product_url": "https://www.zara.com/fr/tshirt",
            "product_name": "TEST_T-Shirt",
            "original_price": 29.9,
            "original_currency": "EUR",
            "quantity": 2,
            "size": "M",
        }
        r = api_client.post(f"{BASE_URL}/api/cart", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["product_name"] == "TEST_T-Shirt"
        item_id = item["id"]

        # GET verifies persistence
        cart = api_client.get(f"{BASE_URL}/api/cart", headers=auth_headers).json()
        assert any(c["id"] == item_id for c in cart)

        # Summary
        s = api_client.get(f"{BASE_URL}/api/cart/summary", headers=auth_headers).json()
        assert s["items_count"] >= 1
        assert s["total_xof"] > 0
        assert "breakdown" in s

        # Delete
        r = api_client.delete(f"{BASE_URL}/api/cart/{item_id}", headers=auth_headers)
        assert r.status_code == 200
        cart = api_client.get(f"{BASE_URL}/api/cart", headers=auth_headers).json()
        assert not any(c["id"] == item_id for c in cart)

    def test_cart_add_invalid_shop(self, api_client, auth_headers):
        payload = {
            "shop_id": "does-not-exist",
            "product_url": "x",
            "product_name": "x",
            "original_price": 1,
            "original_currency": "EUR",
        }
        r = api_client.post(f"{BASE_URL}/api/cart", json=payload, headers=auth_headers)
        assert r.status_code == 404


# ---------- Orders ----------
class TestOrders:
    def test_create_order_empty_cart_fails(self, api_client, auth_headers):
        # Ensure empty
        cart = api_client.get(f"{BASE_URL}/api/cart", headers=auth_headers).json()
        for it in cart:
            api_client.delete(f"{BASE_URL}/api/cart/{it['id']}", headers=auth_headers)
        r = api_client.post(
            f"{BASE_URL}/api/orders",
            json={
                "address": {"full_name": "TEST", "phone": "+2250700000000", "city": "Abidjan",
                            "commune": "Cocody", "landmark": "X"},
                "payment_method": "orange",
                "payment_phone": "+2250700000000",
            },
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_full_order_flow_and_advance(self, api_client, auth_headers):
        # Add item
        shop = api_client.get(f"{BASE_URL}/api/shops?country=US").json()[0]
        api_client.post(
            f"{BASE_URL}/api/cart",
            json={
                "shop_id": shop["id"],
                "product_url": "https://amazon.com/product",
                "product_name": "TEST_Product",
                "original_price": 50,
                "original_currency": "USD",
                "quantity": 1,
            },
            headers=auth_headers,
        )
        # Create order
        r = api_client.post(
            f"{BASE_URL}/api/orders",
            json={
                "address": {"full_name": "TEST_User", "phone": "+2250700000000",
                            "city": "Abidjan", "commune": "Cocody", "landmark": "Église"},
                "payment_method": "wave",
                "payment_phone": "+2250700000000",
            },
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "achat"
        assert order["tracking_code"].startswith("CIV-")
        assert order["courier_name"] and order["courier_phone"]
        assert order["total_xof"] > 0
        order_id = order["id"]

        # Cart should be cleared
        cart = api_client.get(f"{BASE_URL}/api/cart", headers=auth_headers).json()
        assert len(cart) == 0

        # GET single
        r = api_client.get(f"{BASE_URL}/api/orders/{order_id}", headers=auth_headers)
        assert r.status_code == 200

        # List
        r = api_client.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        assert r.status_code == 200
        assert any(o["id"] == order_id for o in r.json())

        # Advance through 6 statuses
        expected = ["expedie", "en_transit", "arrive", "livreur_route", "livre", "livre"]
        for exp in expected:
            r = api_client.post(f"{BASE_URL}/api/orders/{order_id}/advance",
                                headers=auth_headers)
            assert r.status_code == 200
            assert r.json()["status"] == exp
