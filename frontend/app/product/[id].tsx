import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Star,
  Minus,
  Plus,
  ShoppingCart,
  CheckCircle2,
  Truck,
} from "lucide-react-native";

import { api, CURRENCY_SYMBOL, formatXof, Product, Quote } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

const { width } = Dimensions.get("window");

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedImg, setSelectedImg] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await api.getProduct(id);
        setProduct(p);
        if (p.sizes.length === 1) setSize(p.sizes[0]);
        if (p.colors.length === 1) setColor(p.colors[0]);
        // Load quote immediately
        const q = await api.quote(p.price, p.currency, p.shop_country, 1);
        setQuote(q);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!product) return;
    (async () => {
      const q = await api.quote(product.price, product.currency, product.shop_country, qty);
      setQuote(q);
    })();
  }, [qty, product]);

  const add = async () => {
    if (!product) return;
    if (product.sizes.length > 0 && !size) return;
    if (product.colors.length > 0 && !color) return;
    setAdding(true);
    try {
      await api.addToCart({
        shop_id: product.shop_id,
        product_id: product.id,
        product_url: "",
        product_name: product.name,
        original_price: product.price,
        original_currency: product.currency,
        size: size,
        color: color,
        quantity: qty,
        image_url: product.images[0] || null,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setAdding(false);
    }
  };

  if (loading || !product) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const requiresSize = product.sizes.length > 0;
  const requiresColor = product.colors.length > 0;
  const canAdd = (!requiresSize || !!size) && (!requiresColor || !!color);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="product-back" style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product.shop_name}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Image carousel */}
        <View style={styles.gallery}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setSelectedImg(idx);
            }}
          >
            {product.images.map((img, i) => (
              <Image
                key={i}
                source={{ uri: img }}
                style={{ width, height: width, backgroundColor: colors.bg }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {product.images.length > 1 && (
            <View style={styles.dots}>
              {product.images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === selectedImg && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoBlock}>
          <Text style={styles.shopLabel}>{product.shop_name} · {product.category}</Text>
          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.ratingRow}>
            <Star size={14} color={colors.warning} fill={colors.warning} />
            <Text style={styles.ratingText}>
              {product.rating.toFixed(1)} · {product.reviews} avis
            </Text>
          </View>

          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabelSmall}>Prix boutique</Text>
              <Text style={styles.priceOrig}>
                {product.price.toFixed(2)} {CURRENCY_SYMBOL[product.currency]}
              </Text>
            </View>
            {quote && (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.priceLabelSmall}>Total livré Abidjan</Text>
                <Text style={styles.priceXof}>{formatXof(quote.total_xof)}</Text>
              </View>
            )}
          </View>

          {quote && (
            <View style={styles.breakdown}>
              <BreakRow label="Prix produit" value={formatXof(quote.product_xof)} />
              <BreakRow label="Importation (15%)" value={formatXof(quote.import_fee_xof)} />
              <BreakRow label="Service (8%)" value={formatXof(quote.service_fee_xof)} />
              <BreakRow label="Expédition int'l" value={formatXof(quote.intl_shipping_xof)} />
              <BreakRow label="Livraison Abidjan" value={formatXof(quote.local_delivery_xof)} />
            </View>
          )}

          <Text style={styles.description}>{product.description}</Text>

          {/* Sizes */}
          {requiresSize && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Taille {size ? <Text style={styles.selectedInline}>· {size}</Text> : null}
              </Text>
              <View style={styles.optionsRow}>
                {product.sizes.map((s) => {
                  const active = size === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      testID={`size-${s}`}
                      style={[styles.sizeChip, active && styles.chipActive]}
                      onPress={() => setSize(s)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Colors */}
          {requiresColor && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Coloris {color ? <Text style={styles.selectedInline}>· {color}</Text> : null}
              </Text>
              <View style={styles.optionsRow}>
                {product.colors.map((c) => {
                  const active = color === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      testID={`color-${c}`}
                      style={[styles.colorChip, active && styles.chipActive]}
                      onPress={() => setColor(c)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantité</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                testID="qty-minus"
                style={styles.qtyBtn}
                onPress={() => setQty(Math.max(1, qty - 1))}
              >
                <Minus size={16} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qty}</Text>
              <TouchableOpacity
                testID="qty-plus"
                style={styles.qtyBtn}
                onPress={() => setQty(qty + 1)}
              >
                <Plus size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.deliveryInfo}>
            <Truck size={16} color={colors.primary} />
            <Text style={styles.deliveryText}>
              Livraison estimée 10-25 jours à Abidjan. Le livreur vous appelle à l&apos;arrivée.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total ({qty})</Text>
          <Text style={styles.footerTotal}>
            {quote ? formatXof(quote.total_xof) : "—"}
          </Text>
        </View>
        <TouchableOpacity
          testID="add-to-cart-button"
          style={[styles.addBtn, (!canAdd || adding) && { opacity: 0.5 }]}
          onPress={add}
          disabled={!canAdd || adding}
          activeOpacity={0.85}
        >
          {adding ? (
            <ActivityIndicator color="#fff" />
          ) : added ? (
            <>
              <CheckCircle2 size={20} color="#fff" />
              <Text style={styles.addBtnText}>Ajouté au panier</Text>
            </>
          ) : (
            <>
              <ShoppingCart size={20} color="#fff" />
              <Text style={styles.addBtnText}>
                {canAdd ? "Ajouter au panier" : "Sélectionnez les options"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function BreakRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.breakRow}>
      <Text style={styles.breakLabel}>{label}</Text>
      <Text style={styles.breakValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    ...shadow.sm,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, flex: 1, textAlign: "center" },
  gallery: { position: "relative" },
  dots: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff", width: 24 },
  infoBlock: { padding: spacing.lg },
  shopLabel: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  name: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, marginTop: 4, lineHeight: 28 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  ratingText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  priceCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...shadow.sm,
  },
  priceLabelSmall: { fontSize: 11, color: colors.textSecondary, fontWeight: "600", textTransform: "uppercase" },
  priceOrig: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  priceXof: { fontSize: 20, fontWeight: "800", color: colors.primary, marginTop: 2 },
  breakdown: {
    backgroundColor: colors.paper,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  breakRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  breakLabel: { fontSize: 12, color: colors.textSecondary },
  breakValue: { fontSize: 12, color: colors.textPrimary, fontWeight: "600" },
  description: {
    marginTop: spacing.lg,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  section: { marginTop: spacing.xl },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.sm },
  selectedInline: { color: colors.primary, fontWeight: "700" },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sizeChip: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  colorChip: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  qtyRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, minWidth: 32, textAlign: "center" },
  deliveryInfo: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  deliveryText: { flex: 1, fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paper,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    ...shadow.md,
  },
  footerLabel: { fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", fontWeight: "600" },
  footerTotal: { fontSize: 18, fontWeight: "800", color: colors.primary },
  addBtn: {
    flex: 1,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    maxWidth: 240,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
