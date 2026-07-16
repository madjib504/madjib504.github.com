import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowLeft, ExternalLink, Star, Truck } from "lucide-react-native";

import { api, COUNTRY_FLAGS, COUNTRY_LABELS, CURRENCY_SYMBOL, formatXof, Product, Shop } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";
import ShopLogo from "@/src/components/ShopLogo";

const RATE_APPROX: Record<string, number> = { EUR: 656, USD: 610, CNY: 84.5 };

export default function ShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<string>("Tous");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [s, ps] = await Promise.all([api.getShop(id), api.listShopProducts(id)]);
        setShop(s);
        setProducts(ps);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const categories = ["Tous", ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = category === "Tous" ? products : products.filter((p) => p.category === category);

  const openShop = async () => {
    if (!shop) return;
    await WebBrowser.openBrowserAsync(shop.website);
  };

  if (loading || !shop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const renderProduct = ({ item }: { item: Product }) => {
    const approxXof = item.price * (RATE_APPROX[item.currency] || 1);
    return (
      <TouchableOpacity
        testID={`product-card-${item.id}`}
        style={styles.productCard}
        onPress={() => router.push(`/product/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.productImgWrap}>
          {item.images[0] ? (
            <Image source={{ uri: item.images[0] }} style={styles.productImg} />
          ) : null}
        </View>
        <View style={styles.productBody}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.ratingRow}>
            <Star size={11} color={colors.warning} fill={colors.warning} />
            <Text style={styles.ratingText}>
              {item.rating.toFixed(1)} · {item.reviews}
            </Text>
          </View>
          <Text style={styles.productPrice}>
            {item.price.toFixed(2)} {CURRENCY_SYMBOL[item.currency]}
          </Text>
          <Text style={styles.productXof}>≈ {formatXof(approxXof)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {shop.name}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl, gap: spacing.md }}
        ListHeaderComponent={
          <View>
            {/* Shop hero */}
            <View style={styles.hero}>
              <ShopLogo name={shop.name} uri={shop.logo_url} size={96} radius={16} />
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName}>{shop.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaFlag}>{COUNTRY_FLAGS[shop.country]}</Text>
                  <Text style={styles.metaText}>{COUNTRY_LABELS[shop.country]}</Text>
                  <View style={styles.dot} />
                  <Star size={12} color={colors.warning} fill={colors.warning} />
                  <Text style={styles.metaText}>{shop.rating.toFixed(1)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Truck size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {shop.delivery_days_min}-{shop.delivery_days_max} jours
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.description}>{shop.description}</Text>

            <TouchableOpacity
              testID="visit-shop-button"
              style={styles.visitBtn}
              onPress={openShop}
              activeOpacity={0.85}
            >
              <ExternalLink size={18} color={colors.primary} />
              <Text style={styles.visitBtnText}>Voir sur le site officiel</Text>
            </TouchableOpacity>

            {/* Category chips */}
            {categories.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {categories.map((c) => {
                  const active = category === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      testID={`category-chip-${c}`}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCategory(c)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.sectionTitle}>
              {filtered.length} produit(s) disponible(s)
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Aucun produit dans cette catégorie</Text>
          </View>
        }
      />
    </SafeAreaView>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
    textAlign: "center",
    marginHorizontal: spacing.md,
  },
  hero: {
    flexDirection: "row",
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.paper,
    alignItems: "center",
  },
  shopName: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  metaRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 4 },
  metaFlag: { fontSize: 14 },
  metaText: { fontSize: 13, color: colors.textSecondary },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textTertiary, marginHorizontal: 4 },
  description: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  visitBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 48,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  visitBtnText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.md },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  sectionTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  productCard: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadow.sm,
  },
  productImgWrap: {
    aspectRatio: 1,
    backgroundColor: colors.bg,
  },
  productImg: { width: "100%", height: "100%" },
  productBody: { padding: spacing.md },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    minHeight: 34,
  },
  ratingRow: { flexDirection: "row", gap: 4, alignItems: "center", marginTop: 4 },
  ratingText: { fontSize: 11, color: colors.textSecondary },
  productPrice: { fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginTop: 4 },
  productXof: { fontSize: 11, color: colors.primary, fontWeight: "700", marginTop: 2 },
  emptyWrap: { padding: spacing.xxl, alignItems: "center" },
  emptyText: { color: colors.textSecondary },
});
