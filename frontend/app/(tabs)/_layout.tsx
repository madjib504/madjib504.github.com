import { Tabs } from "expo-router";
import { Home, ShoppingCart, Package, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { colors } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: Platform.OS === "android" ? 4 : 0 },
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Boutiques",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={2} />,
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Panier",
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} strokeWidth={2} />,
          tabBarButtonTestID: "tab-cart",
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} strokeWidth={2} />,
          tabBarButtonTestID: "tab-orders",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={2} />,
          tabBarButtonTestID: "tab-profile",
        }}
      />
    </Tabs>
  );
}
