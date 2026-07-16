import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Phone,
  CheckCircle2,
  Circle,
  MapPin,
  Package,
  Plane,
  Ship,
  Home,
  Truck,
  User,
} from "lucide-react-native";

import { api, formatXof, Order, STATUS_LABELS, STATUS_ORDER } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

const STATUS_ICONS: Record<string, any> = {
  achat: Package,
  expedie: Plane,
  en_transit: Ship,
  arrive: Home,
  livreur_route: Truck,
  livre: CheckCircle2,
};

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const o = await api.getOrder(id);
      setOrder(o);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const advance = async () => {
    if (!id) return;
    setAdvancing(true);
    try {
      const o = await api.advanceOrder(id);
      setOrder(o);
    } finally {
      setAdvancing(false);
    }
  };

  const callCourier = () => {
    if (!order?.courier_phone) return;
    const tel = `tel:${order.courier_phone}`;
    Linking.canOpenURL(tel).then((can) => {
      if (can) Linking.openURL(tel);
      else Alert.alert("Appel indisponible", `Numéro: ${order.courier_phone}`);
    });
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const isDelivered = order.status === "livre";
  const isCourierRoute = order.status === "livreur_route";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="tracking-back" style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suivi de commande</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {/* Tracking code */}
        <View style={styles.trackCard}>
          <Text style={styles.trackLabel}>Code de suivi</Text>
          <Text style={styles.trackCode}>{order.tracking_code}</Text>
          <Text style={styles.trackDate}>
            Commandé le{" "}
            {new Date(order.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Courier alert */}
        {isCourierRoute && order.courier_phone && (
          <View style={styles.courierBanner} testID="courier-alert">
            <View style={styles.courierAvatar}>
              <User size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.courierName}>Votre livreur : {order.courier_name}</Text>
              <Text style={styles.courierSub}>
                Il va vous appeler pour confirmer votre localisation
              </Text>
            </View>
            <TouchableOpacity
              testID="call-courier-button"
              style={styles.callBtn}
              onPress={callCourier}
              activeOpacity={0.85}
            >
              <Phone size={20} color="#fff" />
              <Text style={styles.callBtnText}>Appeler</Text>
            </TouchableOpacity>
          </View>
        )}

        {isDelivered && (
          <View style={styles.deliveredBanner}>
            <CheckCircle2 size={24} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.deliveredTitle}>Livré avec succès</Text>
              <Text style={styles.deliveredSub}>Merci d&apos;avoir commandé sur Baraka Mall !</Text>
            </View>
          </View>
        )}

        {/* Stepper */}
        <View style={styles.stepperCard}>
          <Text style={styles.sectionTitle}>Statut de la commande</Text>
          {STATUS_ORDER.map((s, i) => {
            const Icon = STATUS_ICONS[s];
            const active = i <= currentIdx;
            const current = i === currentIdx;
            const last = i === STATUS_ORDER.length - 1;
            return (
              <View key={s} style={styles.stepRow}>
                <View style={styles.stepIndicator}>
                  <View
                    style={[
                      styles.stepDot,
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                      current && { transform: [{ scale: 1.1 }] },
                    ]}
                  >
                    {active ? (
                      <Icon size={16} color="#fff" />
                    ) : (
                      <Circle size={10} color={colors.textTertiary} />
                    )}
                  </View>
                  {!last && (
                    <View
                      style={[styles.stepLine, i < currentIdx && { backgroundColor: colors.primary }]}
                    />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text
                    style={[
                      styles.stepText,
                      active && { color: colors.textPrimary, fontWeight: "700" },
                    ]}
                  >
                    {STATUS_LABELS[s]}
                  </Text>
                  {current && (
                    <Text style={styles.stepCurrent}>En cours...</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Advance simulator (demo) */}
        {!isDelivered && (
          <TouchableOpacity
            testID="advance-status-button"
            style={styles.simulateBtn}
            onPress={advance}
            disabled={advancing}
            activeOpacity={0.75}
          >
            {advancing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.simulateBtnText}>
                🎬 Simuler prochaine étape (démo)
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Delivery address */}
        <View style={styles.addressCard}>
          <View style={styles.addrHeader}>
            <MapPin size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Adresse de livraison</Text>
          </View>
          <Text style={styles.addrName}>{order.address.full_name}</Text>
          <Text style={styles.addrLine}>
            {order.address.commune}, {order.address.city}
          </Text>
          {order.address.landmark ? (
            <Text style={styles.addrLine}>📍 {order.address.landmark}</Text>
          ) : null}
          <Text style={styles.addrPhone}>📞 {order.address.phone}</Text>
        </View>

        {/* Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>
            {order.items.length} article(s)
          </Text>
          {order.items.map((it: any) => (
            <View key={it.id} style={styles.itemRow}>
              <View style={styles.itemDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.product_name}</Text>
                <Text style={styles.itemMeta}>
                  {it.size ? `Taille: ${it.size} · ` : ""}Qté: {it.quantity} ·{" "}
                  {it.original_price} {it.original_currency}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total payé</Text>
          <Text style={styles.totalValue}>{formatXof(order.total_xof)}</Text>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
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
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, flex: 1, textAlign: "center" },
  trackCard: {
    backgroundColor: colors.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  trackLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  trackCode: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 1, marginTop: 4 },
  trackDate: { color: "#CBD5E1", fontSize: 12, marginTop: spacing.xs },
  courierBanner: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadow.md,
  },
  courierAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  courierName: { color: "#fff", fontWeight: "800", fontSize: 15 },
  courierSub: { color: "#FFE4CC", fontSize: 12, marginTop: 2 },
  callBtn: {
    backgroundColor: colors.secondary,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  deliveredBanner: {
    backgroundColor: colors.successBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  deliveredTitle: { color: colors.success, fontWeight: "800", fontSize: 15 },
  deliveredSub: { color: "#065F46", fontSize: 12, marginTop: 2 },
  stepperCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.md },
  stepRow: { flexDirection: "row", gap: spacing.md, minHeight: 56 },
  stepIndicator: { alignItems: "center", width: 32 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { flex: 1, width: 2, backgroundColor: colors.border, minHeight: 24 },
  stepContent: { flex: 1, paddingTop: 6 },
  stepText: { color: colors.textTertiary, fontSize: 14, fontWeight: "500" },
  stepCurrent: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: "600" },
  simulateBtn: {
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
    marginBottom: spacing.lg,
  },
  simulateBtnText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  addressCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  addrHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  addrName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  addrLine: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addrPhone: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm },
  itemsCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  itemRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm, alignItems: "flex-start" },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  itemName: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  totalCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
});
