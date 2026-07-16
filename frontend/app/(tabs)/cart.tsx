import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Trash2, ArrowRight, ShoppingBag } from "lucide-react-native";

import { api, CartItem, CURRENCY_SYMBOL, formatXof, Shop } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";
import ShopLogo from "@/src/components/ShopLogo";

export default function CartScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [shops, setShops] = useState<Record<string, Shop>>({});
  const [summary, setSummary] = useState<{
    items_count: number;
    breakdown: Record<string, number>;
    total_xof: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cart, shopList, sum] = await Promise.all([
        api.getCart(),
        api.listShops(),
        api.cartSummary(),
      ]);
      setItems(cart);
      const shopMap: Record<string, Shop> = {};
      shopList.forEach((s) => (shopMap[s.id] = s));
      setShops(shopMap);
      setSummary(sum);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remove = async (id: string) => {
    await api.removeCartItem(id);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Panier</Text>
        <Text style={styles.headerSub}>{items.length} article(s)</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <ShoppingBag size={40} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Panier vide</Text>
          <Text style={styles.emptySub}>
            Ajoutez des produits depuis vos boutiques préférées
          </Text>
          <TouchableOpacity
            testID="cart-browse-button"
            style={styles.primaryBtn}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.primaryBtnText}>Explorer les boutiques</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}
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
          >
            {items.map((it) => {
              const shop = shops[it.shop_id];
              return (
                <View key={it.id} style={styles.itemCard} testID={`cart-item-${it.id}`}>
                  <View style={styles.itemThumb}>
                    {it.image_url ? (
                      <Image source={{ uri: it.image_url }} style={styles.thumbImg} />
                    ) : shop ? (
                      <ShopLogo name={shop.name} uri={shop.logo_url} size={72} radius={12} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemShop}>{shop?.name || "Boutique"}</Text>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {it.product_name}
                    </Text>
                    {it.size ? (
                      <Text style={styles.itemMeta}>
                        Taille: {it.size} · Qté: {it.quantity}
                      </Text>
                    ) : (
                      <Text style={styles.itemMeta}>Qté: {it.quantity}</Text>
                    )}
                    <View style={styles.priceRow}>
                      <Text style={styles.itemPriceOrig}>
                        {it.original_price} {CURRENCY_SYMBOL[it.original_currency]}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    testID={`cart-remove-${it.id}`}
                    onPress={() => remove(it.id)}
                    style={styles.removeBtn}
                  >
                    <Trash2 size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {summary && (
              <View style={styles.summaryCard} testID="cart-summary">
                <Text style={styles.summaryTitle}>Récapitulatif</Text>
                <SummaryRow label="Prix produits" value={summary.breakdown.product} />
                <SummaryRow label="Frais d'importation (15%)" value={summary.breakdown.import} />
                <SummaryRow label="Frais de service (8%)" value={summary.breakdown.service} />
                <SummaryRow label="Expédition internationale" value={summary.breakdown.shipping} />
                <SummaryRow label="Livraison locale" value={summary.breakdown.local} />
                <View style={styles.summaryDivider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total à payer</Text>
                  <Text style={styles.totalValue}>{formatXof(summary.total_xof)}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerTotal}>{formatXof(summary?.total_xof || 0)}</Text>
            </View>
            <TouchableOpacity
              testID="checkout-button"
              style={styles.checkoutBtn}
              onPress={() => router.push("/checkout")}
              activeOpacity={0.85}
            >
              <Text style={styles.checkoutBtnText}>Passer commande</Text>
              <ArrowRight size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue}>{formatXof(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.xl },
  primaryBtn: {
    height: 52,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  itemCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  itemThumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: { width: "100%", height: "100%" },
  itemShop: { fontSize: 11, color: colors.primary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  itemName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginTop: 2 },
  itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  itemPriceOrig: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  removeBtn: { padding: spacing.sm, alignSelf: "flex-start" },
  summaryCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadow.sm,
  },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.md },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  sumLabel: { fontSize: 14, color: colors.textSecondary },
  sumValue: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  totalValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
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
  footerLabel: { fontSize: 12, color: colors.textSecondary },
  footerTotal: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  checkoutBtn: {
    flex: 1,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    maxWidth: 220,
  },
  checkoutBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
