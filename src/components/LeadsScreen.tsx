import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import NovoLeadScreen from "./NovoLeadScreen";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type StatusLead = "sync" | "pendente" | "erro";

interface Lead {
  id: string;
  initials: string;
  bgColor: string;
  empresa: string;
  badge: string;
  contato: string;
  mercado: string;
  status: StatusLead;
  data: string;
  nota: string;
}

// ─── Dados Mock ───────────────────────────────────────────────────────────────

const LEADS_DATA: Lead[] = [
  {
    id: "1",
    initials: "OR",
    bgColor: "#2D2D2D",
    empresa: "ORE INVESTPAR S/A",
    badge: "VA12",
    contato: "ANTONIO SILVA",
    mercado: "FINANCE - Financeiro",
    status: "sync",
    data: "22/06/2026",
    nota: '"Cliente interessado em fretamento executivo mensal."',
  },
  {
    id: "2",
    initials: "GR",
    bgColor: "#1A1A2E",
    empresa: "GRUPO ALPHA ENERGIA",
    badge: "VA13",
    contato: "RENATA CAMPOS",
    mercado: "ENERGY - Energia",
    status: "pendente",
    data: "22/06/2026",
    nota: '"Reunião agendada para próxima semana."',
  },
  {
    id: "3",
    initials: "MI",
    bgColor: "#1C3A1C",
    empresa: "MINERVA AGRO LTDA",
    badge: "VA14",
    contato: "CARLOS EDUARDO",
    mercado: "AGRO - Agronegócio",
    status: "erro",
    data: "22/06/2026",
    nota: '"Verificar CNPJ — divergência no cadastro."',
  },
  {
    id: "4",
    initials: "BT",
    bgColor: "#1A1A5E",
    empresa: "BLUE TECH AVIATION",
    badge: "VA15",
    contato: "MARIANA SOUZA",
    mercado: "TECH - Tecnologia",
    status: "sync",
    data: "23/06/2026",
    nota: '"Interesse em jato executivo para rotas internacionais."',
  },
  {
    id: "5",
    initials: "CR",
    bgColor: "#3A1A1A",
    empresa: "CONSTRUX REAL ESTATE",
    badge: "VA16",
    contato: "FABIO MENDES",
    mercado: "REAL ESTATE - Imóveis",
    status: "pendente",
    data: "23/06/2026",
    nota: '"Aguardando retorno do departamento financeiro."',
  },
];

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: StatusLead }> = ({ status }) => {
  const config = {
    sync: { icon: "checkmark-circle", color: "#22C55E", label: "Sincronizado com IFS", bg: "#F0FDF4" },
    pendente: { icon: "time-outline", color: "#F59E0B", label: "Aguardando Sync", bg: "#FFFBEB" },
    erro: { icon: "alert-circle-outline", color: "#CC0000", label: "Erro de Sync", bg: "#FFF0F0" },
  }[status];

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: config.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" }}>
      <Ionicons name={config.icon as any} size={14} color={config.color} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: config.color }}>{config.label}</Text>
    </View>
  );
};

