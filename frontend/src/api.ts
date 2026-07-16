import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "civ_mall_token";

export type Shop = {
  id: string;
  name: string;
  country: "FR" | "US" | "CN";
  category: string;
  logo_url: string;
  website: string;
  description: string;
  currency: "EUR" | "USD" | "CNY";
  rating: number;
  delivery_days_min: number;
  delivery_days_max: number;
};

export type Product = {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_country: "FR" | "US" | "CN";
  name: string;
  description: string;
  category: string;
  price: number;
  currency: "EUR" | "USD" | "CNY";
  images: string[];
  sizes: string[];
  colors: string[];
  rating: number;
  reviews: number;
};

export type User = {
  id: string;
  phone: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
};

export type CartItem = {
  id: string;
  user_id: string;
  shop_id: string;
  product_url: string;
  product_name: string;
  original_price: number;
  original_currency: "EUR" | "USD" | "CNY";
  size?: string | null;
  color?: string | null;
  quantity: number;
  image_url?: string | null;
  notes?: string | null;
  created_at: string;
};

export type Quote = {
  product_xof: number;
  import_fee_xof: number;
  service_fee_xof: number;
  intl_shipping_xof: number;
  local_delivery_xof: number;
  total_xof: number;
  rate: number;
};

export type Address = {
  full_name: string;
  phone: string;
  city: string;
  commune: string;
  landmark?: string;
};

export type Order = {
  id: string;
  user_id: string;
  items: CartItem[];
  total_xof: number;
  address: Address;
  payment_method: string;
  payment_phone: string;
  status: string;
  courier_name?: string;
  courier_phone?: string;
  created_at: string;
  updated_at: string;
  tracking_code: string;
};

async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  sendOtp: (phone: string) =>
    request<{ ok: boolean; dev_code: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone: string, code: string) =>
    request<{ token: string; user: User }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  me: () => request<User>("/me", {}, true),
  updateMe: (name?: string, address?: string) =>
    request<User>("/me", { method: "PATCH", body: JSON.stringify({ name, address }) }, true),
  listShops: (country?: string) =>
    request<Shop[]>(`/shops${country ? `?country=${country}` : ""}`),
  getShop: (id: string) => request<Shop>(`/shops/${id}`),
  listShopProducts: (shopId: string) =>
    request<Product[]>(`/shops/${shopId}/products`),
  listProducts: (params: { country?: string; category?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.country) qs.set("country", params.country);
    if (params.category) qs.set("category", params.category);
    if (params.q) qs.set("q", params.q);
    const s = qs.toString();
    return request<Product[]>(`/products${s ? `?${s}` : ""}`);
  },
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  quote: (original_price: number, original_currency: string, country: string, quantity = 1) =>
    request<Quote>("/quote", {
      method: "POST",
      body: JSON.stringify({ original_price, original_currency, country, quantity }),
    }),
  getCart: () => request<CartItem[]>("/cart", {}, true),
  addToCart: (item: {
    shop_id: string;
    product_id?: string | null;
    product_url?: string;
    product_name: string;
    original_price: number;
    original_currency: string;
    size?: string | null;
    color?: string | null;
    quantity?: number;
    image_url?: string | null;
    notes?: string | null;
  }) => request<CartItem>("/cart", { method: "POST", body: JSON.stringify(item) }, true),
  removeCartItem: (id: string) => request<{ ok: boolean }>(`/cart/${id}`, { method: "DELETE" }, true),
  cartSummary: () =>
    request<{ items_count: number; breakdown: Record<string, number>; total_xof: number }>(
      "/cart/summary",
      {},
      true,
    ),
  createOrder: (address: Address, payment_method: string, payment_phone: string) =>
    request<Order>(
      "/orders",
      { method: "POST", body: JSON.stringify({ address, payment_method, payment_phone }) },
      true,
    ),
  listOrders: () => request<Order[]>("/orders", {}, true),
  getOrder: (id: string) => request<Order>(`/orders/${id}`, {}, true),
  advanceOrder: (id: string) =>
    request<Order>(`/orders/${id}/advance`, { method: "POST" }, true),
};

export function formatXof(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " FCFA";
}

export const COUNTRY_LABELS: Record<string, string> = {
  FR: "France",
  US: "USA",
  CN: "Chine",
};

export const COUNTRY_FLAGS: Record<string, string> = {
  FR: "🇫🇷",
  US: "🇺🇸",
  CN: "🇨🇳",
};

export const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: "€",
  USD: "$",
  CNY: "¥",
};

export const STATUS_LABELS: Record<string, string> = {
  achat: "Achat en cours",
  expedie: "Expédié",
  en_transit: "En transit",
  arrive: "Arrivé à Abidjan",
  livreur_route: "Livreur en route",
  livre: "Livré",
};

export const STATUS_ORDER = [
  "achat",
  "expedie",
  "en_transit",
  "arrive",
  "livreur_route",
  "livre",
];
