import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Modal,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import NovoLeadScreen from "./NovoLeadScreen";
import { AzureUserInfo, getUserInfo } from "@/components/azureAuth";
import { LeadLocal, listarLeadsLocais } from "./leadsStore";
import { EventoLead, buscarEventosIFS, getEventoSelecionadoCache } from "./ifsService";

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
  onLeadPress?: (lead: LeadLocal) => void;
  onVerTodos?: () => void;
  onAbrirEvento?: () => void;
  userInfo?: AzureUserInfo | null;
}

// ─── Dados de fallback do Evento ───────────────────────────────────────────────
//
// Usados só enquanto nenhum evento foi carregado/selecionado ainda (ex.: sem
// rede na primeira abertura, ou antes de o usuário escolher um evento na
// Agenda). Assim que houver um evento selecionado (mesmo cache local vindo
// de AgendaScreen), o nome e a meta reais (Cf_Nome_Evento / Cf_Meta_Leasds)
// passam a valer aqui também — Dashboard e Agenda sempre mostram o mesmo
// evento "ativo".

const META_FALLBACK = 15;

const EVENT: EventData = {
  name: "Selecionar evento",
  location: "",
  leadsHoje: 3,
  deltaLeads: 3,
  meta: META_FALLBACK,
  restantes: 9,
  progresso: 40,
  leadsFeitos: 6,
  encerramento: "—",
};

// ─── Helpers de exibição (mesma lógica usada em LeadsScreen) ──────────────────

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

function paraCardResumido(lead: LeadLocal): Lead {
  return {
    id: lead.id,
    initials: iniciaisEmpresa(lead.nomeEmpresa || "??"),
    company: lead.nomeEmpresa || "(Sem nome)",
    contact: lead.nomeContato || "—",
    date: lead.dataCriacao,
    synced: lead.status === "sync",
    bgColor: corParaNome(lead.nomeEmpresa || lead.id),
  };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const Avatar: React.FC<{ initials: string; size?: number; bgColor?: string }> = ({
  initials, size = 44, bgColor = "#CC0000",
}) => {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bgColor,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    elevation: 0,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  } as const;

  const textStyle = { color: "#fff", fontWeight: "700", fontSize: size * 0.36 } as const;

  return (
    <View style={avatarStyle}>
      <Text style={textStyle}>{initials}</Text>
    </View>
  );
};

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

