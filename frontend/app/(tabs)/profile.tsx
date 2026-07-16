import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { User as UserIcon, LogOut, MapPin, Phone, Save, Check } from "lucide-react-native";

import { api, clearToken, User } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
      setName(u.name || "");
      setAddress(u.address || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    setSaving(true);
    try {
      const u = await api.updateMe(name, address);
      setUser(u);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await clearToken();
    router.replace("/login");
  };

  if (loading || !user) {
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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <UserIcon size={32} color="#fff" />
          </View>
          <Text style={styles.name}>{user.name || "Utilisateur"}</Text>
          <View style={styles.phoneRow}>
            <Phone size={14} color={colors.textSecondary} />
            <Text style={styles.phone}>{user.phone}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations personnelles</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nom complet</Text>
            <TextInput
              testID="profile-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Votre nom"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Adresse de livraison</Text>
            <TextInput
              testID="profile-address-input"
              style={[styles.input, { height: 90, textAlignVertical: "top", paddingTop: spacing.md }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Ex: Cocody Riviera Palmeraie, près de la pharmacie..."
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </View>

          <TouchableOpacity
            testID="profile-save-button"
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : saved ? (
              <>
                <Check size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Enregistré</Text>
              </>
            ) : (
              <>
                <Save size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <MapPin size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Livraison partout en Côte d&apos;Ivoire</Text>
            <Text style={styles.infoText}>
              Abidjan, Bouaké, Yamoussoukro, San-Pédro et plus. Le livreur vous appelle pour
              confirmer votre localisation avant la remise du colis.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          testID="logout-button"
          style={styles.logoutBtn}
          onPress={logout}
          activeOpacity={0.7}
        >
          <LogOut size={20} color={colors.error} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Baraka Mall v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    ...shadow.md,
  },
  name: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  phoneRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: spacing.xs },
  phone: { fontSize: 14, color: colors.textSecondary },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.sm,
    marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
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
  saveBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  infoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  infoTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  infoText: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  logoutBtn: {
    height: 52,
    backgroundColor: colors.errorBg,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 15 },
  version: { textAlign: "center", fontSize: 12, color: colors.textTertiary, marginTop: spacing.xl },
});
