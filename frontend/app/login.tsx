import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ShoppingBag, ArrowRight, Phone } from "lucide-react-native";

import { api, setToken } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fullPhone = "+225" + phone.replace(/\D/g, "");

  const sendCode = async () => {
    setError("");
    if (phone.replace(/\D/g, "").length < 8) {
      setError("Numéro invalide (min 8 chiffres)");
      return;
    }
    setLoading(true);
    try {
      const res = await api.sendOtp(fullPhone);
      setDevCode(res.dev_code);
      setStep("otp");
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError("");
    if (code.length < 4) {
      setError("Entrez le code à 4 chiffres");
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyOtp(fullPhone, code);
      await setToken(res.token);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Code invalide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <View style={styles.logoBadge}>
              <ShoppingBag size={40} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.brand}>Baraka Mall</Text>
            <Text style={styles.tagline}>Achetez partout. Livré à Abidjan.</Text>
          </View>

          {step === "phone" ? (
            <View style={styles.card}>
              <Text style={styles.h1}>Bienvenue</Text>
              <Text style={styles.subtitle}>
                Entrez votre numéro pour recevoir un code de connexion
              </Text>

              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}>
                  <Text style={styles.prefixText}>🇨🇮 +225</Text>
                </View>
                <TextInput
                  testID="phone-input"
                  style={styles.phoneInput}
                  placeholder="07 00 00 00 00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={15}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                testID="send-otp-button"
                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={sendCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Recevoir le code</Text>
                    <ArrowRight size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.h1}>Code reçu ?</Text>
              <Text style={styles.subtitle}>
                Un code a été envoyé au {fullPhone}
              </Text>
              {devCode ? (
                <View style={styles.devBox}>
                  <Text style={styles.devLabel}>Code démo</Text>
                  <Text style={styles.devCode}>{devCode}</Text>
                </View>
              ) : null}

              <TextInput
                testID="otp-input"
                style={styles.otpInput}
                placeholder="0000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                testID="verify-otp-button"
                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={verify}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Phone size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Vérifier & se connecter</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="change-phone-button"
                onPress={() => {
                  setStep("phone");
                  setCode("");
                  setError("");
                }}
                style={{ marginTop: spacing.lg, alignSelf: "center" }}
              >
                <Text style={styles.linkText}>Changer de numéro</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              🚚 Frais transparents · 💳 Payez en FCFA · 📞 Livreur vous appelle
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.secondary },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "space-between" },
  logoWrap: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  brand: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: -0.8 },
  tagline: { fontSize: 15, color: "#94A3B8", marginTop: spacing.xs },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    padding: spacing.xl,
    ...shadow.md,
  },
  h1: { fontSize: 24, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl, lineHeight: 22 },
  phoneRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  prefixBox: {
    height: 56,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  prefixText: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  phoneInput: {
    flex: 1,
    height: 56,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
  },
  otpInput: {
    height: 72,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    fontSize: 32,
    letterSpacing: 12,
    textAlign: "center",
    color: colors.textPrimary,
    fontWeight: "700",
  },
  primaryBtn: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorText: { color: colors.error, marginTop: spacing.sm, fontSize: 14 },
  linkText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  footer: { paddingVertical: spacing.xl, alignItems: "center" },
  footerText: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
  devBox: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  devLabel: { color: colors.warning, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  devCode: { color: colors.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: 4 },
});
