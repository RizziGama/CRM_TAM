import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import NovoLeadScreen from "./NovoLeadScreen";
import { criarLeadIFS, getExecutivoCache } from "./ifsService";
import {
  LeadLocal,
  LeadStatus,
  listarLeadsLocais,
  upsertLeadLocal,
} from "./leadsStore";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LeadCardData {
  id: string;
  initials: string;
  bgColor: string;
  empresa: string;
  badge: string;
  contato: string;
  mercado: string;
  status: LeadStatus;
  data: string;
  nota: string;
}

// ─── Helpers de exibição ────────────────────────────────────────────────────────

const CORES_AVATAR = ["#2D2D2D", "#1A1A2E", "#1C3A1C", "#1A1A5E", "#3A1A1A", "#4A1A3A", "#1A3A3A"];

function corParaNome(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}

function iniciaisEmpresa(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "??";
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

function paraCard(lead: LeadLocal): LeadCardData {
  return {
    id: lead.id,
    initials: iniciaisEmpresa(lead.nomeEmpresa || "??"),
    bgColor: corParaNome(lead.nomeEmpresa || lead.id),
    empresa: lead.nomeEmpresa || "(Sem nome)",
    badge: lead.ifsLeadId ? `IFS #${lead.ifsLeadId}` : lead.cnpj || "S/ CNPJ",
    contato: lead.nomeContato || "—",
    mercado: lead.mercado || "—",
    status: lead.status,
    data: lead.dataCriacao,
    nota: lead.notasEvento ? `"${lead.notasEvento}"` : "",
  };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => {
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

const LeadCard: React.FC<{
  lead: LeadCardData;
  onPress: () => void;
  onRetry: () => void;
  sincronizando: boolean;
}> = ({ lead, onPress, onRetry, sincronizando }) => (
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

    {/* Linha 2: Status + Data + Reenviar */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 10 }}>
      <StatusBadge status={lead.status} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name="calendar-outline" size={12} color="#AAA" />
        <Text style={{ fontSize: 12, color: "#AAA" }}>{lead.data}</Text>
      </View>
    </View>

    {lead.status !== "sync" && (
      <TouchableOpacity
        onPress={onRetry}
        disabled={sincronizando}
        activeOpacity={0.7}
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
          backgroundColor: "#F4F4F6", borderRadius: 10, paddingVertical: 9, marginBottom: lead.nota ? 10 : 0,
        }}
      >
        {sincronizando ? (
          <ActivityIndicator size="small" color="#CC0000" />
        ) : (
          <Ionicons name="sync" size={14} color="#CC0000" />
        )}
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#CC0000" }}>
          {sincronizando ? "Sincronizando..." : "Tentar sincronizar novamente"}
        </Text>
      </TouchableOpacity>
    )}

    {/* Linha 3: Nota */}
    {lead.nota ? (
      <Text style={{ fontSize: 13, color: "#666", fontStyle: "italic", borderTopWidth: 1, borderTopColor: "#F5F5F5", paddingTop: 10 }}>
        {lead.nota}
      </Text>
    ) : null}
  </TouchableOpacity>
);

// ─── Tela Principal ───────────────────────────────────────────────────────────

