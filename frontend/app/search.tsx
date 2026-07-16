import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Search, Star, X } from "lucide-react-native";

import { api, COUNTRY_FLAGS, COUNTRY_LABELS, CURRENCY_SYMBOL, formatXof, Product } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

const RATE_APPROX: Record<string, number> = { EUR: 656, USD: 610, CNY: 84.5 };

export default function SearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<"ALL" | "FR" | "US" | "CN">("ALL");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await api.listProducts({
          country: country === "ALL" ? undefined : country,
          q: q.trim() || undefined,
        });
        setProducts(list);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, country]);

  const renderProduct = ({ item }: { item: Product }) => {
    const approxXof = item.price * (RATE_APPROX[item.currency] || 1);
    return (
      <TouchableOpacity
        testID={`search-result-${item.id}`}
        style={styles.card}
        onPress={() => router.push(`/product/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.imgWrap}>
          {item.images[0] ? (
            <Image source={{ uri: item.images[0] }} style={styles.img} />
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.metaRow}>
            <Text style={styles.shopBadge}>{item.shop_name}</Text>
            <Text style={styles.flag}>{COUNTRY_FLAGS[item.shop_country]}</Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.ratingRow}>
            <Star size={11} color={colors.warning} fill={colors.warning} />
            <Text style={styles.rating}>
              {item.rating.toFixed(1)} · {item.reviews}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {item.price.toFixed(2)} {CURRENCY_SYMBOL[item.currency]}
            </Text>
            <Text style={styles.xof}>≈ {formatXof(approxXof)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="search-back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.searchWrap}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            testID="search-input"
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="Robe, iPhone, sneakers..."
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />
          {q ? (
            <TouchableOpacity testID="search-clear" onPress={() => setQ("")}>
              <X size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {(["ALL", "FR", "US", "CN"] as const).map((c) => {
          const active = country === c;
          return (
            <TouchableOpacity
              key={c}
              testID={`search-country-${c}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCountry(c)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c === "ALL" ? "🌍 Tous" : `${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderProduct}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {q ? `Aucun résultat pour "${q}"` : "Recherchez un produit"}
              </Text>
            </View>
          }
          ListHeaderComponent={
            products.length > 0 ? (
              <Text style={styles.count}>{products.length} produit(s)</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
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
  searchWrap: {
    flex: 1,
    height: 44,
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  chip: {
    height: 36,
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
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  count: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: "600" },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    ...shadow.sm,
  },
  imgWrap: {
    width: 90,
    height: 90,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  img: { width: "100%", height: "100%" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  shopBadge: { fontSize: 11, color: colors.primary, fontWeight: "700", textTransform: "uppercase" },
  flag: { fontSize: 14 },
  name: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginTop: 4 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  rating: { fontSize: 11, color: colors.textSecondary },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: 6 },
  price: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  xof: { fontSize: 12, color: colors.primary, fontWeight: "700" },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});
