import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import LoginScreen from "@/components/LoginScreen";
import AppMain from "@/components/AppMain";
import SplashAnimado from "@/components/SplashAnimado";
import { getToken } from "@/components/azureAuth";

type Stage = "splash" | "checking" | "login" | "app";

export default function Page() {
  const [stage, setStage] = useState<Stage>("splash");

  // Depois do splash, checa se já existe um token Azure salvo (sessão anterior).
  useEffect(() => {
    if (stage !== "checking") return;

    async function checkAuth() {
      const token = await getToken();
      setStage(token ? "app" : "login");
    }

    checkAuth();
  }, [stage]);

  if (stage === "splash") {
    return (
      <SplashAnimado
        duration={3200}
        onFinish={() => setStage("checking")}
      />
    );
  }

  if (stage === "checking") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#CC0000" />
      </View>
    );
  }

  if (stage === "login") {
    return (
      <LoginScreen
        onLoginSuccess={() => setStage("app")}
      />
    );
  }

  return <AppMain onLogout={() => setStage("login")} />;
}
