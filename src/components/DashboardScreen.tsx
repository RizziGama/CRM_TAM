import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Modal,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import NovoLeadScreen from "./NovoLeadScreen";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  initials: string;
  company: string;
  contact: string;
  date: string;
  synced: boolean;
  bgColor: string;
}

interface EventData {
  name: string;
  location: string;
  leadsHoje: number;
  deltaLeads: number;
  meta: number;
  restantes: number;
  progresso: number;
  leadsFeitos: number;
  encerramento: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface DashboardProps {
  onLeadPress?: (lead: { nomeEmpresa: string; nomeContato: string; mercado: string; notasEvento: string; dataCriacao: string }) => void;
  onVerTodos?: () => void;
}

// ─── Dados Mock ───────────────────────────────────────────────────────────────

const EVENT: EventData = {
  name: "EBACE 2026",
  location: "Palexpo — Genebra",
  leadsHoje: 3,
  deltaLeads: 3,
  meta: 15,
  restantes: 9,
  progresso: 40,
  leadsFeitos: 6,
  encerramento: "25/06/2026",
};

const LEADS: Lead[] = [
  { id: "1", initials: "OR", company: "ORE INVESTPAR S/A", contact: "ANTONIO SILVA", date: "22/06/2026", synced: true, bgColor: "#2D2D2D" },
  { id: "2", initials: "GR", company: "GRUPO ALPHA ENERGIA", contact: "RENATA CAMPOS", date: "22/06/2026", synced: false, bgColor: "#1A1A2E" },
];

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const Avatar: React.FC<{ initials: string; size?: number; bgColor?: string }> = ({
  initials, size = 44, bgColor = "#CC0000",
}) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor, alignItems: "center", justifyContent: "center" }}>
    <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.36 }}>{initials}</Text>
  </View>
);

const LeadCard: React.FC<{ lead: Lead; onPress?: () => void }> = ({ lead, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
    <Avatar initials={lead.initials} bgColor={lead.bgColor} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ fontWeight: "700", fontSize: 13.5, color: "#111", letterSpacing: 0.2 }}>{lead.company}</Text>
      <Text style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{lead.contact} · {lead.date}</Text>
    </View>
    {lead.synced ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
        <Text style={{ fontSize: 12, color: "#22C55E", fontWeight: "600" }}>Sync</Text>
      </View>
    ) : (
      <Ionicons name="time-outline" size={18} color="#F59E0B" />
    )}
  </TouchableOpacity>
);

// ─── Tela Principal ───────────────────────────────────────────────────────────

const DashboardScreen: React.FC<DashboardProps> = ({ onLeadPress, onVerTodos }) => {
  const [search, setSearch] = useState("");
  const [novoLeadVisible, setNovoLeadVisible] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F6" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F4F6" />

      <Modal visible={novoLeadVisible} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          onClose={() => setNovoLeadVisible(false)}
          onSave={() => setNovoLeadVisible(false)}
        />
      </Modal>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View>
          <Text style={{ fontSize: 13, color: "#888" }}>Bom dia,</Text>
          <Text style={{ fontSize: 21, fontWeight: "700", color: "#111", marginTop: 1 }}>Marcos Okabayashi</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#ECECEC", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-outline" size={20} color="#555" />
          </TouchableOpacity>
          <Avatar initials="MO" size={38} bgColor="#CC0000" />
        </View>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
          <Feather name="search" size={16} color="#AAA" style={{ marginRight: 8 }} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Buscar leads, empresas..." placeholderTextColor="#BBB" style={{ flex: 1, fontSize: 14, color: "#333" }} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {/* Banner Evento */}
        <TouchableOpacity activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFF0F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: "#CC0000" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#CC0000" }} />
            <View>
              <Text style={{ fontWeight: "700", fontSize: 14, color: "#CC0000" }}>{EVENT.name}</Text>
              <Text style={{ fontSize: 12, color: "#888", marginTop: 1 }}>{EVENT.location}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CC0000" />
        </TouchableOpacity>

        {/* Cards Leads + Meta */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 18, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
            <MaterialCommunityIcons name="account-group-outline" size={20} color="#CC0000" style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#999", letterSpacing: 0.8 }}>LEADS HOJE</Text>
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#111", marginTop: 4 }}>{EVENT.leadsHoje}</Text>
            <Text style={{ fontSize: 12, color: "#22C55E", fontWeight: "600", marginTop: 4 }}>+{EVENT.deltaLeads} desde manhã</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#CC0000", borderRadius: 14, padding: 18, shadowColor: "#CC0000", shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <MaterialCommunityIcons name="target" size={18} color="#fff" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)", letterSpacing: 0.8 }}>META DO EVENTO</Text>
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#fff", marginTop: 4 }}>{EVENT.meta}</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{EVENT.restantes} restantes</Text>
          </View>
        </View>

        {/* Progresso */}
        <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: "#111" }}>Progresso — {EVENT.name}</Text>
            <Text style={{ fontWeight: "700", fontSize: 14, color: "#CC0000" }}>{EVENT.progresso}%</Text>
          </View>
          <View style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
            <View style={{ height: "100%", width: `${EVENT.progresso}%`, backgroundColor: "#CC0000", borderRadius: 3 }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: "#999" }}>{EVENT.leadsFeitos} de {EVENT.meta} leads</Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Encerra: {EVENT.encerramento}</Text>
          </View>
        </View>

        {/* Leads Recentes */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#111" }}>Leads Recentes</Text>
            <TouchableOpacity onPress={onVerTodos}>
              <Text style={{ fontSize: 13, color: "#CC0000", fontWeight: "600" }}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          {LEADS.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onPress={() => onLeadPress?.({
                nomeEmpresa: lead.company,
                nomeContato: lead.contact,
                mercado: "",
                notasEvento: "",
                dataCriacao: lead.date,
              })}
            />
          ))}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setNovoLeadVisible(true)}
        style={{ position: "absolute", bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: "#CC0000", alignItems: "center", justifyContent: "center", shadowColor: "#CC0000", shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default DashboardScreen;
