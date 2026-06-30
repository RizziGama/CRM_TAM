import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Modal, Platform, Text, TouchableOpacity, View } from "react-native";
import AgendaScreen from "./AgendaScreen";
import DashboardScreen from "./DashboardScreen";
import LeadsScreen from "./LeadsScreen";
import NovoLeadScreen from "./NovoLeadScreen";
import { logoutAzure } from "@/components/azureAuth";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "agenda" | "leads";

interface LeadParaEditar {
  nomeEmpresa: string;
  nomeContato: string;
  mercado: string;
  notasEvento: string;
  dataCriacao: string;
}

interface AppMainProps {
  onLogout?: () => void;
}

const TABS: {
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "dashboard", label: "DASHBOARD", icon: "trending-up-outline", iconActive: "trending-up" },
  { key: "agenda",    label: "AGENDA",    icon: "calendar-outline",    iconActive: "calendar" },
  { key: "leads",     label: "LEADS",     icon: "people-outline",      iconActive: "people" },
];

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────

function BottomTabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={{
      flexDirection: "row", backgroundColor: "#fff",
      borderTopWidth: 1, borderTopColor: "#EBEBEB",
      paddingBottom: Platform.OS === "ios" ? 20 : 0,
      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
    }}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 3 }}
            activeOpacity={0.7}
          >
            <View style={{ position: "absolute", top: 0, width: 28, height: 3, borderRadius: 2, backgroundColor: isActive ? "#CC0000" : "transparent" }} />
            <Ionicons name={isActive ? tab.iconActive : tab.icon} size={22} color={isActive ? "#CC0000" : "#BBBBBB"} />
            <Text style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6, color: isActive ? "#CC0000" : "#BBBBBB" }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── App Main ─────────────────────────────────────────────────────────────────

export default function AppMain({ onLogout }: AppMainProps) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [leadEditando, setLeadEditando] = useState<LeadParaEditar | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Chamado pelo DashboardScreen ao clicar num lead
  const handleLeadPress = (lead: LeadParaEditar) => {
    setLeadEditando(lead);
  };

  // Chamado pelo DashboardScreen ao clicar em "Ver todos"
  const handleVerTodos = () => {
    setActiveTab("leads");
  };

  const handleLogout = () => {
    Alert.alert(
      "Sair da conta",
      "Deseja realmente encerrar sua sessão?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            try {
              setLoggingOut(true);
              await logoutAzure();
            } finally {
              setLoggingOut(false);
              onLogout?.();
            }
          },
        },
      ]
    );
  };

  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardScreen
            onLeadPress={handleLeadPress}
            onVerTodos={handleVerTodos}
          />
        );
      case "agenda":
        return <AgendaScreen />;
      case "leads":
        return <LeadsScreen />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Modal de edição de lead — disponível globalmente */}
      <Modal visible={leadEditando !== null} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          mode="editar"
          initialData={leadEditando ?? undefined}
          onClose={() => setLeadEditando(null)}
          onSave={() => setLeadEditando(null)}
        />
      </Modal>

      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>

      {/* Botão de logout flutuante — fica visível em qualquer aba */}
      <TouchableOpacity
        onPress={handleLogout}
        disabled={loggingOut}
        style={{
          position: "absolute",
          top: Platform.OS === "ios" ? 54 : 28,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "rgba(0,0,0,0.06)",
          alignItems: "center",
          justifyContent: "center",
          opacity: loggingOut ? 0.5 : 1,
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={20} color="#555" />
      </TouchableOpacity>

      <BottomTabBar active={activeTab} onChange={setActiveTab} />
    </View>
  );
}
