import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, Star, ShoppingCart } from "lucide-react-native";

import { api, COUNTRY_FLAGS, COUNTRY_LABELS, Shop } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

const COUNTRIES: (Shop["country"] | "ALL")[] = ["ALL", "FR", "US", "CN"];

export default function HomeScreen() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [country, setCountry] = useState<Shop["country"] | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const list = await api.listShops();
      setShops(list);
      const cart = await api.getCart().catch(() => []);
      setCartCount(cart.length);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (country === "ALL" ? shops : shops.filter((s) => s.country === country)),
    [shops, country],
  );

  const renderShop = ({ item }: { item: Shop }) => (
    <TouchableOpacity
      testID={`shop-card-${item.name.toLowerCase().replace(/\W/g, "-")}`}
      style={styles.shopCard}
      onPress={() => router.push(`/shop/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.logoWrap}>
        <Image source={{ uri: item.logo_url }} style={styles.logoImg} resizeMode="contain" />
        <View style={styles.flagBadge}>
          <Text style={styles.flagText}>{COUNTRY_FLAGS[item.country]}</Text>
        </View>
      </View>
      <Text style={styles.shopName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.shopCategory} numberOfLines={1}>
        {item.category}
      </Text>
      <View style={styles.ratingRow}>
        <Star size={12} color={colors.warning} fill={colors.warning} />
        <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        <Text style={styles.deliveryText}>
          · {item.delivery_days_min}-{item.delivery_days_max}j
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Sticky header */}
      <View style={styles.header} testID="home-header">
        <View style={{ flex: 1 }}>
          <View style={styles.locationRow}>
            <MapPin size={14} color={colors.primary} />
            <Text style={styles.locationText}>Livraison à Abidjan, CI</Text>
          </View>
          <Text style={styles.brandTitle}>Baraka Mall</Text>
        </View>
        <TouchableOpacity
          testID="header-cart-button"
          style={styles.cartIcon}
          onPress={() => router.push("/(tabs)/cart")}
        >
          <ShoppingCart size={22} color={colors.textPrimary} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          renderItem={renderShop}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ paddingBottom: spacing.xxxl, gap: spacing.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Hero */}
              <View style={styles.hero} testID="hero-banner">
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>Achetez partout,{"\n"}livré chez vous</Text>
                  <Text style={styles.heroSubtitle}>
                    France · USA · Chine → Côte d&apos;Ivoire
                  </Text>
                  <View style={styles.heroBadgeRow}>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>💳 Paiement FCFA</Text>
                    </View>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>🚚 Livraison Abidjan</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Chip row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {COUNTRIES.map((c) => {
                  const active = country === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      testID={`country-chip-${c}`}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCountry(c)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {c === "ALL" ? "🌍 Tous" : `${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionTitle}>
                {filtered.length} boutiques disponibles
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Aucune boutique dans ce pays</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" },
  brandTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  cartIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  hero: {
    margin: spacing.lg,
    backgroundColor: colors.secondary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    minHeight: 160,
    ...shadow.md,
  },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.5, lineHeight: 30 },
  heroSubtitle: { color: "#CBD5E1", fontSize: 14, marginTop: spacing.sm },
  heroBadgeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  heroBadge: { backgroundColor: "rgba(255,107,0,0.15)", borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,107,0,0.4)" },
  heroBadgeText: { color: "#FFD8B8", fontSize: 12, fontWeight: "600" },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  chip: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  sectionTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  shopCard: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  logoWrap: {
    aspectRatio: 1,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    position: "relative",
    overflow: "hidden",
  },
  logoImg: { width: "60%", height: "60%" },
  flagBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: colors.paper,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  flagText: { fontSize: 14 },
  shopName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  shopCategory: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  ratingText: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  deliveryText: { fontSize: 11, color: colors.textTertiary },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { padding: spacing.xxl, alignItems: "center" },
  emptyText: { color: colors.textSecondary },
});
