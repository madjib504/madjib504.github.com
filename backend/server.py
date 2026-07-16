from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone
import random
import string

from products_data import PRODUCTS_BY_SHOP
from providers import providers_status, aliexpress, rakuten


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Config ----------
EXCHANGE_RATES = {  # 1 unit of currency -> XOF
    "EUR": 655.957,
    "USD": 610.0,
    "CNY": 84.5,
    "XOF": 1.0,
}
IMPORT_FEE_PCT = 0.15   # 15% import/customs
SERVICE_FEE_PCT = 0.08  # 8% service
LOCAL_DELIVERY_FCFA = 3000
INTL_SHIPPING_FCFA = {  # per order shipping cost by origin
    "FR": 12000,
    "US": 15000,
    "CN": 9000,
}

MOCK_OTP_CODE = "1234"  # any user gets this code

# ---------- Models ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SendOtpIn(BaseModel):
    phone: str


class SendOtpOut(BaseModel):
    ok: bool
    dev_code: str  # returned only for demo


class VerifyOtpIn(BaseModel):
    phone: str
    code: str


class UserOut(BaseModel):
    id: str
    phone: str
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Abidjan"


class VerifyOtpOut(BaseModel):
    token: str
    user: UserOut


class Shop(BaseModel):
    id: str
    name: str
    country: Literal["FR", "US", "CN"]
    category: str
    logo_url: str
    website: str
    description: str
    currency: Literal["EUR", "USD", "CNY"]
    rating: float
    delivery_days_min: int
    delivery_days_max: int


class Product(BaseModel):
    id: str
    shop_id: str
    shop_name: str
    shop_country: Literal["FR", "US", "CN"]
    name: str
    description: str
    category: str
    price: float
    currency: Literal["EUR", "USD", "CNY"]
    images: List[str]
    sizes: List[str] = []
    colors: List[str] = []
    rating: float = 4.5
    reviews: int = 0


class CartItemIn(BaseModel):
    shop_id: str
    product_id: Optional[str] = None
    product_url: Optional[str] = ""
    product_name: str
    original_price: float
    original_currency: Literal["EUR", "USD", "CNY"]
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int = 1
    image_url: Optional[str] = None
    notes: Optional[str] = None


class CartItem(CartItemIn):
    id: str
    user_id: str
    created_at: str


class QuoteIn(BaseModel):
    original_price: float
    original_currency: Literal["EUR", "USD", "CNY"]
    country: Literal["FR", "US", "CN"]
    quantity: int = 1


class QuoteOut(BaseModel):
    product_xof: float
    import_fee_xof: float
    service_fee_xof: float
    intl_shipping_xof: float
    local_delivery_xof: float
    total_xof: float
    rate: float


class Address(BaseModel):
    full_name: str
    phone: str
    city: str = "Abidjan"
    commune: str
    landmark: Optional[str] = None


class CheckoutIn(BaseModel):
    address: Address
    payment_method: Literal["orange", "mtn", "moov", "wave"]
    payment_phone: str


class OrderItemView(CartItem):
    pass


ORDER_STATUSES = [
    "achat",           # Achat en cours (agent acheteur)
    "expedie",         # Expédié depuis l'origine
    "en_transit",      # En transit vers Abidjan
    "arrive",          # Arrivé à Abidjan
    "livreur_route",   # Livreur en route
    "livre",           # Livré
]


class Order(BaseModel):
    id: str
    user_id: str
    items: List[dict]
    total_xof: float
    address: Address
    payment_method: str
    payment_phone: str
    status: str
    courier_name: Optional[str] = None
    courier_phone: Optional[str] = None
    created_at: str
    updated_at: str
    tracking_code: str


