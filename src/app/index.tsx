import AppMain from "@/components/AppMain";
import LoginScreen from "@/components/LoginScreen";
import { useState } from "react";

export default function Page() {
  const [logado, setLogado] = useState(false);
  if (logado) return <AppMain />;
  return <LoginScreen onLogin={() => setLogado(true)} />;
}