const LeadCard: React.FC<{ lead: Lead; onPress: () => void }> = ({ lead, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
  >
    {/* Linha 1: Avatar + Empresa + Badge */}
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22, backgroundColor: lead.bgColor,
        alignItems: "center", justifyContent: "center", marginRight: 12,
      }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{lead.initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#111", letterSpacing: 0.2 }}>{lead.empresa}</Text>
          <View style={{ backgroundColor: "#F0F0F0", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#888" }}>{lead.badge}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
          <Ionicons name="person-outline" size={11} color="#AAA" />
          <Text style={{ fontSize: 12, color: "#666", fontWeight: "600" }}>{lead.contato}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          <MaterialCommunityIcons name="briefcase-outline" size={11} color="#AAA" />
          <Text style={{ fontSize: 11, color: "#AAA" }}>{lead.mercado}</Text>
        </View>
      </View>
    </View>

    {/* Linha 2: Status + Data */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 10 }}>
      <StatusBadge status={lead.status} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name="calendar-outline" size={12} color="#AAA" />
        <Text style={{ fontSize: 12, color: "#AAA" }}>{lead.data}</Text>
      </View>
    </View>

    {/* Linha 3: Nota */}
    {lead.nota ? (
      <Text style={{ fontSize: 13, color: "#666", fontStyle: "italic", borderTopWidth: 1, borderTopColor: "#F5F5F5", paddingTop: 10 }}>
        {lead.nota}
      </Text>
    ) : null}
  </TouchableOpacity>
);

// ─── Tela Principal ───────────────────────────────────────────────────────────

type Filtro = "todos" | StatusLead;

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sync", label: "Sync" },
  { key: "pendente", label: "Pendente" },
  { key: "erro", label: "Erro" },
];

export default function LeadsScreen() {
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [novoLeadVisible, setNovoLeadVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const leadsFiltrados = useMemo(() => {
    return LEADS_DATA.filter((lead) => {
      const matchFiltro = filtro === "todos" || lead.status === filtro;
      const matchSearch =
        search === "" ||
        lead.empresa.toLowerCase().includes(search.toLowerCase()) ||
        lead.contato.toLowerCase().includes(search.toLowerCase());
      return matchFiltro && matchSearch;
    });
  }, [filtro, search]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F6" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F4F6" />

      {/* ── Modal Novo Lead ──────────────────────────────────────────────── */}
      <Modal visible={novoLeadVisible} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          onClose={() => setNovoLeadVisible(false)}
          onSave={() => setNovoLeadVisible(false)}
        />
      </Modal>

      {/* ── Modal Editar Lead ─────────────────────────────────────────────── */}
      <Modal visible={selectedLead !== null} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          mode="editar"
          initialData={selectedLead ? {
            nomeEmpresa: selectedLead.empresa,
            nomeContato: selectedLead.contato,
            mercado: selectedLead.mercado,
            notasEvento: selectedLead.nota.replace(/"/g, ""),
            dataCriacao: selectedLead.data,
          } : undefined}
          onClose={() => setSelectedLead(null)}
          onSave={() => setSelectedLead(null)}
        />
      </Modal>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#111" }}>Pipeline de Leads</Text>
        <Text style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
          {LEADS_DATA.length} prospects cadastrados
        </Text>
      </View>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
          <Ionicons name="search-outline" size={16} color="#AAA" style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar empresa ou contato..."
            placeholderTextColor="#BBB"
            style={{ flex: 1, fontSize: 14, color: "#333" }}
          />
          {search !== "" && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filtros de Status ─────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 12 }}
        style={{ maxHeight: 46, flexGrow: 0 }}
      >
        {FILTROS.map((f) => {
          const active = filtro === f.key;
          const count = f.key === "todos" ? LEADS_DATA.length : LEADS_DATA.filter((l) => l.status === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFiltro(f.key)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24,
                backgroundColor: active ? "#111" : "#fff",
                borderWidth: active ? 0 : 1, borderColor: "#E0E0E0",
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : "#555" }}>
                {f.label}
              </Text>
              <View style={{ backgroundColor: active ? "rgba(255,255,255,0.2)" : "#F0F0F0", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : "#888" }}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Lista de Leads ────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      >
        {leadsFiltrados.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Ionicons name="search-outline" size={48} color="#DDD" />
            <Text style={{ color: "#BBB", marginTop: 12, fontSize: 15 }}>Nenhum lead encontrado</Text>
          </View>
        ) : (
          leadsFiltrados.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onPress={() => setSelectedLead(lead)} />
          ))
        )}
      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => setNovoLeadVisible(true)}
        style={{
          position: "absolute", bottom: 24, right: 20,
          width: 54, height: 54, borderRadius: 27,
          backgroundColor: "#CC0000", alignItems: "center", justifyContent: "center",
          shadowColor: "#CC0000", shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