type Filtro = "todos" | LeadStatus;

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
  const [selectedLead, setSelectedLead] = useState<LeadLocal | null>(null);
  const [leads, setLeads] = useState<LeadLocal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null);

  const carregarLeads = useCallback(async () => {
    const lista = await listarLeadsLocais();
    setLeads(lista);
    setCarregando(false);
  }, []);

  // Carrega a lista ao montar a tela. Depois disso, a lista é atualizada
  // manualmente via carregarLeads() nos callbacks onSave dos modais (criar,
  // editar, reenviar) — não há navegação por rotas nesse app pra usar um
  // "focus effect" automático.
  useEffect(() => {
    carregarLeads();
  }, [carregarLeads]);

  const leadsCard = leads.map(paraCard);

  const leadsFiltrados = leadsCard.filter((lead) => {
    const matchFiltro = filtro === "todos" || lead.status === filtro;
    const matchSearch =
      search === "" ||
      lead.empresa.toLowerCase().includes(search.toLowerCase()) ||
      lead.contato.toLowerCase().includes(search.toLowerCase());
    return matchFiltro && matchSearch;
  });

  const handleRetry = async (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    setSincronizandoId(leadId);
    try {
      // Usa o executivo já gravado no lead (quem criou originalmente); se
      // não tiver por algum motivo, cai pro executivo logado agora.
      let mainRepresentativeId = lead.mainRepresentativeId;
      if (!mainRepresentativeId) {
        const executivoAtual = await getExecutivoCache();
        mainRepresentativeId = executivoAtual?.id;
      }

      const result = await criarLeadIFS({
        nomeEmpresa: lead.nomeEmpresa,
        nomeContato: lead.nomeContato,
        cnpj: lead.cnpj,
        idioma: lead.idioma,
        pais: lead.pais,
        origem: lead.origem,
        mercado: lead.mercado,
        segmento: lead.segmento,
        potencial: lead.potencial,
        dataCriacao: lead.dataCriacao,
        notasEvento: lead.notasEvento,
        leadDuplicado: lead.leadDuplicado,
        mainRepresentativeId,
      });

      if (result.success) {
        await upsertLeadLocal({
          ...lead,
          status: "sync",
          ifsLeadId: result.leadId,
          erro: undefined,
          atualizadoEm: new Date().toISOString(),
        });
      } else {
        await upsertLeadLocal({
          ...lead,
          status: "erro",
          erro: result.error,
          atualizadoEm: new Date().toISOString(),
        });
        Alert.alert("Erro ao sincronizar", result.error ?? "Tente novamente mais tarde.");
      }
    } catch (err) {
      await upsertLeadLocal({
        ...lead,
        status: "erro",
        erro: "Erro inesperado ao sincronizar.",
        atualizadoEm: new Date().toISOString(),
      });
      Alert.alert("Erro inesperado", "Tente novamente mais tarde.");
    } finally {
      setSincronizandoId(null);
      carregarLeads();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F6" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F4F6" />

      {/* ── Modal Novo Lead ──────────────────────────────────────────────── */}
      <Modal visible={novoLeadVisible} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          onClose={() => setNovoLeadVisible(false)}
          onSave={() => {
            setNovoLeadVisible(false);
            carregarLeads();
          }}
        />
      </Modal>

      {/* ── Modal Editar Lead ─────────────────────────────────────────────── */}
      <Modal visible={selectedLead !== null} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          mode="editar"
          initialData={selectedLead ?? undefined}
          onClose={() => setSelectedLead(null)}
          onSave={() => {
            setSelectedLead(null);
            carregarLeads();
          }}
        />
      </Modal>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#111" }}>Pipeline de Leads</Text>
        <Text style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
          {leads.length} prospects cadastrados
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
          const count = f.key === "todos" ? leadsCard.length : leadsCard.filter((l) => l.status === f.key).length;
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
      {carregando ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#CC0000" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        >
          {leadsFiltrados.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Ionicons name="search-outline" size={48} color="#DDD" />
              <Text style={{ color: "#BBB", marginTop: 12, fontSize: 15 }}>
                {leads.length === 0 ? "Nenhum lead cadastrado ainda" : "Nenhum lead encontrado"}
              </Text>
            </View>
          ) : (
            leadsFiltrados.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                sincronizando={sincronizandoId === lead.id}
                onPress={() => {
                  const original = leads.find((l) => l.id === lead.id) ?? null;
                  setSelectedLead(original);
                }}
                onRetry={() => handleRetry(lead.id)}
              />
            ))
          )}
        </ScrollView>
      )}

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
