import { useEffect } from 'react';
import { router, Stack } from 'expo-router';

// Esta rota existe SÓ para o expo-router ter um destino válido para o
// deep link "tamexecutiva://redirect", usado pelo AuthSession no login e
// logout da Microsoft (ver redirectUri em src/components/azureAuth.ts).
//
// A troca real do código/token já acontece via
// WebBrowser.maybeCompleteAuthSession() + AuthSession.exchangeCodeAsync()
// dentro de azureAuth.ts. Esta tela não renderiza nada visível — só
// devolve o usuário pra rota raiz imediatamente, sem piscar tela nem
// animação de transição.
export default function RedirectScreen() {
  useEffect(() => {
    router.replace('/');
  }, []);

  return <Stack.Screen options={{ animation: 'none', headerShown: false }} />;
}
