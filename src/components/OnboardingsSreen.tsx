import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

// Chave usada para lembrar que o usuário já viu o onboarding neste
// dispositivo. Ficando no AsyncStorage (não no SecureStore) porque não é
// um dado sensível — só uma preferência de UI.
export const ONBOARDING_STORAGE_KEY = "onboarding_concluido";

export async function jaViuOnboarding(): Promise<boolean> {
  try {
    const valor = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
    return valor === "true";
  } catch {
    // Em caso de falha de leitura, prefere mostrar o onboarding de novo a
    // arriscar nunca mostrar pra ninguém.
    return false;
  }
}

async function marcarOnboardingVisto(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch (err) {
    console.warn("[Onboarding] Falha ao salvar preferência:", err);
  }
}

// ─── Conteúdo dos slides ────────────────────────────────────────────────────

interface Slide {
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets?: string[];
}

const SLIDES: Slide[] = [
  {
    icon: <Ionicons name="airplane" size={40} color="#fff" />,
    title: "Bem-vindo ao TAM Executivo",
    description:
      "Seu app de captação de leads em eventos. Em poucos toques você cadastra prospects, acompanha metas e sincroniza tudo com o IFS.",
  },
  {
    icon: <MaterialCommunityIcons name="trending-up" size={40} color="#fff" />,
    title: "Dashboard",
    description:
      "Assim que abrir o app, você vê o resumo do evento ativo: leads capturados hoje, meta, mercados atendidos e potencial da carteira.",
    bullets: [
      "Toque no banner do evento para trocar o evento ativo",
      "Use a busca para achar um lead rapidamente",
      "Toque em um lead para editar (se ainda não foi sincronizado)",
    ],
  },
  {
    icon: <Ionicons name="calendar" size={40} color="#fff" />,
    title: "Agenda (Evento)",
    description:
      "Aqui fica o controle do evento em que você está atuando: progresso da meta, status de sincronização e o perfil dos clientes captados.",
    bullets: [
      "Aba Resumo: números gerais do evento",
      "Aba Leads: lista completa com status (Sync / Pendente / Erro)",
      "Aba Perfil Clientes: mercados e potencial em gráficos",
    ],
  },
  {
    icon: <Ionicons name="people" size={40} color="#fff" />,
    title: "Pipeline de Leads",
    description:
      "Todos os leads que você já cadastrou, com filtros por status e busca por empresa ou contato.",
    bullets: [
      "Leads com erro ou pendentes podem ser reenviados com um toque",
      "Leads já sincronizados (Sync) não podem mais ser editados",
      "\"Limpar\" remove o cache local do aparelho — use com cuidado",
    ],
  },
  {
    icon: <Ionicons name="add-circle" size={40} color="#fff" />,
    title: "Novo Lead",
    description:
      "Toque no botão vermelho (+) em qualquer tela para cadastrar um prospect novo.",
    bullets: [
      "\"Salvar\": guarda só no aparelho, sem enviar ao IFS ainda",
      "\"Salvar e Sincronizar\": grava local e já envia para o IFS",
      "Sem internet? Salve local e sincronize depois na tela Leads",
    ],
  },
  {
    icon: <Ionicons name="checkmark-done-circle" size={40} color="#fff" />,
    title: "Boas práticas",
    description: "Algumas dicas para o seu dia a dia em eventos:",
    bullets: [
      "Confira o evento ativo antes de cadastrar (Agenda > nome do evento)",
      "Sincronize sempre que tiver uma conexão estável",
      "Preencha o mercado do lead — ele alimenta os gráficos do Dashboard",
      "Revise leads com erro regularmente na aba Pendente/Erro",
    ],
  },
];

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Dots({ total, active }: { total: number; active: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === active ? "#CC0000" : "#E5E5E5",
          }}
        />
      ))}
    </View>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  return (
    <View style={{ width, paddingHorizontal: 28, alignItems: "center" }}>
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: "#CC0000",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 28,
          shadowColor: "#CC0000",
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        {slide.icon}
      </View>

      <Text style={{ fontSize: 22, fontWeight: "800", color: "#111", textAlign: "center", marginBottom: 10 }}>
        {slide.title}
      </Text>
      <Text style={{ fontSize: 14.5, color: "#666", textAlign: "center", lineHeight: 21, marginBottom: slide.bullets ? 20 : 0 }}>
        {slide.description}
      </Text>

      {slide.bullets && (
        <View style={{ width: "100%", gap: 10 }}>
          {slide.bullets.map((b, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F4F4F6", borderRadius: 12, padding: 12 }}>
              <Ionicons name="checkmark-circle" size={16} color="#CC0000" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, color: "#444", lineHeight: 18 }}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Tela Principal ───────────────────────────────────────────────────────────

interface Props {
  onFinish: () => void;
}

export default function OnboardingScreen({ onFinish }: Props) {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = step === SLIDES.length - 1;

  const finalizar = async () => {
    await marcarOnboardingVisto();
    onFinish();
  };

  const irParaStep = (i: number) => {
    setStep(i);
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const novoStep = Math.round(e.nativeEvent.contentOffset.x / width);
    setStep(novoStep);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Pular */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, paddingTop: 8 }}>
        {!isLast && (
          <TouchableOpacity onPress={finalizar} activeOpacity={0.7} style={{ padding: 8 }}>
            <Text style={{ color: "#999", fontWeight: "600", fontSize: 13 }}>Pular</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: "center" }}
      >
        {SLIDES.map((slide, i) => (
          <SlideView key={i} slide={slide} />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 }}>
        <Dots total={SLIDES.length} active={step} />

        <View style={{ flexDirection: "row", gap: 10 }}>
          {step > 0 && (
            <TouchableOpacity
              onPress={() => irParaStep(step - 1)}
              activeOpacity={0.8}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#F4F4F6", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="chevron-back" size={20} color="#666" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => (isLast ? finalizar() : irParaStep(step + 1))}
            activeOpacity={0.85}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 26,
              backgroundColor: "#CC0000",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              shadowColor: "#CC0000",
              shadowOpacity: 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 5,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {isLast ? "Começar a usar" : "Próximo"}
            </Text>
            <Ionicons name={isLast ? "checkmark" : "chevron-forward"} size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}