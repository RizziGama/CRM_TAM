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
import { EventoLead, getEventoSelecionadoCache } from "./ifsService";

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

// ─── Props ───────────────────────────────────────────────────────────────────

interface DashboardProps {
  onLeadPress?: (lead: LeadLocal) => void;
  onVerTodos?: () => void;
  onAbrirEvento?: () => void;
  userInfo?: AzureUserInfo | null;
}

// ─── Meta de fallback ─────────────────────────────────────────────────────────
const META_FALLBACK = 15;

const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function formatarDataEvento(dataISO: string | undefined): string {
  if (!dataISO) return "—";
  const partes = dataISO.split("-");
  if (partes.length !== 3) return dataISO;
  const [ano, mes, dia] = partes;
  const mesIdx = parseInt(mes, 10) - 1;
  const mesLabel = MESES_ABREV[mesIdx] ?? mes;
  return `${dia} ${mesLabel} ${ano}`;
}

// ─── Gráficos de Perfil ────────────────────────────────────────────────────────

type Potencial = "Alto" | "Médio" | "Baixo";

const SEGMENTOS_CONFIG: Record<string, string> = {
  Financeiro:     "#CC0000",
  Energia:        "#F59E0B",
  Agronegócio:    "#22C55E",
  Tecnologia:     "#6366F1",
  Saúde:          "#06B6D4",
  Infraestrutura: "#111111",
};

const POTENCIAL_CONFIG: Record<Potencial, string> = {
  Alto:  "#22C55E",
  Médio: "#F59E0B",
  Baixo: "#CC0000",
};

