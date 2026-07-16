"""
Backend tests for iteration 2:
- New products catalog endpoints
- Shop logo URLs still returned
- Regression: auth, cart (with product_id), checkout, order tracking
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
# fallback: read frontend .env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(session):
    phone = f"+22507{uuid.uuid4().int % 100000000:08d}"
    r = session.post(f"{API}/auth/send-otp", json={"phone": phone})
    assert r.status_code == 200
    r = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ---------- Shops (logo fallback data still present) ----------
class TestShops:
    def test_list_shops_returns_logos(self, session):
        r = session.get(f"{API}/shops")
        assert r.status_code == 200
        shops = r.json()
        assert len(shops) >= 24
        # Every shop should have a logo_url (frontend fallback handles broken URLs)
        for s in shops:
            assert s.get("logo_url", "").startswith("http")
            assert s["name"]
            assert s["country"] in ("FR", "US", "CN")


# ---------- Products endpoints ----------
class TestProducts:
    def test_list_products_no_filter(self, session):
        r = session.get(f"{API}/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 100
        p = data[0]
        for k in ("id", "shop_id", "shop_name", "shop_country", "name", "price",
                  "currency", "images", "sizes", "colors", "rating", "reviews"):
            assert k in p, f"missing {k}"

    def test_list_products_country_filter(self, session):
        r = session.get(f"{API}/products", params={"country": "FR"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        assert all(p["shop_country"] == "FR" for p in data)

    def test_list_products_search_query(self, session):
        r = session.get(f"{API}/products", params={"q": "iPhone"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        assert all("iphone" in p["name"].lower() for p in data)

    def test_list_products_invalid_country_returns_all(self, session):
        # invalid country ignored
        r = session.get(f"{API}/products", params={"country": "XX"})
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_get_product_by_id(self, session):
        products = session.get(f"{API}/products").json()
        pid = products[0]["id"]
        r = session.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_get_product_not_found(self, session):
        r = session.get(f"{API}/products/nonexistent-uuid")
        assert r.status_code == 404

    def test_shop_products_counts(self, session):
        shops = session.get(f"{API}/shops").json()
        by_name = {s["name"]: s for s in shops}
        expectations = {"Zara": 8, "Amazon": 8, "SHEIN": 8}
        for name, min_count in expectations.items():
            assert name in by_name, f"Shop {name} not found"
            r = session.get(f"{API}/shops/{by_name[name]['id']}/products")
            assert r.status_code == 200
            prods = r.json()
            assert len(prods) >= min_count, f"{name} has {len(prods)} products, expected >= {min_count}"
            # sanity check first product fields
            assert prods[0]["shop_name"] == name
            assert len(prods[0]["images"]) >= 1


# ---------- Cart with product_id (backwards compatibility) ----------
class TestCartWithProductId:
    def test_add_cart_with_product_id(self, session, auth_headers):
        products = session.get(f"{API}/products", params={"country": "US"}).json()
        prod = products[0]
        payload = {
            "shop_id": prod["shop_id"],
            "product_id": prod["id"],
            "product_name": prod["name"],
            "original_price": prod["price"],
            "original_currency": prod["currency"],
            "size": prod["sizes"][0] if prod["sizes"] else None,
            "color": prod["colors"][0] if prod["colors"] else None,
            "quantity": 1,
            "image_url": prod["images"][0] if prod["images"] else None,
        }
        r = session.post(f"{API}/cart", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["product_id"] == prod["id"]
        # verify persistence
        cart = session.get(f"{API}/cart", headers=auth_headers).json()
        assert any(c["id"] == item["id"] for c in cart)
        # cleanup
        session.delete(f"{API}/cart/{item['id']}", headers=auth_headers)

    def test_add_cart_without_product_id_backwards_compat(self, session, auth_headers):
        shops = session.get(f"{API}/shops").json()
        payload = {
            "shop_id": shops[0]["id"],
            "product_url": "https://example.com/x",
            "product_name": "TEST_manual_item",
            "original_price": 20.0,
            "original_currency": shops[0]["currency"],
            "quantity": 1,
        }
        r = session.post(f"{API}/cart", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        item = r.json()
        assert item.get("product_id") in (None, "")
        session.delete(f"{API}/cart/{item['id']}", headers=auth_headers)


# ---------- Regression: full order flow ----------
class TestOrderFlowRegression:
    def test_full_checkout_and_advance(self, session, auth_headers):
        products = session.get(f"{API}/products", params={"country": "FR"}).json()
        prod = products[0]
        session.post(f"{API}/cart", json={
            "shop_id": prod["shop_id"],
            "product_id": prod["id"],
            "product_name": prod["name"],
            "original_price": prod["price"],
            "original_currency": prod["currency"],
            "quantity": 1,
        }, headers=auth_headers)
        summary = session.get(f"{API}/cart/summary", headers=auth_headers).json()
        assert summary["items_count"] >= 1
        assert summary["total_xof"] > 0

        r = session.post(f"{API}/orders", json={
            "address": {"full_name": "TEST User", "phone": "+2250700000000",
                        "city": "Abidjan", "commune": "Cocody"},
            "payment_method": "wave",
            "payment_phone": "+2250700000000",
        }, headers=auth_headers)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "achat"
        oid = order["id"]

        # Advance twice
        for _ in range(2):
            r = session.post(f"{API}/orders/{oid}/advance", headers=auth_headers)
            assert r.status_code == 200
        r = session.get(f"{API}/orders/{oid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["status"] in ("en_transit", "arrive", "livreur_route", "livre")
