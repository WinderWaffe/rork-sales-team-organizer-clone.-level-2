import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { SalesTeamProvider } from "../contexts/sales-team-context";
import { UserProvider } from "../contexts/user-context";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{ headerBackTitle: "Back" }}
      initialRouteName="login"
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="rep/[id]" options={{ headerShown: true }} />
      <Stack.Screen name="leader/[leaderId]" options={{ headerShown: true }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}

function AppContent() {
  return (
    <SalesTeamProvider>
      <GestureHandlerRootView>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </SalesTeamProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </QueryClientProvider>
  );
}
