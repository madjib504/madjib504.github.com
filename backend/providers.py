"""
Provider integrations for external merchant APIs.
Currently supports: AliExpress Affiliate Open Platform, Rakuten Advertising.

Both providers have `is_configured()` methods. If credentials are missing,
the service is inactive and the app falls back to the local seed catalog.

To activate:
  1. Follow /app/memory/MERCHANT_API_SETUP.md to create publisher accounts
  2. Add the received credentials to /app/backend/.env
  3. Restart the backend — providers auto-activate at startup
"""
import os
from typing import List, Optional
import httpx

from products_data import PRODUCTS_BY_SHOP  # noqa: F401 (kept for reference)


class AliExpressService:
    """AliExpress Affiliate API client (Open Platform + Portals).

    Docs: https://openservice.aliexpress.com/doc/doc.htm
    """
    BASE_URL = "https://api-sg.aliexpress.com/sync"

    def __init__(self):
        self.app_key = os.environ.get("AE_APP_KEY", "")
        self.app_secret = os.environ.get("AE_APP_SECRET", "")
        self.access_token = os.environ.get("AE_ACCESS_TOKEN", "")
        self.affiliate_id = os.environ.get("AE_AFFILIATE_ID", "")

    def is_configured(self) -> bool:
        return bool(self.app_key and self.app_secret and self.access_token)

    async def search_products(self, query: str, page: int = 1) -> List[dict]:
        if not self.is_configured():
            return []
        # Placeholder: implement API call when credentials are provided
        # See MERCHANT_API_SETUP.md for full signature computation
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(self.BASE_URL, params={
                    "method": "aliexpress.affiliate.product.query",
                    "app_key": self.app_key,
                    "access_token": self.access_token,
                    "keywords": query,
                    "page_no": page,
                    "page_size": 20,
                })
                resp.raise_for_status()
                data = resp.json()
                items = data.get("result", {}).get("products", [])
                return items
            except Exception:
                return []


class RakutenService:
    """Rakuten Advertising API client (Product Search + Deep Links).

    Docs: https://developers.rakutenadvertising.com/documentation/en-US/affiliate_apis
    """
    BASE_URL = "https://api.linksynergy.com"
    TOKEN_URL = "https://api.linksynergy.com/token"

    def __init__(self):
        self.client_id = os.environ.get("RAKUTEN_CLIENT_ID", "")
        self.client_secret = os.environ.get("RAKUTEN_CLIENT_SECRET", "")
        self.scope_id = os.environ.get("RAKUTEN_SCOPE_ID", "")
        self._cached_token: Optional[str] = None

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.scope_id)

    async def _get_token(self) -> Optional[str]:
        if not self.is_configured():
            return None
        if self._cached_token:
            return self._cached_token
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(
                    self.TOKEN_URL,
                    data={
                        "grant_type": "client_credentials",
                        "scope": self.scope_id,
                    },
                    auth=(self.client_id, self.client_secret),
                )
                resp.raise_for_status()
                self._cached_token = resp.json().get("access_token")
                return self._cached_token
            except Exception:
                return None

    async def search_products(self, query: str, page: int = 1) -> List[dict]:
        if not self.is_configured():
            return []
        token = await self._get_token()
        if not token:
            return []
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(
                    f"{self.BASE_URL}/productsearch/1.0",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"keyword": query, "pagenumber": page, "max": 20},
                )
                resp.raise_for_status()
                return resp.json().get("result", {}).get("item", [])
            except Exception:
                return []

    async def generate_deep_link(self, url: str) -> str:
        if not self.is_configured():
            return url
        token = await self._get_token()
        if not token:
            return url
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(
                    f"{self.BASE_URL}/v1/links/deep_links",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"url": url},
                )
                resp.raise_for_status()
                return resp.json().get("data", {}).get("deep_link", url)
            except Exception:
                return url


# Singleton instances
aliexpress = AliExpressService()
rakuten = RakutenService()


def providers_status() -> dict:
    return {
        "aliexpress": {
            "configured": aliexpress.is_configured(),
            "docs": "https://openservice.aliexpress.com/doc/doc.htm",
            "signup": "https://portals.aliexpress.com/",
        },
        "rakuten": {
            "configured": rakuten.is_configured(),
            "docs": "https://developers.rakutenadvertising.com/",
            "signup": "https://rakutenadvertising.com/",
        },
        "fallback_catalog": {
            "active": not (aliexpress.is_configured() and rakuten.is_configured()),
            "products_count": sum(len(v) for v in PRODUCTS_BY_SHOP.values()),
        },
    }