function normalizaPotencial(valor: string | undefined): Potencial {
  if (valor === "Alto" || valor === "Médio" || valor === "Baixo") return valor;
  return "Médio";
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

// ─── Donut Chart (pure RN, sem libs) ─────────────────────────────────────────

function ArcSlice({ color, size, strokeWidth, startAngle, sweepAngle }: {
  color: string; size: number; strokeWidth: number; startAngle: number; sweepAngle: number;
}) {
  if (sweepAngle <= 0) return null;
  const half = size / 2;

  const renderHalf = (start: number, sweep: number, key: string) => {
    if (sweep <= 0) return null;
    const clipped = Math.min(sweep, 180);
    return (
      <View key={key} style={{ position:"absolute", width:size, height:size, overflow:"hidden", transform:[{ rotate:`${start}deg` }] }}>
        <View style={{ width:size, height:half, overflow:"hidden" }}>
          <View style={{ width:size, height:size, borderRadius:half, borderWidth:strokeWidth, borderColor:color, transform:[{ rotate:`${clipped - 180}deg` }] }} />
        </View>
      </View>
    );
  };

  if (sweepAngle <= 180) {
    const el = renderHalf(startAngle, sweepAngle, "a");
    return el ? <>{el}</> : null;
  }
  const el1 = renderHalf(startAngle, 180, "a");
  const el2 = renderHalf(startAngle + 180, sweepAngle - 180, "b");
  return <>{el1}{el2}</>;
}

function DonutChart({ total, slices }: { total: number; slices: { color: string; count: number }[] }) {
  const SIZE = 130;
  const R = 46;
  const STROKE = 20;
  const CIRCUM = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices.map((s) => {
    const dash = (s.count / total) * CIRCUM;
    const arc = { ...s, startAngle: (offset / CIRCUM) * 360, sweepAngle: (dash / CIRCUM) * 360 };
    offset += dash;
    return arc;
  });

  return (
    <View style={{ width:SIZE, height:SIZE, alignItems:"center", justifyContent:"center" }}>
      {arcs.map((a, i) => (
        <ArcSlice key={i} color={a.color} size={SIZE} strokeWidth={STROKE} startAngle={a.startAngle} sweepAngle={a.sweepAngle} />
      ))}
      <View style={{ position:"absolute", width:SIZE - STROKE * 2 - 6, height:SIZE - STROKE * 2 - 6, borderRadius:(SIZE - STROKE * 2 - 6) / 2, backgroundColor:"#fff", alignItems:"center", justifyContent:"center" }}>
        <Text style={{ fontSize:22, fontWeight:"800", color:"#111" }}>{total}</Text>
        <Text style={{ fontSize:9, color:"#999", fontWeight:"600", letterSpacing:0.5 }}>LEADS</Text>
      </View>
    </View>
  );
}

// ─── Barra de potencial ───────────────────────────────────────────────────────

function PotencialBar({ leads }: { leads: LeadLocal[] }) {
  const total = leads.length;
  const counts = { Alto: 0, Médio: 0, Baixo: 0 } as Record<Potencial, number>;
  leads.forEach((l) => counts[normalizaPotencial(l.potencial)]++);

  return (
    <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1, marginTop:12 }}>
      <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:14 }}>
        <Ionicons name="star-outline" size={17} color="#F59E0B" />
        <Text style={{ fontSize:14, fontWeight:"700", color:"#111" }}>Potencial dos Leads</Text>
      </View>

      {total === 0 ? (
        <Text style={{ fontSize:13, color:"#BBB", textAlign:"center", paddingVertical:12 }}>
          Nenhum lead cadastrado ainda
        </Text>
      ) : (
        <>
          <View style={{ flexDirection:"row", height:10, borderRadius:6, overflow:"hidden", marginBottom:12 }}>
            {(["Alto","Médio","Baixo"] as Potencial[]).map((p) => {
              const pct = total > 0 ? (counts[p] / total) * 100 : 0;
              return pct > 0 ? (
                <View key={p} style={{ width:`${pct}%` as any, backgroundColor:POTENCIAL_CONFIG[p] }} />
              ) : null;
            })}
          </View>

          <View style={{ flexDirection:"row", gap:20 }}>
            {(["Alto","Médio","Baixo"] as Potencial[]).map((p) => (
              <View key={p} style={{ flexDirection:"row", alignItems:"center", gap:5 }}>
                <View style={{ width:8, height:8, borderRadius:4, backgroundColor:POTENCIAL_CONFIG[p] }} />
                <Text style={{ fontSize:13, color:"#555" }}>{p}</Text>
                <Text style={{ fontSize:13, fontWeight:"700", color:"#111" }}>{counts[p]}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Card Segmentos de Mercado ─────────────────────────────────────────────────

function SegmentosCard({ leads }: { leads: LeadLocal[] }) {
  const segCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const seg = l.segmento || l.mercado || "—";
    segCounts[seg] = (segCounts[seg] || 0) + 1;
  });

  const donutSlices = Object.entries(segCounts).map(([seg, count]) => ({
    color: SEGMENTOS_CONFIG[seg] ?? "#999",
    count,
    label: seg,
  }));

  const total = leads.length;

  return (
    <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1 }}>
      <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:16 }}>
        <MaterialCommunityIcons name="chart-bar" size={17} color="#CC0000" />
        <Text style={{ fontSize:14, fontWeight:"700", color:"#111" }}>Segmentos de Mercado</Text>
      </View>

      {total === 0 ? (
        <Text style={{ fontSize:13, color:"#BBB", textAlign:"center", paddingVertical:12 }}>
          Nenhum lead cadastrado ainda
        </Text>
      ) : (
        <View style={{ flexDirection:"row", alignItems:"center", gap:20 }}>
          <DonutChart total={total} slices={donutSlices} />

          <View style={{ flex:1, gap:8 }}>
            {donutSlices.map((s) => (
              <View key={s.label} style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:7 }}>
                  <View style={{ width:10, height:10, borderRadius:5, backgroundColor:s.color }} />
                  <Text style={{ fontSize:13, color:"#444" }}>{s.label}</Text>
                </View>
                <Text style={{ fontSize:13, fontWeight:"700", color:"#111" }}>{s.count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

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

  const carregarEvento = useCallback(async () => {
    try {
      const cache = await getEventoSelecionadoCache();
      setEventoAtual(cache);
    } catch (err) {
      console.warn("[DashboardScreen] Falha ao carregar evento selecionado:", err);
    }
  }, []);

  useEffect(() => {
    carregarEvento();
  }, [carregarEvento]);

  useEffect(() => {
    if (userInfoProp) return;

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
  const displayName = userInfo?.name ?? "Usuário";

  const carregarLeadsRecentes = useCallback(async () => {
    const todos = await listarLeadsLocais();
    const hojeStr = new Date().toLocaleDateString("pt-BR");

    setTotalLeads(todos.length);
    setLeadsHoje(todos.filter((l) => l.dataCriacao === hojeStr).length);
    setLeadsRecentes(todos.slice(0, 3));
    setTodosLeads(todos);
  }, []);

  useEffect(() => {
    carregarLeadsRecentes();
  }, [carregarLeadsRecentes]);

  // Sem busca: mostra só os 3 leads mais recentes (comportamento original).
  // Com busca: filtra por empresa/contato sobre TODOS os leads — mesmo
  // padrão de busca usado na LeadsScreen, não fica limitado aos 3 recentes.
  const leadsBase = search.trim() === ""
    ? leadsRecentes
    : todosLeads.filter((lead) => {
        const termo = search.toLowerCase();
        return (
          (lead.nomeEmpresa || "").toLowerCase().includes(termo) ||
          (lead.nomeContato || "").toLowerCase().includes(termo)
        );
      });

  const leadsCard = leadsBase.map(paraCardResumido);

  const metaEvento = eventoAtual?.metaLeads && eventoAtual.metaLeads > 0 ? eventoAtual.metaLeads : META_FALLBACK;
  const restantesEvento = Math.max(metaEvento - totalLeads, 0);
  const progressoEvento = totalLeads > 0 ? Math.min(Math.round((totalLeads / metaEvento) * 100), 100) : 0;

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

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingRight: 64, paddingTop: 12, paddingBottom: 8 }}>
        <View>
          <Text style={{ fontSize: 13, color: "#888" }}>Bom dia,</Text>
          <Text style={{ fontSize: 21, fontWeight: "700", color: "#111", marginTop: 1 }}>{displayName}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        {/* Banner Evento */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onAbrirEvento}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFF0F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: "#CC0000" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#CC0000" }} />
            <View>
              <Text style={{ fontWeight: "700", fontSize: 14, color: "#CC0000" }} numberOfLines={1}>
                {eventoAtual?.nome ?? "Selecionar evento"}
              </Text>
              <Text style={{ fontSize: 12, color: "#888", marginTop: 1 }} numberOfLines={1}>
                {eventoAtual?.observacao || formatarDataEvento(eventoAtual?.dataEvento)}
              </Text>
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
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#fff", marginTop: 4 }}>{metaEvento}</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{restantesEvento} restantes</Text>
          </View>
        </View>

        {/* Progresso */}
        <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: "#111" }} numberOfLines={1}>
              Progresso — {eventoAtual?.nome ?? "Selecionar evento"}
            </Text>
            <Text style={{ fontWeight: "700", fontSize: 14, color: "#CC0000" }}>
              {progressoEvento}%
            </Text>
          </View>
          <View style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
            <View style={{ height: "100%", width: `${progressoEvento}%`, backgroundColor: "#CC0000", borderRadius: 3 }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: "#999" }}>{totalLeads} de {metaEvento} leads</Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Encerra: {formatarDataEvento(eventoAtual?.dataEvento)}</Text>
          </View>
        </View>

        {/* Perfil de Clientes (Segmentos + Potencial) */}
        <View style={{ marginBottom: 20 }}>
          <SegmentosCard leads={todosLeads} />
          <PotencialBar leads={todosLeads} />
        </View>

        {/* Search — agora abaixo da barra de Potencial. Funciona igual à
            busca da LeadsScreen: filtra por empresa/contato e mostra um
            botão de limpar (X) quando há texto digitado. */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
            <Feather name="search" size={16} color="#AAA" style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar leads, empresas..."
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

        {/* Leads Recentes / Resultado da busca */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#111" }}>
              {search.trim() === "" ? "Leads Recentes" : `Resultado (${leadsCard.length})`}
            </Text>
            {search.trim() === "" && (
              <TouchableOpacity onPress={onVerTodos}>
                <Text style={{ fontSize: 13, color: "#CC0000", fontWeight: "600" }}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>
          {leadsCard.length === 0 ? (
            <Text style={{ fontSize: 13, color: "#BBB", textAlign: "center", paddingVertical: 24 }}>
              {search.trim() === "" ? "Nenhum lead cadastrado ainda" : "Nenhum lead encontrado"}
            </Text>
          ) : (
            leadsCard.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onPress={() => {
                  const original = leadsBase.find((l) => l.id === lead.id);
                  if (!original) return;

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