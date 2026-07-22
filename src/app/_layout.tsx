import { DarkTheme, DefaultTheme, ThemeProvider, Slot } from 'expo-router';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import "../global.css";

import { AnimatedSplashOverlay } from '@/components/animated-icon';

// Este app não usa o navegador de abas do expo-router (AppTabs) — o fluxo
// inteiro (splash -> login -> onboarding -> app) é controlado manualmente
// dentro de src/app/index.tsx, e a barra inferior real do app fica dentro
// de AppMain.tsx. O <Slot /> aqui apenas renderiza essa rota única.
//
// SafeAreaProvider precisa envolver a árvore UMA ÚNICA VEZ, aqui na raiz.
// Sem ele, useSafeAreaInsets()/SafeAreaView (de react-native-safe-area-
// context) não têm como medir os insets reais do aparelho e caem num
// valor inicial zerado — foi isso que deixava o avatar do usuário (em
// AppMain.tsx) e os headers das telas (AgendaScreen, etc.) desalinhados
// da barra de status/notch/gestos.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Slot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}