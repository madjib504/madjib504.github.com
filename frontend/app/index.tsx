import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { storage } from "@/src/utils/storage";
import { colors } from "@/src/theme";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>("civ_mall_token", "");
      if (token) {
        router.replace("/(tabs)");
      } else {
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
