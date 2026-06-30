import { useEffect, useState } from "react";
import AppMain from "./AppMain";
import LoginScreen from "./LoginScreen";
import { getToken } from "@/components/azureAuth";
import { View, ActivityIndicator } from "react-native";

export default function AppRoot() {
  const [logged, setLogged] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const token = await getToken();
      setLogged(!!token);
    }

    checkAuth();
  }, []);

  // loading inicial
  if (logged === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#CC0000" />
      </View>
    );
  }

  // não logado
  if (!logged) {
    return (
      <LoginScreen
        onLoginSuccess={() => setLogged(true)}
      />
    );
  }

  // logado
  return (
    <AppMain
      onLogout={() => setLogged(false)}
    />
  );
}