# ---------- Auth helpers ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.replace("Bearer ", "").strip()
    user = await db.users.find_one({"token": token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


# ---------- Seed shops ----------
SEED_SHOPS: List[dict] = [
    # FRANCE
    {"name": "Zara", "country": "FR", "category": "Mode", "website": "https://www.zara.com/fr",
     "logo_url": "https://logo.clearbit.com/zara.com", "description": "Mode tendance espagnole, disponible en France.",
     "currency": "EUR", "rating": 4.6, "delivery_days_min": 10, "delivery_days_max": 18},
    {"name": "Fnac", "country": "FR", "category": "Tech & Culture", "website": "https://www.fnac.com",
     "logo_url": "https://logo.clearbit.com/fnac.com", "description": "Électronique, livres et culture depuis la France.",
     "currency": "EUR", "rating": 4.4, "delivery_days_min": 12, "delivery_days_max": 20},
    {"name": "Zalando", "country": "FR", "category": "Mode", "website": "https://www.zalando.fr",
     "logo_url": "https://logo.clearbit.com/zalando.fr", "description": "La plus grande sélection de mode en ligne.",
     "currency": "EUR", "rating": 4.5, "delivery_days_min": 10, "delivery_days_max": 18},
    {"name": "H&M", "country": "FR", "category": "Mode", "website": "https://www2.hm.com/fr_fr",
     "logo_url": "https://logo.clearbit.com/hm.com", "description": "Mode accessible pour toute la famille.",
     "currency": "EUR", "rating": 4.3, "delivery_days_min": 10, "delivery_days_max": 18},
    {"name": "Sephora", "country": "FR", "category": "Beauté", "website": "https://www.sephora.fr",
     "logo_url": "https://logo.clearbit.com/sephora.fr", "description": "Cosmétiques et parfums premium.",
     "currency": "EUR", "rating": 4.7, "delivery_days_min": 10, "delivery_days_max": 18},
    {"name": "Decathlon", "country": "FR", "category": "Sport", "website": "https://www.decathlon.fr",
     "logo_url": "https://logo.clearbit.com/decathlon.fr", "description": "Équipement sportif à prix imbattable.",
     "currency": "EUR", "rating": 4.6, "delivery_days_min": 12, "delivery_days_max": 20},
    {"name": "Cdiscount", "country": "FR", "category": "Général", "website": "https://www.cdiscount.com",
     "logo_url": "https://logo.clearbit.com/cdiscount.com", "description": "Tout à petits prix, made in France.",
     "currency": "EUR", "rating": 4.1, "delivery_days_min": 12, "delivery_days_max": 20},
    {"name": "La Redoute", "country": "FR", "category": "Maison & Mode", "website": "https://www.laredoute.fr",
     "logo_url": "https://logo.clearbit.com/laredoute.fr", "description": "Maison et mode française chic.",
     "currency": "EUR", "rating": 4.3, "delivery_days_min": 12, "delivery_days_max": 20},

    # USA
    {"name": "Amazon", "country": "US", "category": "Général", "website": "https://www.amazon.com",
     "logo_url": "https://logo.clearbit.com/amazon.com", "description": "Le plus grand marketplace du monde.",
     "currency": "USD", "rating": 4.7, "delivery_days_min": 12, "delivery_days_max": 22},
    {"name": "Nike", "country": "US", "category": "Sport", "website": "https://www.nike.com",
     "logo_url": "https://logo.clearbit.com/nike.com", "description": "Chaussures et vêtements de sport.",
     "currency": "USD", "rating": 4.7, "delivery_days_min": 15, "delivery_days_max": 25},
    {"name": "Apple", "country": "US", "category": "Tech", "website": "https://www.apple.com",
     "logo_url": "https://logo.clearbit.com/apple.com", "description": "iPhone, MacBook, iPad & accessoires.",
     "currency": "USD", "rating": 4.9, "delivery_days_min": 15, "delivery_days_max": 25},
    {"name": "Best Buy", "country": "US", "category": "Tech", "website": "https://www.bestbuy.com",
     "logo_url": "https://logo.clearbit.com/bestbuy.com", "description": "Électronique et high-tech américain.",
     "currency": "USD", "rating": 4.4, "delivery_days_min": 15, "delivery_days_max": 25},
    {"name": "Walmart", "country": "US", "category": "Général", "website": "https://www.walmart.com",
     "logo_url": "https://logo.clearbit.com/walmart.com", "description": "Tout pour la maison et la famille.",
     "currency": "USD", "rating": 4.3, "delivery_days_min": 15, "delivery_days_max": 25},
    {"name": "Target", "country": "US", "category": "Général", "website": "https://www.target.com",
     "logo_url": "https://logo.clearbit.com/target.com", "description": "Style, maison, et tendances USA.",
     "currency": "USD", "rating": 4.4, "delivery_days_min": 15, "delivery_days_max": 25},
    {"name": "eBay", "country": "US", "category": "Marketplace", "website": "https://www.ebay.com",
     "logo_url": "https://logo.clearbit.com/ebay.com", "description": "Marketplace mondiale, enchères & achat direct.",
     "currency": "USD", "rating": 4.2, "delivery_days_min": 18, "delivery_days_max": 30},
    {"name": "Macy's", "country": "US", "category": "Mode", "website": "https://www.macys.com",
     "logo_url": "https://logo.clearbit.com/macys.com", "description": "Grand magasin de mode et beauté.",
     "currency": "USD", "rating": 4.3, "delivery_days_min": 18, "delivery_days_max": 28},

    # CHINE
    {"name": "SHEIN", "country": "CN", "category": "Mode", "website": "https://www.shein.com",
     "logo_url": "https://logo.clearbit.com/shein.com", "description": "Mode ultra-tendance à prix cassés.",
     "currency": "CNY", "rating": 4.5, "delivery_days_min": 10, "delivery_days_max": 20},
    {"name": "AliExpress", "country": "CN", "category": "Général", "website": "https://www.aliexpress.com",
     "logo_url": "https://logo.clearbit.com/aliexpress.com", "description": "Le marketplace chinois n°1.",
     "currency": "CNY", "rating": 4.4, "delivery_days_min": 12, "delivery_days_max": 25},
    {"name": "Temu", "country": "CN", "category": "Général", "website": "https://www.temu.com",
     "logo_url": "https://logo.clearbit.com/temu.com", "description": "Tout, moins cher, direct de Chine.",
     "currency": "CNY", "rating": 4.3, "delivery_days_min": 12, "delivery_days_max": 25},
    {"name": "Taobao", "country": "CN", "category": "Marketplace", "website": "https://world.taobao.com",
     "logo_url": "https://logo.clearbit.com/taobao.com", "description": "Marketplace domestique chinois.",
     "currency": "CNY", "rating": 4.4, "delivery_days_min": 15, "delivery_days_max": 30},
    {"name": "JD.com", "country": "CN", "category": "Tech", "website": "https://www.jd.com",
     "logo_url": "https://logo.clearbit.com/jd.com", "description": "Électronique et high-tech chinois.",
     "currency": "CNY", "rating": 4.5, "delivery_days_min": 15, "delivery_days_max": 25},
    {"name": "DHgate", "country": "CN", "category": "Grossiste", "website": "https://www.dhgate.com",
     "logo_url": "https://logo.clearbit.com/dhgate.com", "description": "Prix grossiste pour tous.",
     "currency": "CNY", "rating": 4.2, "delivery_days_min": 15, "delivery_days_max": 25},
    {"name": "Banggood", "country": "CN", "category": "Tech & Gadgets", "website": "https://www.banggood.com",
     "logo_url": "https://logo.clearbit.com/banggood.com", "description": "Gadgets et électronique en gros.",
     "currency": "CNY", "rating": 4.2, "delivery_days_min": 15, "delivery_days_max": 25},
    {"name": "Miniso", "country": "CN", "category": "Lifestyle", "website": "https://www.miniso.com",
     "logo_url": "https://logo.clearbit.com/miniso.com", "description": "Lifestyle abordable, design japonais.",
     "currency": "CNY", "rating": 4.4, "delivery_days_min": 15, "delivery_days_max": 25},
]


async def seed_shops():
    count = await db.shops.count_documents({})
    if count > 0:
        return
    docs = []
    for s in SEED_SHOPS:
        doc = {**s, "id": str(uuid.uuid4())}
        docs.append(doc)
    if docs:
        await db.shops.insert_many(docs)


async def seed_products():
    count = await db.products.count_documents({})
    if count > 0:
        return
    shops = await db.shops.find({}, {"_id": 0}).to_list(500)
    shop_by_name = {s["name"]: s for s in shops}
    docs = []
    for shop_name, prods in PRODUCTS_BY_SHOP.items():
        shop = shop_by_name.get(shop_name)
        if not shop:
            continue
        for p in prods:
            docs.append({
                "id": str(uuid.uuid4()),
                "shop_id": shop["id"],
                "shop_name": shop["name"],
                "shop_country": shop["country"],
                "name": p["name"],
                "description": p.get("description", ""),
                "category": p.get("category", "Autre"),
                "price": float(p["price"]),
                "currency": shop["currency"],
                "images": p.get("images", []),
                "sizes": p.get("sizes", []),
                "colors": p.get("colors", []),
                "rating": float(p.get("rating", 4.5)),
                "reviews": int(p.get("reviews", 0)),
            })
    if docs:
        await db.products.insert_many(docs)


# ---------- Helpers ----------
def compute_quote(original_price: float, currency: str, country: str, qty: int = 1) -> QuoteOut:
    rate = EXCHANGE_RATES[currency]
    product_xof = original_price * qty * rate
    import_fee_xof = product_xof * IMPORT_FEE_PCT
    service_fee_xof = product_xof * SERVICE_FEE_PCT
    intl_shipping_xof = INTL_SHIPPING_FCFA[country]
    local_delivery_xof = LOCAL_DELIVERY_FCFA
    total = product_xof + import_fee_xof + service_fee_xof + intl_shipping_xof + local_delivery_xof
    return QuoteOut(
        product_xof=round(product_xof, 0),
        import_fee_xof=round(import_fee_xof, 0),
        service_fee_xof=round(service_fee_xof, 0),
        intl_shipping_xof=round(intl_shipping_xof, 0),
        local_delivery_xof=round(local_delivery_xof, 0),
        total_xof=round(total, 0),
        rate=rate,
    )


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Cross-border shopping API for Côte d'Ivoire", "version": "1.0.0"}


@api_router.get("/config")
async def get_config():
    return {
        "rates": EXCHANGE_RATES,
        "import_fee_pct": IMPORT_FEE_PCT,
        "service_fee_pct": SERVICE_FEE_PCT,
        "local_delivery_xof": LOCAL_DELIVERY_FCFA,
        "intl_shipping_xof": INTL_SHIPPING_FCFA,
    }


@api_router.get("/providers/status")
async def get_providers_status():
    """Report which external merchant API integrations are active."""
    return providers_status()


@api_router.get("/providers/search")
async def providers_search(q: str):
    """Live product search across configured providers (falls back to empty list)."""
    ae_results = await aliexpress.search_products(q)
    rk_results = await rakuten.search_products(q)
    return {
        "aliexpress": {"active": aliexpress.is_configured(), "results": ae_results},
        "rakuten": {"active": rakuten.is_configured(), "results": rk_results},
    }


@api_router.post("/auth/send-otp", response_model=SendOtpOut)
async def send_otp(payload: SendOtpIn):
    # Store latest OTP for phone (mock)
    await db.otps.update_one(
        {"phone": payload.phone},
        {"$set": {"phone": payload.phone, "code": MOCK_OTP_CODE, "created_at": now_iso()}},
        upsert=True,
    )
    logger.info(f"[MOCK OTP] Phone={payload.phone} Code={MOCK_OTP_CODE}")
    return SendOtpOut(ok=True, dev_code=MOCK_OTP_CODE)


@api_router.post("/auth/verify-otp", response_model=VerifyOtpOut)
async def verify_otp(payload: VerifyOtpIn):
    otp = await db.otps.find_one({"phone": payload.phone}, {"_id": 0})
    if not otp or otp.get("code") != payload.code:
        raise HTTPException(status_code=400, detail="Code OTP invalide")
    user = await db.users.find_one({"phone": payload.phone}, {"_id": 0})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "phone": payload.phone,
            "name": None,
            "address": None,
            "city": "Abidjan",
            "token": str(uuid.uuid4()) + str(uuid.uuid4()),
            "created_at": now_iso(),
        }
        await db.users.insert_one(user.copy())
    else:
        # rotate token on each login
        new_token = str(uuid.uuid4()) + str(uuid.uuid4())
        await db.users.update_one({"phone": payload.phone}, {"$set": {"token": new_token}})
        user["token"] = new_token
    return VerifyOtpOut(
        token=user["token"],
        user=UserOut(
            id=user["id"], phone=user["phone"], name=user.get("name"),
            address=user.get("address"), city=user.get("city", "Abidjan"),
        ),
    )


@api_router.get("/me", response_model=UserOut)
async def get_me(user=Depends(get_current_user)):
    return UserOut(
        id=user["id"], phone=user["phone"], name=user.get("name"),
        address=user.get("address"), city=user.get("city", "Abidjan"),
    )


class UpdateUserIn(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None


@api_router.patch("/me", response_model=UserOut)
async def update_me(payload: UpdateUserIn, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return UserOut(
        id=updated["id"], phone=updated["phone"], name=updated.get("name"),
        address=updated.get("address"), city=updated.get("city", "Abidjan"),
    )


@api_router.get("/shops", response_model=List[Shop])
async def list_shops(country: Optional[str] = None):
    q: dict = {}
    if country and country in ("FR", "US", "CN"):
        q["country"] = country
    docs = await db.shops.find(q, {"_id": 0}).to_list(500)
    return [Shop(**d) for d in docs]


@api_router.get("/shops/{shop_id}", response_model=Shop)
async def get_shop(shop_id: str):
    doc = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return Shop(**doc)


@api_router.get("/shops/{shop_id}/products", response_model=List[Product])
async def list_shop_products(shop_id: str):
    docs = await db.products.find({"shop_id": shop_id}, {"_id": 0}).to_list(500)
    return [Product(**d) for d in docs]


@api_router.get("/products", response_model=List[Product])
async def list_products(
    country: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 200,
):
    query: dict = {}
    if country and country in ("FR", "US", "CN"):
        query["shop_country"] = country
    if category:
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.products.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return [Product(**d) for d in docs]


@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return Product(**doc)


@api_router.post("/quote", response_model=QuoteOut)
async def quote(payload: QuoteIn):
    return compute_quote(payload.original_price, payload.original_currency, payload.country, payload.quantity)


# ---------- Cart ----------
@api_router.get("/cart", response_model=List[CartItem])
async def get_cart(user=Depends(get_current_user)):
    docs = await db.cart_items.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    return [CartItem(**d) for d in docs]


@api_router.post("/cart", response_model=CartItem)
async def add_to_cart(payload: CartItemIn, user=Depends(get_current_user)):
    # Validate shop exists
    shop = await db.shops.find_one({"id": payload.shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    item = {
        **payload.dict(),
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "created_at": now_iso(),
    }
    await db.cart_items.insert_one(item.copy())
    item.pop("_id", None)
    return CartItem(**item)


@api_router.delete("/cart/{item_id}")
async def remove_from_cart(item_id: str, user=Depends(get_current_user)):
    result = await db.cart_items.delete_one({"id": item_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article introuvable")
    return {"ok": True}


@api_router.get("/cart/summary")
async def cart_summary(user=Depends(get_current_user)):
    items = await db.cart_items.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    total = 0.0
    breakdown = {"product": 0.0, "import": 0.0, "service": 0.0, "shipping": 0.0, "local": 0.0}
    shipping_countries = set()
    for it in items:
        shop = await db.shops.find_one({"id": it["shop_id"]}, {"_id": 0})
        if not shop:
            continue
        q = compute_quote(it["original_price"], it["original_currency"], shop["country"], it.get("quantity", 1))
        breakdown["product"] += q.product_xof
        breakdown["import"] += q.import_fee_xof
        breakdown["service"] += q.service_fee_xof
        # Only charge intl shipping once per country
        if shop["country"] not in shipping_countries:
            breakdown["shipping"] += q.intl_shipping_xof
            shipping_countries.add(shop["country"])
        total = breakdown["product"] + breakdown["import"] + breakdown["service"] + breakdown["shipping"]
    breakdown["local"] = LOCAL_DELIVERY_FCFA if items else 0
    total += breakdown["local"]
    return {
        "items_count": len(items),
        "breakdown": {k: round(v, 0) for k, v in breakdown.items()},
        "total_xof": round(total, 0),
    }


# ---------- Orders ----------
COURIER_POOL = [
    {"name": "Kouassi Yao", "phone": "+2250709112233"},
    {"name": "Aïcha Diarra", "phone": "+2250506334455"},
    {"name": "Moussa Traoré", "phone": "+2250708998877"},
]


@api_router.post("/orders", response_model=Order)
async def create_order(payload: CheckoutIn, user=Depends(get_current_user)):
    items = await db.cart_items.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    if not items:
        raise HTTPException(status_code=400, detail="Panier vide")
    summary = await cart_summary(user)
    courier = random.choice(COURIER_POOL)
    tracking = "CIV-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    now = now_iso()
    order = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "items": items,
        "total_xof": summary["total_xof"],
        "address": payload.address.dict(),
        "payment_method": payload.payment_method,
        "payment_phone": payload.payment_phone,
        "status": "achat",
        "courier_name": courier["name"],
        "courier_phone": courier["phone"],
        "created_at": now,
        "updated_at": now,
        "tracking_code": tracking,
    }
    await db.orders.insert_one(order.copy())
    # Clear cart
    await db.cart_items.delete_many({"user_id": user["id"]})
    order.pop("_id", None)
    return Order(**order)


@api_router.get("/orders", response_model=List[Order])
async def list_orders(user=Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Order(**d) for d in docs]


@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, user=Depends(get_current_user)):
    doc = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return Order(**doc)


@api_router.post("/orders/{order_id}/advance", response_model=Order)
async def advance_order(order_id: str, user=Depends(get_current_user)):
    """Demo endpoint: move order to next status."""
    doc = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    try:
        idx = ORDER_STATUSES.index(doc["status"])
    except ValueError:
        idx = 0
    next_idx = min(idx + 1, len(ORDER_STATUSES) - 1)
    new_status = ORDER_STATUSES[next_idx]
    await db.orders.update_one(
        {"id": order_id, "user_id": user["id"]},
        {"$set": {"status": new_status, "updated_at": now_iso()}},
    )
    updated = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    return Order(**updated)


# ---------- App wiring ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await seed_shops()
    await seed_products()
    logger.info("Shops and products seeded.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
