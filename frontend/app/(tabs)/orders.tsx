import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Package, ChevronRight, Phone } from "lucide-react-native";

import { api, formatXof, Order, STATUS_LABELS } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  achat: { bg: "#FEF3C7", fg: "#B45309" },
  expedie: { bg: "#DBEAFE", fg: "#1D4ED8" },
  en_transit: { bg: "#E0E7FF", fg: "#4338CA" },
  arrive: { bg: "#DCFCE7", fg: "#166534" },
  livreur_route: { bg: "#FFE4E6", fg: "#BE123C" },
  livre: { bg: "#D1FAE5", fg: "#065F46" },
};

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listOrders();
      setOrders(list);
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
        <Text style={styles.headerTitle}>Mes Commandes</Text>
        <Text style={styles.headerSub}>{orders.length} commande(s)</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Package size={40} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Aucune commande</Text>
          <Text style={styles.emptySub}>
            Vos commandes apparaîtront ici avec le suivi en temps réel
          </Text>
          <TouchableOpacity
            testID="orders-browse-button"
            style={styles.primaryBtn}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.primaryBtnText}>Découvrir les boutiques</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
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
          {orders.map((o) => {
            const c = STATUS_COLORS[o.status] || STATUS_COLORS.achat;
            const isCourier = o.status === "livreur_route";
            return (
              <TouchableOpacity
                key={o.id}
                testID={`order-card-${o.id}`}
                style={styles.orderCard}
                onPress={() => router.push(`/order/${o.id}`)}
                activeOpacity={0.85}
              >
                <View style={styles.orderTop}>
                  <View>
                    <Text style={styles.tracking}>{o.tracking_code}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(o.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: c.bg }]}>
                    <Text style={[styles.statusText, { color: c.fg }]}>
                      {STATUS_LABELS[o.status]}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderMid}>
                  <Text style={styles.itemsCount}>
                    {o.items.length} article(s)
                  </Text>
                  <Text style={styles.orderTotal}>{formatXof(o.total_xof)}</Text>
                </View>
                {isCourier && (
                  <View style={styles.courierAlert}>
                    <Phone size={14} color={colors.error} />
                    <Text style={styles.courierAlertText}>
                      Le livreur va vous appeler
                    </Text>
                  </View>
                )}
                <View style={styles.orderBottom}>
                  <Text style={styles.linkText}>Voir le suivi</Text>
                  <ChevronRight size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
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
  orderCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tracking: { fontSize: 15, fontWeight: "800", color: colors.textPrimary, letterSpacing: 0.3 },
  orderDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  orderMid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemsCount: { fontSize: 13, color: colors.textSecondary },
  orderTotal: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  courierAlert: {
    marginTop: spacing.md,
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  courierAlertText: { color: colors.error, fontWeight: "700", fontSize: 13 },
  orderBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.md,
    alignSelf: "flex-end",
  },
  linkText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
});
