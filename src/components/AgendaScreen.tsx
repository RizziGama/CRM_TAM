import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
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
import { LeadLocal, LeadStatus, listarLeadsLocais } from "./leadsStore";

// ─── Dados do Evento ──────────────────────────────────────────────────────────
//
// Só o que NÃO é derivado de leads fica fixo aqui (nome/local/datas do
// evento em si). Os números de leads (feitos, meta batida, sync/pendente/
// erro, progresso) vêm todos do leadsStore agora — nada de mock.

const EVENTO_INFO = {
  nome: "EBACE 2026",
  subtitulo: "European Business Aviation Convention",
  local: "Palexpo — Genebra · Genebra, Suíça",
  datas: "22–25 JUN 2026",
};

// Meta de leads do evento. Não existe (ainda) um lugar no backend/IFS de
// onde ler essa meta, então continua como constante local — mas os
// valores "batidos até agora" já são 100% reais.
const META_EVENTO = 15;

type Potencial = "Alto" | "Médio" | "Baixo";
type TabEvento = "resumo" | "leads" | "perfil";

interface LeadEventoCard {
  id: string;
  initials: string;
  bgColor: string;
  empresa: string;
  badge: string;
  contato: string;
  status: LeadStatus;
  segmento: string;
  potencial: Potencial;
}

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

const CORES_AVATAR = ["#2D2D2D", "#1A1A2E", "#1C3A1C", "#1A1A5E", "#3A1A1A", "#4A1A3A", "#1A3A3A"];

// ─── Helpers de exibição (mesmo padrão de LeadsScreen/DashboardScreen) ────────

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

// Garante que o potencial gravado no lead (string livre no LeadLocal) caia
// em uma das 3 categorias conhecidas — evita quebrar o donut/barra caso
// venha algo inesperado.
function normalizaPotencial(valor: string | undefined): Potencial {
  if (valor === "Alto" || valor === "Médio" || valor === "Baixo") return valor;
  return "Médio";
}

function paraCardEvento(lead: LeadLocal): LeadEventoCard {
  return {
    id: lead.id,
    initials: iniciaisEmpresa(lead.nomeEmpresa || "??"),
    bgColor: corParaNome(lead.nomeEmpresa || lead.id),
    empresa: lead.nomeEmpresa || "(Sem nome)",
    badge: lead.ifsLeadId ? `IFS #${lead.ifsLeadId}` : lead.cnpj || "S/ CNPJ",
    contato: lead.nomeContato || "—",
    status: lead.status,
    segmento: lead.segmento || lead.mercado || "—",
    potencial: normalizaPotencial(lead.potencial),
  };
}

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
      {/* Centro */}
      <View style={{ position:"absolute", width:SIZE - STROKE * 2 - 6, height:SIZE - STROKE * 2 - 6, borderRadius:(SIZE - STROKE * 2 - 6) / 2, backgroundColor:"#fff", alignItems:"center", justifyContent:"center" }}>
        <Text style={{ fontSize:22, fontWeight:"800", color:"#111" }}>{total}</Text>
        <Text style={{ fontSize:9, color:"#999", fontWeight:"600", letterSpacing:0.5 }}>LEADS</Text>
      </View>
    </View>
  );
}

// ─── Barra de potencial ───────────────────────────────────────────────────────

