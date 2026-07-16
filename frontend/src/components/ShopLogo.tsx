import { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";

import { colors } from "@/src/theme";

// Deterministic color per shop name
const PALETTE = [
  "#FF6B00", "#0F172A", "#DC2626", "#059669", "#7C3AED",
  "#DB2777", "#0891B2", "#CA8A04", "#4F46E5", "#EA580C",
];

function pickColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function ShopLogo({
  name,
  uri,
  size = 60,
  radius = 12,
}: {
  name: string;
  uri?: string;
  size?: number;
  radius?: number;
}) {
  const [errored, setErrored] = useState(false);
  const bg = pickColor(name);
  const initials = name
    .split(/[\s.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const showFallback = !uri || errored;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: showFallback ? bg : colors.paper,
        },
      ]}
    >
      {showFallback ? (
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
      ) : (
        <Image
          source={{ uri }}
          style={{ width: "78%", height: "78%" }}
          resizeMode="contain"
          onError={() => setErrored(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
});
