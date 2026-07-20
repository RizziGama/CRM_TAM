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
  limparCacheLeadsLocais
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

// Agora a tela mostra leads de todos os status — inclusive os já
// sincronizados com o IFS — então o filtro ganha a opção "Sincronizado".
// Leads "sync" continuam visíveis mas não podem mais ser editados (ver
// `handleLeadPress` abaixo).
type Filtro = "todos" | "pendente" | "erro" | "sync";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendente", label: "Pendente" },
  { key: "erro", label: "Erro" },
  { key: "sync", label: "Sincronizado" },
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

  // A tela agora mostra leads de TODOS os status, inclusive os já
  // sincronizados com o IFS — só a edição continua bloqueada para esses
  // (ver `handleLeadPress`).
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
        // FIX: antes ia `mercado: lead.mercado` (a descrição, ex. "Financeiro"),
        // mas o ifsService só lê `mercadoCode` para montar o MarketCode do
        // payload — então o retry nunca reenviava o mercado de fato.
        mercadoCode: lead.mercadoCode,
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


  const [limpandoCache, setLimpandoCache] = useState(false);

const handleLimparCache = () => {
  Alert.alert(
    "Limpar cache de leads",
    "Isso vai apagar todos os leads salvos localmente neste dispositivo, inclusive os que ainda não foram sincronizados com o IFS (pendentes ou com erro). Essa ação não pode ser desfeita. Deseja continuar?",
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: async () => {
          try {
            setLimpandoCache(true);
            await limparCacheLeadsLocais();
            await carregarLeads();
          } catch (err) {
            Alert.alert("Erro", "Não foi possível limpar o cache. Tente novamente.");
          } finally {
            setLimpandoCache(false);
          }
        },
      },
    ]
  );
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
        {leadsCard.length} leads aguardando sincronização
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

      {/* ── Filtros de Status + Limpar Cache ────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 12, alignItems: "center" }}
          style={{ maxHeight: 52, flex: 1 }}
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
                  borderWidth: 1, borderColor: active ? "#111" : "#E0E0E0",
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: "600", color: active ? "#fff" : "#555" }}>
                  {f.label}
                </Text>
                <View style={{ backgroundColor: active ? "rgba(255,255,255,0.2)" : "#F0F0F0", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 11, lineHeight: 16, fontWeight: "700", color: active ? "#fff" : "#888" }}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={handleLimparCache}
          disabled={limpandoCache}
          activeOpacity={0.75}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#FFF0F0",
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginRight: 20,
            marginBottom: 12,
          }}
        >
          {limpandoCache ? (
            <ActivityIndicator size="small" color="#CC0000" />
          ) : (
            <Ionicons name="trash-outline" size={15} color="#CC0000" />
          )}
          <Text style={{ fontSize: 12.5, lineHeight: 17, fontWeight: "700", color: "#CC0000" }}>
            {limpandoCache ? "Limpando..." : "Limpar"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Lista de Leads ────────────────────────────────────────────────── */}
      {carregando ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#CC0000" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        >
          {leadsFiltrados.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Ionicons name="search-outline" size={48} color="#DDD" />
              <Text style={{ color: "#BBB", marginTop: 12, fontSize: 15 }}>
                {leadsCard.length === 0 ? "Nenhum lead cadastrado ainda" : "Nenhum lead encontrado"}
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
                  if (!original) return;

                  // Leads já sincronizados com o IFS não podem mais ser
                  // editados — mesmo padrão usado em Dashboard/Agenda: o
                  // card continua visível (dá visibilidade do que já foi
                  // feito), só a abertura do formulário de edição é
                  // bloqueada.
                  if (original.status === "sync") {
                    Alert.alert(
                      "Lead sincronizado",
                      "Este lead já foi sincronizado com o IFS e não pode ser editado."
                    );
                    return;
                  }

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