function PotencialBar({ leads }: { leads: LeadEventoCard[] }) {
  const total = leads.length;
  const counts = { Alto: 0, Médio: 0, Baixo: 0 } as Record<Potencial, number>;
  leads.forEach((l) => counts[l.potencial]++);

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
          {/* Barra segmentada */}
          <View style={{ flexDirection:"row", height:10, borderRadius:6, overflow:"hidden", marginBottom:12 }}>
            {(["Alto","Médio","Baixo"] as Potencial[]).map((p) => {
              const pct = total > 0 ? (counts[p] / total) * 100 : 0;
              return pct > 0 ? (
                <View key={p} style={{ width:`${pct}%` as any, backgroundColor:POTENCIAL_CONFIG[p] }} />
              ) : null;
            })}
          </View>

          {/* Legenda */}
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

// ─── Aba: Leads do Evento ─────────────────────────────────────────────────────
//
// Mesma regra da tela de Leads: só aparecem aqui leads que ainda NÃO foram
// sincronizados com o IFS ("pendente"/"erro"). Leads "sync" já estão
// consolidados no IFS e não podem mais ser editados — por isso não entram
// nessa listagem (e não há como abrir edição deles a partir daqui).

function TabLeads({
  leads,
  onLeadPress,
}: {
  leads: LeadEventoCard[];
  onLeadPress: (id: string) => void;
}) {
  const statusCfg: Record<Exclude<LeadStatus, "sync">, { icon: string; color: string; label: string; bg: string }> = {
    pendente: { icon:"time-outline",         color:"#F59E0B", label:"Pend.", bg:"#FFFBEB" },
    erro:     { icon:"alert-circle-outline", color:"#CC0000", label:"Erro",  bg:"#FFF0F0" },
  };

  if (leads.length === 0) {
    return (
      <View style={{ alignItems:"center", paddingTop:60 }}>
        <Ionicons name="checkmark-done-circle-outline" size={48} color="#DDD" />
        <Text style={{ color:"#BBB", marginTop:12, fontSize:14, textAlign:"center" }}>
          Nenhum lead pendente ou com erro{"\n"}neste evento
        </Text>
      </View>
    );
  }

  return (
    <>
      {leads.map((lead) => {
        const cfg = statusCfg[lead.status as Exclude<LeadStatus, "sync">];
        return (
          <TouchableOpacity
            key={lead.id}
            onPress={() => onLeadPress(lead.id)}
            activeOpacity={0.75}
            style={{ backgroundColor:"#fff", borderRadius:14, paddingHorizontal:16, paddingVertical:14, marginBottom:10, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1 }}
          >
            <View style={{ flexDirection:"row", alignItems:"center" }}>
              {/* Avatar */}
              <View style={{ width:44, height:44, borderRadius:22, backgroundColor:lead.bgColor, alignItems:"center", justifyContent:"center", marginRight:12 }}>
                <Text style={{ color:"#fff", fontWeight:"700", fontSize:15 }}>{lead.initials}</Text>
              </View>

              {/* Info */}
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                  <Text style={{ fontSize:14, fontWeight:"800", color:"#111" }} numberOfLines={1}>{lead.empresa}</Text>
                  <View style={{ backgroundColor:"#F0F0F0", borderRadius:6, paddingHorizontal:6, paddingVertical:2 }}>
                    <Text style={{ fontSize:10, fontWeight:"700", color:"#888" }}>{lead.badge}</Text>
                  </View>
                </View>
                <Text style={{ fontSize:12, color:"#888", marginTop:2 }}>{lead.contato}</Text>
              </View>

              {/* Status badge */}
              <View style={{ flexDirection:"row", alignItems:"center", gap:4, backgroundColor:cfg.bg, borderRadius:8, paddingHorizontal:8, paddingVertical:4 }}>
                <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                <Text style={{ fontSize:11, fontWeight:"700", color:cfg.color }}>{cfg.label}</Text>
              </View>

              <Ionicons name="chevron-down" size={16} color="#CCC" style={{ marginLeft:8 }} />
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

// ─── Aba: Perfil Clientes ─────────────────────────────────────────────────────
//
// Análises (segmento/potencial) consideram TODOS os leads reais do evento,
// inclusive os já sincronizados — é uma visão agregada de reporte, não uma
// listagem editável, então não faz sentido excluir os sincronizados aqui.

function TabPerfil({ leads }: { leads: LeadEventoCard[] }) {
  const segCounts: Record<string, number> = {};
  leads.forEach((l) => {
    segCounts[l.segmento] = (segCounts[l.segmento] || 0) + 1;
  });

  const donutSlices = Object.entries(segCounts).map(([seg, count]) => ({
    color: SEGMENTOS_CONFIG[seg] ?? "#999",
    count,
    label: seg,
  }));

  const total = leads.length;

  return (
    <>
      {/* Card Segmentos */}
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
            {/* Donut */}
            <DonutChart total={total} slices={donutSlices} />

            {/* Legenda */}
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

      {/* Card Potencial */}
      <PotencialBar leads={leads} />
    </>
  );
}

// ─── Header escuro (fixo) ─────────────────────────────────────────────────────

interface EventoStats {
  leadsFeitos: number;
  metaTotal: number;
  progresso: number;
  sync: number;
  pendente: number;
  erro: number;
}

function EventoHeader({
  tab,
  onTabChange,
  stats,
}: {
  tab: TabEvento;
  onTabChange: (t: TabEvento) => void;
  stats: EventoStats;
}) {
  const LABELS: Record<TabEvento, string> = { resumo:"Resumo", leads:"Leads", perfil:"Perfil Clientes" };
  return (
    <View style={{ backgroundColor:"#111", paddingHorizontal:20, paddingTop:12, paddingBottom:0 }}>
      {/* Topo */}
      <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <Text style={{ fontSize:11, fontWeight:"700", color:"#888", letterSpacing:1, textTransform:"uppercase" }}>
          EVENTO ATIVO · {EVENTO_INFO.datas}
        </Text>
        <View style={{ flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#CC0000", borderRadius:20, paddingHorizontal:10, paddingVertical:4 }}>
          <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#fff" }} />
          <Text style={{ fontSize:11, fontWeight:"700", color:"#fff" }}>AO VIVO</Text>
        </View>
      </View>

      <Text style={{ fontSize:28, fontWeight:"800", color:"#fff", marginBottom:4 }}>{EVENTO_INFO.nome}</Text>
      <Text style={{ fontSize:13, color:"#AAA", marginBottom:8 }}>{EVENTO_INFO.subtitulo}</Text>
      <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:16 }}>
        <Ionicons name="location-outline" size={14} color="#888" />
        <Text style={{ fontSize:12, color:"#888" }}>{EVENTO_INFO.local}</Text>
      </View>

      <TouchableOpacity style={{ flexDirection:"row", alignItems:"center", gap:8, backgroundColor:"#222", borderRadius:24, paddingHorizontal:16, paddingVertical:10, alignSelf:"flex-start", marginBottom:16, borderWidth:1, borderColor:"#333" }}>
        <MaterialCommunityIcons name="pencil-outline" size={15} color="#ccc" />
        <Text style={{ fontSize:13, fontWeight:"600", color:"#ccc" }}>Alterar evento</Text>
        <Ionicons name="chevron-down" size={14} color="#888" />
      </TouchableOpacity>

      {/* Progresso */}
      <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:8 }}>
        <Text style={{ fontSize:13, color:"#AAA" }}>{stats.leadsFeitos} de {stats.metaTotal} leads</Text>
        <Text style={{ fontSize:13, fontWeight:"700", color:"#CC0000" }}>{stats.progresso}%</Text>
      </View>
      <View style={{ height:5, backgroundColor:"#333", borderRadius:3, overflow:"hidden", marginBottom:16 }}>
        <View style={{ height:"100%", width:`${stats.progresso}%`, backgroundColor:"#CC0000", borderRadius:3 }} />
      </View>

      {/* Stats */}
      <View style={{ flexDirection:"row", gap:10, marginBottom:20 }}>
        {[
          { value:stats.sync,     label:"Sync",  color:"#22C55E" },
          { value:stats.pendente, label:"Pend.", color:"#F59E0B" },
          { value:stats.erro,     label:"Erro",  color:"#CC0000" },
          { value:stats.metaTotal, label:"Meta", color:"#888"    },
        ].map((s) => (
          <View key={s.label} style={{ flex:1, backgroundColor:"#1C1C1C", borderRadius:12, paddingVertical:12, alignItems:"center", gap:4 }}>
            <Text style={{ fontSize:20, fontWeight:"800", color:s.color }}>{s.value}</Text>
            <Text style={{ fontSize:11, color:"#666" }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={{ flexDirection:"row", borderBottomWidth:1, borderBottomColor:"#222" }}>
        {(["resumo","leads","perfil"] as TabEvento[]).map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => onTabChange(t)}
              style={{ marginRight:20, paddingBottom:10, borderBottomWidth:active ? 2 : 0, borderBottomColor:"#fff" }}
            >
              <Text style={{ fontSize:14, fontWeight:active ? "700" : "400", color:active ? "#fff" : "#666" }}>
                {LABELS[t]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Tela Principal ───────────────────────────────────────────────────────────

export default function AgendaScreen() {
  const [tab, setTab] = useState<TabEvento>("resumo");
  const [novoLeadVisible, setNovoLeadVisible] = useState(false);
  const [leadEditando, setLeadEditando] = useState<LeadLocal | null>(null);
  const [leads, setLeads] = useState<LeadLocal[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarLeads = useCallback(async () => {
    const lista = await listarLeadsLocais();
    setLeads(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregarLeads();
  }, [carregarLeads]);

  // Cards derivados dos leads reais (todos, pra estatísticas/perfil).
  const leadsCard = leads.map(paraCardEvento);

  // Só os não sincronizados entram na aba "Leads" (editável).
  const leadsEditaveis = leadsCard.filter((l) => l.status !== "sync");

  const total = leads.length;
  const syncCount = leads.filter((l) => l.status === "sync").length;
  const pendenteCount = leads.filter((l) => l.status === "pendente").length;
  const erroCount = leads.filter((l) => l.status === "erro").length;
  const progresso = total > 0 ? Math.min(Math.round((total / META_EVENTO) * 100), 100) : 0;

  const stats: EventoStats = {
    leadsFeitos: total,
    metaTotal: META_EVENTO,
    progresso,
    sync: syncCount,
    pendente: pendenteCount,
    erro: erroCount,
  };

  const handleLeadPress = (id: string) => {
    const original = leads.find((l) => l.id === id);
    if (!original) return;

    // Defesa extra: como `leadsEditaveis` já filtra os sincronizados, isso
    // na prática nunca deveria disparar — mas mantemos o aviso por
    // segurança, igual ao padrão usado no Dashboard.
    if (original.status === "sync") {
      Alert.alert(
        "Lead sincronizado",
        "Este lead já foi sincronizado com o IFS e não pode ser editado."
      );
      return;
    }

    setLeadEditando(original);
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:"#111" }}>
      <StatusBar barStyle="light-content" backgroundColor="#111" />

      {/* Modais */}
      <Modal visible={novoLeadVisible} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          onClose={() => setNovoLeadVisible(false)}
          onSave={() => {
            setNovoLeadVisible(false);
            carregarLeads();
          }}
        />
      </Modal>
      <Modal visible={leadEditando !== null} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          mode="editar"
          initialData={leadEditando ?? undefined}
          onClose={() => setLeadEditando(null)}
          onSave={() => {
            setLeadEditando(null);
            carregarLeads();
          }}
        />
      </Modal>

      {/* Header fixo escuro */}
      <EventoHeader tab={tab} onTabChange={setTab} stats={stats} />

      {/* Conteúdo rolável branco */}
      {carregando ? (
        <View style={{ flex:1, backgroundColor:"#F4F4F6", alignItems:"center", justifyContent:"center" }}>
          <ActivityIndicator size="large" color="#CC0000" />
        </View>
      ) : (
        <ScrollView
          style={{ flex:1, backgroundColor:"#F4F4F6" }}
          contentContainerStyle={{ padding:16, paddingBottom:100 }}
          showsVerticalScrollIndicator={false}
        >
          {tab === "resumo" && (
            <>
              {/* Meta */}
              <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16, marginBottom:12, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1 }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:16 }}>
                  <MaterialCommunityIcons name="target" size={18} color="#CC0000" />
                  <Text style={{ fontSize:14, fontWeight:"700", color:"#111" }}>Meta do Evento</Text>
                </View>
                <View style={{ flexDirection:"row" }}>
                  {[
                    { value:stats.leadsFeitos,                         label:"Capturados", color:"#CC0000" },
                    { value:stats.metaTotal,                           label:"Meta Total", color:"#111"   },
                    { value:Math.max(stats.metaTotal - stats.leadsFeitos, 0), label:"Restantes",  color:"#22C55E" },
                  ].map((item, i) => (
                    <View key={item.label} style={{ flex:1, alignItems:"center", borderLeftWidth:i>0?1:0, borderLeftColor:"#F0F0F0" }}>
                      <Text style={{ fontSize:28, fontWeight:"800", color:item.color }}>{item.value}</Text>
                      <Text style={{ fontSize:12, color:"#999", marginTop:4 }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Sync IFS */}
              <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1 }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:16 }}>
                  <MaterialCommunityIcons name="sync" size={18} color="#555" />
                  <Text style={{ fontSize:14, fontWeight:"700", color:"#111" }}>Status de Sincronização IFS</Text>
                </View>
                {[
                  { icon:"checkmark-circle",     color:"#22C55E", label:"Sincronizados com IFS",    value:stats.sync },
                  { icon:"time-outline",         color:"#F59E0B", label:"Aguardando Sincronização", value:stats.pendente },
                  { icon:"alert-circle-outline", color:"#CC0000", label:"Erro — Requer Atenção",    value:stats.erro },
                ].map((item) => (
                  <View key={item.label} style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingVertical:12, borderTopWidth:1, borderTopColor:"#F5F5F5" }}>
                    <View style={{ flexDirection:"row", alignItems:"center", gap:10 }}>
                      <Ionicons name={item.icon as any} size={18} color={item.color} />
                      <Text style={{ fontSize:14, color:"#444" }}>{item.label}</Text>
                    </View>
                    <Text style={{ fontSize:15, fontWeight:"700", color:item.color }}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {tab === "leads" && <TabLeads leads={leadsEditaveis} onLeadPress={handleLeadPress} />}

          {tab === "perfil" && <TabPerfil leads={leadsCard} />}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setNovoLeadVisible(true)}
        style={{ position:"absolute", bottom:24, right:20, width:54, height:54, borderRadius:27, backgroundColor:"#CC0000", alignItems:"center", justifyContent:"center", shadowColor:"#CC0000", shadowOpacity:0.45, shadowRadius:10, elevation:6 }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
