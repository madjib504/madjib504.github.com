import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowLeft, ExternalLink, Star, Truck, Calculator, ShoppingCart, Plus } from "lucide-react-native";

import { api, COUNTRY_FLAGS, COUNTRY_LABELS, CURRENCY_SYMBOL, formatXof, Quote, Shop } from "@/src/api";
import { colors, spacing, radii, shadow } from "@/src/theme";

export default function ShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  // Calculator
  const [price, setPrice] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Add-to-cart form
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState("1");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const s = await api.getShop(id);
        setShop(s);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const calculate = async () => {
    if (!shop) return;
    const p = parseFloat(price.replace(",", "."));
    if (!p || p <= 0) return;
    setQuoting(true);
    try {
      const q = await api.quote(p, shop.currency, shop.country, 1);
      setQuote(q);
    } finally {
      setQuoting(false);
    }
  };

  const openShop = async () => {
    if (!shop) return;
    await WebBrowser.openBrowserAsync(shop.website);
  };

  const addToCart = async () => {
    if (!shop) return;
    const p = parseFloat(price.replace(",", "."));
    const q = parseInt(qty, 10) || 1;
    if (!productName.trim() || !p || p <= 0) return;
    setAdding(true);
    try {
      await api.addToCart({
        shop_id: shop.id,
        product_url: productUrl.trim(),
        product_name: productName.trim(),
        original_price: p,
        original_currency: shop.currency,
        size: size.trim() || null,
        quantity: q,
        image_url: imageUrl.trim() || null,
      });
      setAdded(true);
      setTimeout(() => {
        setAdded(false);
        setShowForm(false);
        setProductName("");
        setProductUrl("");
        setImageUrl("");
        setSize("");
        setQty("1");
      }, 1500);
    } finally {
      setAdding(false);
    }
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="back-button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {shop.name}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Shop hero */}
          <View style={styles.hero}>
            <View style={styles.logoBox}>
              <Image source={{ uri: shop.logo_url }} style={styles.logoImg} resizeMode="contain" />
            </View>
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
                  Livraison {shop.delivery_days_min}-{shop.delivery_days_max} jours
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
            <ExternalLink size={20} color={colors.primary} />
            <Text style={styles.visitBtnText}>Visiter la boutique</Text>
          </TouchableOpacity>

          {/* Fee Calculator */}
          <View style={styles.calcCard}>
            <View style={styles.calcTitleRow}>
              <Calculator size={18} color={colors.primary} />
              <Text style={styles.calcTitle}>Calculateur de prix</Text>
            </View>
            <Text style={styles.calcSubtitle}>
              Entrez le prix en {shop.currency} pour voir le coût total en FCFA
            </Text>

            <View style={styles.calcInputRow}>
              <TextInput
                testID="calc-price-input"
                style={styles.calcInput}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
              />
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>
                  {CURRENCY_SYMBOL[shop.currency]} {shop.currency}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              testID="calculate-button"
              style={styles.calcBtn}
              onPress={calculate}
              disabled={quoting || !price}
              activeOpacity={0.85}
            >
              {quoting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.calcBtnText}>Calculer</Text>
              )}
            </TouchableOpacity>

            {quote && (
              <View style={styles.breakdown} testID="quote-breakdown">
                <BreakRow label="Prix produit" value={formatXof(quote.product_xof)} />
                <BreakRow label="Frais d'importation" value={formatXof(quote.import_fee_xof)} />
                <BreakRow label="Frais de service" value={formatXof(quote.service_fee_xof)} />
                <BreakRow label="Expédition int'l" value={formatXof(quote.intl_shipping_xof)} />
                <BreakRow label="Livraison Abidjan" value={formatXof(quote.local_delivery_xof)} />
                <View style={styles.breakDivider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total en FCFA</Text>
                  <Text style={styles.totalValue}>{formatXof(quote.total_xof)}</Text>
                </View>
                <Text style={styles.rateNote}>
                  Taux: 1 {shop.currency} ≈ {quote.rate.toFixed(2)} FCFA
                </Text>
              </View>
            )}
          </View>

          {/* Add to cart form */}
          {!showForm ? (
            <TouchableOpacity
              testID="show-add-form-button"
              style={styles.addBtnOutline}
              onPress={() => setShowForm(true)}
              activeOpacity={0.85}
            >
              <Plus size={20} color={colors.primary} />
              <Text style={styles.addBtnOutlineText}>Commander un produit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Ajouter au panier</Text>

              <FormField
                label="Nom du produit *"
                value={productName}
                onChangeText={setProductName}
                placeholder="Ex: Robe rouge Zara"
                testID="form-name-input"
              />
              <FormField
                label="Lien du produit (facultatif)"
                value={productUrl}
                onChangeText={setProductUrl}
                placeholder="https://..."
                testID="form-url-input"
              />
              <FormField
                label="Image (URL, facultatif)"
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://..."
                testID="form-image-input"
              />
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Taille"
                    value={size}
                    onChangeText={setSize}
                    placeholder="M, 42, ..."
                    testID="form-size-input"
                  />
                </View>
                <View style={{ width: 100 }}>
                  <FormField
                    label="Qté"
                    value={qty}
                    onChangeText={setQty}
                    placeholder="1"
                    testID="form-qty-input"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.priceHint}>
                Prix actuel: {price ? `${price} ${CURRENCY_SYMBOL[shop.currency]}` : "utilisez le calculateur ci-dessus"}
              </Text>

              <TouchableOpacity
                testID="add-to-cart-button"
                style={[styles.addBtn, (adding || !productName || !price) && { opacity: 0.5 }]}
                onPress={addToCart}
                disabled={adding || !productName || !price}
                activeOpacity={0.85}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" />
                ) : added ? (
                  <Text style={styles.addBtnText}>✓ Ajouté au panier</Text>
                ) : (
                  <>
                    <ShoppingCart size={18} color="#fff" />
                    <Text style={styles.addBtnText}>Ajouter au panier</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowForm(false)}
                style={{ alignSelf: "center", marginTop: spacing.md }}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  testID,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  testID: string;
  keyboardType?: "number-pad" | "default";
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
      />
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
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, flex: 1, textAlign: "center", marginHorizontal: spacing.md },
  hero: {
    flexDirection: "row",
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  logoImg: { width: "100%", height: "100%" },
  shopName: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  metaRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 4 },
  metaFlag: { fontSize: 14 },
  metaText: { fontSize: 13, color: colors.textSecondary },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textTertiary, marginHorizontal: 4 },
  description: { padding: spacing.lg, fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  visitBtn: {
    marginHorizontal: spacing.lg,
    height: 56,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  visitBtnText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  calcCard: {
    margin: spacing.lg,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  calcTitleRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  calcTitle: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  calcSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  calcInputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  calcInput: {
    flex: 1,
    height: 52,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  currencyBadge: {
    height: 52,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  calcBtn: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  calcBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  breakdown: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  breakRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  breakLabel: { fontSize: 13, color: colors.textSecondary },
  breakValue: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  breakDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  totalLabel: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
  rateNote: { fontSize: 11, color: colors.textTertiary, marginTop: spacing.sm, textAlign: "right" },
  addBtnOutline: {
    marginHorizontal: spacing.lg,
    height: 56,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.paper,
  },
  addBtnOutlineText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  formCard: {
    margin: spacing.lg,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  formTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.md },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    height: 48,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  priceHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md, fontStyle: "italic" },
  addBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelText: { color: colors.textSecondary, fontSize: 14 },
});
