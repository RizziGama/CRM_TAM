import { useEffect, useState } from "react";
import AppMain from "./AppMain";
import LoginScreen from "./LoginScreen";
import { getToken } from "@/components/azureAuth";
import { getExecutivoCache } from "@/components/ifsService";
import { View, ActivityIndicator } from "react-native";

export default function AppRoot() {
  const [logged, setLogged] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const token = await getToken();
      // Só considera "logado" se tiver token Azure E o executivo de vendas
      // já validado/cacheado no login. Se faltar qualquer um dos dois
      // (ex.: sessão antiga de antes dessa validação existir, ou cache
      // limpo por algum motivo), manda de volta pro login pra revalidar.
      const executivo = token ? await getExecutivoCache() : null;
      setLogged(!!token && !!executivo);
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
