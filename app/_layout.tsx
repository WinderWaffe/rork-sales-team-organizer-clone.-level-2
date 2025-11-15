import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { SalesTeamProvider } from "../contexts/sales-team-context";
import { UserProvider, useUser } from "../contexts/user-context";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const isOnLoginRoute = segments[0] === "login";

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!isAuthenticated && !isOnLoginRoute) {
      router.replace("/login");
      return;
    }
    if (isAuthenticated && isOnLoginRoute) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, isOnLoginRoute, router]);

  if (isLoading) {
    return (
      <View style={styles.loaderContainer} testID="app-auth-loading">
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loaderText}>Syncing your workspace…</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="rep/[id]" options={{ headerShown: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <SalesTeamProvider>
          <GestureHandlerRootView style={styles.gestureRoot}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </SalesTeamProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    gap: 16,
  },
  loaderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E2E8F0",
  },
});