const DashboardScreen: React.FC<DashboardProps> = ({ onLeadPress, onVerTodos, onAbrirEvento, userInfo: userInfoProp }) => {
  const [search, setSearch] = useState("");
  const [novoLeadVisible, setNovoLeadVisible] = useState(false);
  const [userInfoState, setUserInfoState] = useState<AzureUserInfo | null>(null);
  const [leadsRecentes, setLeadsRecentes] = useState<LeadLocal[]>([]);
  const [todosLeads, setTodosLeads] = useState<LeadLocal[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadsHoje, setLeadsHoje] = useState(0);
  const [eventoAtual, setEventoAtual] = useState<EventoLead | null>(null);

  // Se o componente pai passar userInfo explicitamente, usamos ele (override).
  // Caso contrário, buscamos o usuário logado direto do SecureStore/token.
  useEffect(() => {
    if (userInfoProp) return; // pai já está controlando

    let mounted = true;
    getUserInfo()
      .then((info) => {
        if (mounted) setUserInfoState(info);
      })
      .catch((err) => {
        console.warn("[DashboardScreen] Falha ao buscar userInfo:", err);
      });

    return () => {
      mounted = false;
    };
  }, [userInfoProp]);

  const userInfo = userInfoProp ?? userInfoState;

  // Nome/iniciais reais do usuário Microsoft logado, com fallback enquanto
  // carrega ou caso não seja possível ler o token.
  const displayName = userInfo?.name ?? "Usuário";

  // Carrega os leads reais (leadsStore). A lista completa é usada pros
  // contadores (total e "hoje"); só os 5 mais recentes são exibidos como
  // cards. Antes, "leadsHoje" era calculado em cima da lista já cortada em
  // poucos itens (leadsRecentes), então o contador nunca conseguia passar
  // desse número — esse era o bug. Agora ele conta em cima de `todos`.
  const carregarLeadsRecentes = useCallback(async () => {
    const todos = await listarLeadsLocais(); // já vem ordenado, mais recentes primeiro
    const hojeStr = new Date().toLocaleDateString("pt-BR");

    setTotalLeads(todos.length);
    setLeadsHoje(todos.filter((l) => l.dataCriacao === hojeStr).length);
    setLeadsRecentes(todos.slice(0, 5));
    setTodosLeads(todos);
  }, []);

  useEffect(() => {
    carregarLeadsRecentes();
  }, [carregarLeadsRecentes]);

  // Carrega o evento que está "ativo" na Agenda (cache local salvo por
  // AgendaScreen ao selecionar um evento). Também busca a lista atualizada
  // no IFS em paralelo, pra garantir que a meta exibida aqui reflita
  // qualquer alteração feita no IFS desde a última seleção — igual à
  // lógica usada em AgendaScreen.carregarEventos.
  const carregarEventoAtual = useCallback(async () => {
    try {
      const [cache, lista] = await Promise.all([
        getEventoSelecionadoCache(),
        buscarEventosIFS(),
      ]);

      if (cache) {
        const atualizado = lista.find((e) => e.objkey === cache.objkey);
        setEventoAtual(atualizado ?? cache);
      } else if (lista.length > 0) {
        setEventoAtual(lista[0]);
      }
    } catch (err) {
      console.warn("[DashboardScreen] Falha ao carregar evento selecionado:", err);
    }
  }, []);

  useEffect(() => {
    carregarEventoAtual();
  }, [carregarEventoAtual]);

  // Sem busca: mostra só os 3 leads mais recentes (comportamento original).
  // Com busca: filtra em TODOS os leads (empresa ou contato) e mostra os
  // resultados encontrados, não só os 3 últimos.
  const buscaAtiva = search.trim().length > 0;

  const leadsFonte = buscaAtiva
    ? todosLeads.filter((l) => {
        const termo = search.trim().toLowerCase();
        return (
          (l.nomeEmpresa ?? "").toLowerCase().includes(termo) ||
          (l.nomeContato ?? "").toLowerCase().includes(termo)
        );
      })
    : leadsRecentes;

  const leadsCard = leadsFonte.map(paraCardResumido);

  // Nome e meta seguem o evento selecionado na Agenda; cai no fallback
  // enquanto nada foi carregado/selecionado ainda.
  const eventName = eventoAtual?.nome ?? EVENT.name;
  const eventMeta =
    eventoAtual?.metaLeads && eventoAtual.metaLeads > 0 ? eventoAtual.metaLeads : META_FALLBACK;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F6" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F4F6" />

      <Modal visible={novoLeadVisible} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          onClose={() => setNovoLeadVisible(false)}
          onSave={() => {
            setNovoLeadVisible(false);
            carregarLeadsRecentes();
          }}
        />
      </Modal>

      {/* Header
          Obs.: o avatar do usuário (com menu de logout) já é exibido
          globalmente pelo <UserMenu /> em AppMain.tsx, flutuando por cima
          de todas as abas. Por isso NÃO renderizamos um Avatar aqui de novo
          — isso é o que causava o círculo duplicado/deslocado no canto
          superior direito. O paddingRight extra abaixo só garante que o
          sino de notificação não fique colado embaixo do avatar flutuante. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingRight: 64, paddingTop: 12, paddingBottom: 8 }}>
        <View>
          <Text style={{ fontSize: 13, color: "#888" }}>Bom dia,</Text>
          <Text style={{ fontSize: 21, fontWeight: "700", color: "#111", marginTop: 1 }}>{displayName}</Text>
        </View>
        <TouchableOpacity
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#ECECEC",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="notifications-outline" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {/* Banner Evento — leva direto pra aba Agenda, onde dá pra trocar
            ou editar o evento ativo. */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onAbrirEvento}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFF0F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: "#CC0000" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#CC0000" }} />
            <View>
              <Text style={{ fontWeight: "700", fontSize: 14, color: "#CC0000" }}>{eventName}</Text>
              {EVENT.location ? (
                <Text style={{ fontSize: 12, color: "#888", marginTop: 1 }}>{EVENT.location}</Text>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CC0000" />
        </TouchableOpacity>

        {/* Cards Leads + Meta */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 18, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
            <MaterialCommunityIcons name="account-group-outline" size={20} color="#CC0000" style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#999", letterSpacing: 0.8 }}>LEADS HOJE</Text>
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#111", marginTop: 4 }}>{leadsHoje}</Text>
            <Text style={{ fontSize: 12, color: "#22C55E", fontWeight: "600", marginTop: 4 }}>{totalLeads} no total</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#CC0000", borderRadius: 14, padding: 18, shadowColor: "#CC0000", shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <MaterialCommunityIcons name="target" size={18} color="#fff" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)", letterSpacing: 0.8 }}>META DO EVENTO</Text>
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#fff", marginTop: 4 }}>{eventMeta}</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{Math.max(eventMeta - totalLeads, 0)} restantes</Text>
          </View>
        </View>

        {/* Progresso */}
        <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: "#111" }}>Progresso — {eventName}</Text>
            <Text style={{ fontWeight: "700", fontSize: 14, color: "#CC0000" }}>
              {Math.min(Math.round((totalLeads / eventMeta) * 100), 100)}%
            </Text>
          </View>
          <View style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
            <View style={{ height: "100%", width: `${Math.min((totalLeads / eventMeta) * 100, 100)}%`, backgroundColor: "#CC0000", borderRadius: 3 }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: "#999" }}>{totalLeads} de {eventMeta} leads</Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Encerra: {EVENT.encerramento}</Text>
          </View>
        </View>

        {/* Search — logo acima de Leads Recentes, já que é ela quem filtra
            essa lista */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
          <Feather name="search" size={16} color="#AAA" style={{ marginRight: 8 }} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Buscar leads, empresas..." placeholderTextColor="#BBB" style={{ flex: 1, fontSize: 14, color: "#333" }} />
          {search !== "" && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>

        {/* Leads Recentes / Resultados da busca */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#111" }}>
              {buscaAtiva ? "Resultados da busca" : "Leads Recentes"}
            </Text>
            {!buscaAtiva && (
              <TouchableOpacity onPress={onVerTodos}>
                <Text style={{ fontSize: 13, color: "#CC0000", fontWeight: "600" }}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>
          {leadsCard.length === 0 ? (
            <Text style={{ fontSize: 13, color: "#BBB", textAlign: "center", paddingVertical: 24 }}>
              {buscaAtiva ? "Nenhum lead encontrado" : "Nenhum lead cadastrado ainda"}
            </Text>
          ) : (
            leadsCard.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onPress={() => {
                  const original = todosLeads.find((l) => l.id === lead.id);
                  if (!original) return;

                  // Leads já sincronizados com o IFS não podem mais ser
                  // editados — aqui (diferente da tela de Leads, onde eles
                  // simplesmente não aparecem) o card ainda é exibido pra
                  // dar visibilidade do que já foi feito, então só
                  // bloqueamos a abertura do formulário de edição.
                  if (original.status === "sync") {
                    Alert.alert(
                      "Lead sincronizado",
                      "Este lead já foi sincronizado com o IFS e não pode ser editado."
                    );
                    return;
                  }

                  onLeadPress?.(original);
                }}
              />
            ))
          )}
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
