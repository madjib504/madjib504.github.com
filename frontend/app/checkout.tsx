import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, CheckCircle2, Smartphone } from "lucide-react-native";

import { api, formatXof } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

type PaymentMethod = {
  id: "orange" | "mtn" | "moov" | "wave";
  name: string;
  color: string;
  emoji: string;
};

const METHODS: PaymentMethod[] = [
  { id: "orange", name: "Orange Money", color: "#FF6600", emoji: "🟠" },
  { id: "mtn", name: "MTN Mobile Money", color: "#FFCC00", emoji: "🟡" },
  { id: "moov", name: "Moov Money", color: "#0055B7", emoji: "🔵" },
  { id: "wave", name: "Wave", color: "#4EABFF", emoji: "🌊" },
];

const COMMUNES = [
  "Cocody", "Yopougon", "Marcory", "Treichville", "Plateau",
  "Adjamé", "Abobo", "Attécoubé", "Bingerville", "Koumassi",
  "Port-Bouët", "Songon", "Anyama",
];

export default function CheckoutScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [commune, setCommune] = useState("Cocody");
  const [landmark, setLandmark] = useState("");
  const [method, setMethod] = useState<PaymentMethod["id"] | null>(null);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [total, setTotal] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.cartSummary();
        setTotal(s.total_xof);
        const me = await api.me();
        if (me.name) setFullName(me.name);
        setPhone(me.phone.replace("+225", ""));
        setPaymentPhone(me.phone.replace("+225", ""));
      } catch {}
    })();
  }, []);

  const canSubmit =
    fullName.trim() && phone.trim() && commune && method && paymentPhone.trim();

  const submit = async () => {
    setError("");
    if (!canSubmit || !method) return;
    setPlacing(true);
    try {
      const order = await api.createOrder(
        {
          full_name: fullName,
          phone: phone.startsWith("+") ? phone : "+225" + phone,
          city: "Abidjan",
          commune,
          landmark: landmark || undefined,
        },
        method,
        paymentPhone.startsWith("+") ? paymentPhone : "+225" + paymentPhone,
      );
      setSuccessOrderId(order.id);
    } catch (e: any) {
      setError(e.message || "Erreur lors du paiement");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="checkout-back" style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finaliser la commande</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Address */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Adresse de livraison</Text>
            </View>

            <Field
              label="Nom complet *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Prénom Nom"
              testID="checkout-name"
            />
            <Field
              label="Téléphone (contact) *"
              value={phone}
              onChangeText={setPhone}
              placeholder="07XXXXXXXX"
              testID="checkout-phone"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Commune *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
            >
              {COMMUNES.map((c) => {
                const active = commune === c;
                return (
                  <TouchableOpacity
                    key={c}
                    testID={`commune-chip-${c}`}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCommune(c)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Field
              label="Point de repère"
              value={landmark}
              onChangeText={setLandmark}
              placeholder="Ex: Près de la pharmacie, à côté du marché..."
              testID="checkout-landmark"
              multiline
            />

            <View style={styles.callNote}>
              <MapPin size={16} color={colors.primary} />
              <Text style={styles.callNoteText}>
                Le livreur vous appellera pour confirmer la localisation exacte à l&apos;arrivée.
              </Text>
            </View>
          </View>

          {/* Step 2: Payment */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Paiement Mobile Money</Text>
            </View>

            <View style={styles.methodsGrid}>
              {METHODS.map((m) => {
                const active = method === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    testID={`payment-method-${m.id}`}
                    style={[
                      styles.methodCard,
                      active && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => setMethod(m.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.methodEmoji}>{m.emoji}</Text>
                    <Text style={styles.methodName}>{m.name}</Text>
                    {active && (
                      <View style={styles.methodCheck}>
                        <CheckCircle2 size={16} color={colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {method && (
              <>
                <Text style={[styles.label, { marginTop: spacing.md }]}>
                  Numéro Mobile Money *
                </Text>
                <View style={styles.paymentInputRow}>
                  <View style={styles.prefixBox}>
                    <Text style={styles.prefixText}>🇨🇮 +225</Text>
                  </View>
                  <TextInput
                    testID="payment-phone-input"
                    style={styles.paymentInput}
                    value={paymentPhone}
                    onChangeText={setPaymentPhone}
                    placeholder="07XXXXXXXX"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.mockNote}>
                  <Smartphone size={14} color={colors.warning} />
                  <Text style={styles.mockNoteText}>
                    DÉMO: Aucun paiement réel — validation immédiate simulée
                  </Text>
                </View>
              </>
            )}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>Total</Text>
            <Text style={styles.footerTotal}>{formatXof(total)}</Text>
          </View>
          <TouchableOpacity
            testID="pay-button"
            style={[styles.payBtn, (!canSubmit || placing) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={!canSubmit || placing}
            activeOpacity={0.85}
          >
            {placing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payBtnText}>Payer {formatXof(total)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Success modal */}
      <Modal visible={!!successOrderId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIcon}>
              <CheckCircle2 size={48} color={colors.success} />
            </View>
            <Text style={styles.modalTitle}>Commande confirmée !</Text>
            <Text style={styles.modalText}>
              Votre paiement a été validé. Nous commençons l&apos;achat de vos articles.
            </Text>
            <TouchableOpacity
              testID="success-view-order"
              style={styles.modalBtn}
              onPress={() => {
                const id = successOrderId!;
                setSuccessOrderId(null);
                router.replace(`/order/${id}`);
              }}
            >
              <Text style={styles.modalBtnText}>Suivre ma commande</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  testID,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  testID: string;
  keyboardType?: "phone-pad" | "default";
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={[
          styles.input,
          multiline && { height: 80, textAlignVertical: "top", paddingTop: spacing.md },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  stepCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  stepTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 52,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  chip: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  callNote: {
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: "center",
  },
  callNoteText: { flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  methodsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  methodCard: {
    width: "48%",
    height: 90,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
    justifyContent: "space-between",
  },
  methodEmoji: { fontSize: 28 },
  methodName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  methodCheck: { position: "absolute", top: 8, right: 8 },
  paymentInputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  prefixBox: {
    height: 52,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  prefixText: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  paymentInput: {
    flex: 1,
    height: 52,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  mockNote: {
    marginTop: spacing.md,
    backgroundColor: colors.warningBg,
    padding: spacing.sm,
    borderRadius: radii.sm,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  mockNoteText: { fontSize: 11, color: colors.warning, fontWeight: "700" },
  errorBox: { backgroundColor: colors.errorBg, padding: spacing.md, borderRadius: radii.md },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600" },
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
  footerTotal: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  payBtn: {
    flex: 1,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 260,
  },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.successBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, textAlign: "center" },
  modalText: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  modalBtn: {
    height: 52,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
    alignSelf: "stretch",
  },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
