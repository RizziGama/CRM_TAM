import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import LoginScreen from "@/components/LoginScreen";
import AppMain from "@/components/AppMain";
import SplashAnimado from "@/components/SplashAnimado";
import OnboardingScreen, { jaViuOnboarding } from "@/components/OnboardingsSreen";
import { getToken } from "@/components/azureAuth";

type Stage = "splash" | "checking" | "login" | "onboarding" | "app";

export default function Page() {
  const [stage, setStage] = useState<Stage>("splash");

  // Depois do splash, checa se já existe um token Azure salvo (sessão anterior).
  useEffect(() => {
    if (stage !== "checking") return;

    async function checkAuth() {
      const token = await getToken();
      if (!token) {
        setStage("login");
        return;
      }

      const visto = await jaViuOnboarding();
      setStage(visto ? "app" : "onboarding");
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
        onLoginSuccess={async () => {
          const visto = await jaViuOnboarding();
          setStage(visto ? "app" : "onboarding");
        }}
      />
    );
  }

  if (stage === "onboarding") {
    return <OnboardingScreen onFinish={() => setStage("app")} />;
  }

  return <AppMain onLogout={() => setStage("login")} />;
}