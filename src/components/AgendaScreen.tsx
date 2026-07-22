import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import NovoLeadScreen from "./NovoLeadScreen";
import { LeadLocal, LeadStatus, listarLeadsLocais } from "./leadsStore";
import {
  EventoLead,
  buscarEventosIFS,
  cacheEventoSelecionado,
  getEventoSelecionadoCache,
  getMapaCoresMercados, 
  corMercado
} from "./ifsService";


// ─── Meta de fallback ─────────────────────────────────────────────────────────
//
// Usada só enquanto nenhum evento foi carregado/selecionado ainda (ex.: sem
// rede na primeira abertura). Assim que a lista de eventos do IFS carrega,
// a meta real do evento selecionado (Cf_Meta_Leasds) passa a valer.
const META_FALLBACK = 15;

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
  mercado: string;
  potencial: Potencial;
}

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
    mercado: lead.mercado || "—",
    potencial: normalizaPotencial(lead.potencial),
  };
}

// "YYYY-MM-DD" → "DD MMM YYYY" (ex.: "04 AGO 2026"). Aceita vazio/valores
// inválidos e cai num traço em vez de quebrar a tela.
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

// ─── Donut Chart (react-native-svg) ──────────────────────────────────────────
// Antes, cada fatia era desenhada como um "anel" opaco completo, recortado com
// overflow:hidden e rotacionado — o que fazia cada fatia nova cobrir por cima
// as anteriores, deixando só a última cor visível. Aqui cada fatia é um traço
// real de arco (strokeDasharray/strokeDashoffset em um <Circle> de SVG), então
// elas se somam corretamente ao redor do círculo.

function DonutChart({ total, slices }: { total: number; slices: { color: string; count: number }[] }) {
  const SIZE = 130;
  const STROKE = 20;
  const R = (SIZE - STROKE) / 2;
  const CIRCUM = 2 * Math.PI * R;

  let offset = 0;
  const arcs = slices.map((s) => {
    const dash = total > 0 ? (s.count / total) * CIRCUM : 0;
    const arc = { ...s, dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* trilho de fundo */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="#F0F0F0"
          strokeWidth={STROKE}
          fill="none"
        />
        {arcs.map((a, i) => (
          a.dash > 0 ? (
            <Circle
              key={i}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={a.color}
              strokeWidth={STROKE}
              strokeDasharray={`${a.dash} ${CIRCUM - a.dash}`}
              strokeDashoffset={-a.offset}
              fill="none"
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
              strokeLinecap="butt"
            />
          ) : null
        ))}
      </Svg>
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
  const statusCfg: Record<LeadStatus, { icon: string; color: string; label: string; bg: string }> = {
    sync:     { icon:"checkmark-circle",     color:"#22C55E", label:"Sync",  bg:"#F0FDF4" },
    pendente: { icon:"time-outline",         color:"#F59E0B", label:"Pend.", bg:"#FFFBEB" },
    erro:     { icon:"alert-circle-outline", color:"#CC0000", label:"Erro",  bg:"#FFF0F0" },
  };

  if (leads.length === 0) {
    return (
      <View style={{ alignItems:"center", paddingTop:60 }}>
        <Ionicons name="people-outline" size={48} color="#DDD" />
        <Text style={{ color:"#BBB", marginTop:12, fontSize:14, textAlign:"center" }}>
          Nenhum lead cadastrado{"\n"}neste evento
        </Text>
      </View>
    );
  }

  return (
    <>
      {leads.map((lead) => {
        const cfg = statusCfg[lead.status];
        return (
          <TouchableOpacity
            key={lead.id}
            onPress={() => onLeadPress(lead.id)}
            activeOpacity={0.75}
            style={{ backgroundColor:"#fff", borderRadius:14, paddingHorizontal:16, paddingVertical:14, marginBottom:10, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1 }}
          >
            <View style={{ flexDirection:"row", alignItems:"center" }}>
              <View style={{ width:44, height:44, borderRadius:22, backgroundColor:lead.bgColor, alignItems:"center", justifyContent:"center", marginRight:12 }}>
                <Text style={{ color:"#fff", fontWeight:"700", fontSize:15 }}>{lead.initials}</Text>
              </View>

              <View style={{ flex:1 }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                  <Text style={{ fontSize:14, fontWeight:"800", color:"#111" }} numberOfLines={1}>{lead.empresa}</Text>
                  <View style={{ backgroundColor:"#F0F0F0", borderRadius:6, paddingHorizontal:6, paddingVertical:2 }}>
                    <Text style={{ fontSize:10, fontWeight:"700", color:"#888" }}>{lead.badge}</Text>
                  </View>
                </View>
                <Text style={{ fontSize:12, color:"#888", marginTop:2 }}>{lead.contato}</Text>
              </View>

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
function TabPerfil({ leads, coresMercado }: { leads: LeadEventoCard[]; coresMercado: Record<string, string> }) {
  const mercadoCounts: Record<string, number> = {};
  leads.forEach((l) => {
    mercadoCounts[l.mercado] = (mercadoCounts[l.mercado] || 0) + 1;
  });

  const donutSlices = Object.entries(mercadoCounts).map(([mercado, count]) => ({
    color: corMercado(coresMercado, mercado),
    count,
    label: mercado,
  }));

  const total = leads.length;

  return (
    <>
      {/* Card Mercados */}
      <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1 }}>
        <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:16 }}>
          <MaterialCommunityIcons name="chart-bar" size={17} color="#CC0000" />
          <Text style={{ fontSize:14, fontWeight:"700", color:"#111" }}>Mercados</Text>
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

// ─── Modal: Seletor de Eventos ────────────────────────────────────────────────
//
// Lista os eventos vindos do IFS (EventosLeadsSet). Ao tocar num item, o
// evento vira o "ativo" da tela — a seleção fica salva localmente e volta a
// aparecer mesmo se o app for fechado e reaberto.

function SeletorEventoModal({
  visible,
  onClose,
  eventos,
  eventoAtual,
  carregando,
  onSelecionar,
}: {
  visible: boolean;
  onClose: () => void;
  eventos: EventoLead[];
  eventoAtual: EventoLead | null;
  carregando: boolean;
  onSelecionar: (evento: EventoLead) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: 20 }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: "#fff", borderRadius: 20, maxHeight: "70%", overflow: "hidden" }}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#111" }}>Selecionar Evento</Text>
            <Text style={{ fontSize: 12, color: "#999", marginTop: 2 }}>Eventos cadastrados no IFS</Text>
          </View>

          {carregando ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#CC0000" />
            </View>
          ) : eventos.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: "center", paddingHorizontal: 20 }}>
              <Ionicons name="calendar-outline" size={40} color="#DDD" />
              <Text style={{ color: "#BBB", marginTop: 10, fontSize: 13, textAlign: "center" }}>
                Nenhum evento encontrado no IFS
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {eventos.map((ev) => {
                const ativo = eventoAtual?.objkey === ev.objkey;
                return (
                  <TouchableOpacity
                    key={ev.objkey}
                    onPress={() => onSelecionar(ev)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: "#F5F5F5",
                      backgroundColor: ativo ? "#FFF5F5" : "#fff",
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#111" }} numberOfLines={1}>
                        {ev.nome}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                        {formatarDataEvento(ev.dataEvento)} · Meta: {ev.metaLeads}
                      </Text>
                      {ev.observacao ? (
                        <Text style={{ fontSize: 11, color: "#AAA", marginTop: 2 }} numberOfLines={1}>
                          {ev.observacao}
                        </Text>
                      ) : null}
                    </View>
                    {ativo && <Ionicons name="checkmark-circle" size={20} color="#CC0000" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
  eventoAtual,
  carregandoEventos,
  onAbrirSeletor,
}: {
  tab: TabEvento;
  onTabChange: (t: TabEvento) => void;
  stats: EventoStats;
  eventoAtual: EventoLead | null;
  carregandoEventos: boolean;
  onAbrirSeletor: () => void;
}) {
  const LABELS: Record<TabEvento, string> = { resumo:"Resumo", leads:"Leads", perfil:"Perfil Clientes" };
  return (
    <View style={{ backgroundColor:"#111", paddingHorizontal:20, paddingTop:20, paddingBottom:0 }}>
      {/* Nome do evento — clicável, abre a lista de eventos disponíveis */}
      <TouchableOpacity
        onPress={onAbrirSeletor}
        activeOpacity={0.7}
        style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:4 }}
      >
        {carregandoEventos && !eventoAtual ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ fontSize:28, fontWeight:"800", color:"#fff" }} numberOfLines={1}>
            {eventoAtual?.nome ?? "Selecionar evento"}
          </Text>
        )}
        <Ionicons name="chevron-down" size={20} color="#888" />
      </TouchableOpacity>

      {eventoAtual?.observacao ? (
        <Text style={{ fontSize:13, color:"#AAA", marginBottom:8 }} numberOfLines={2}>
          {eventoAtual.observacao}
        </Text>
      ) : null}

      <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:16 }}>
        <Ionicons name="calendar-outline" size={14} color="#888" />
        <Text style={{ fontSize:12, color:"#888" }}>{formatarDataEvento(eventoAtual?.dataEvento)}</Text>
      </View>

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

  // ── Eventos (IFS) ────────────────────────────────────────────────────────
  const [eventos, setEventos] = useState<EventoLead[]>([]);
  const [eventoAtual, setEventoAtual] = useState<EventoLead | null>(null);
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [seletorVisible, setSeletorVisible] = useState(false);
  const [coresMercado, setCoresMercado] = useState<Record<string, string>>({});

  const carregarLeads = useCallback(async () => {
    const lista = await listarLeadsLocais();
    setLeads(lista);
    setCarregando(false);
  }, []);

  // NOVO — só os leads do evento atualmente selecionado
  const leadsDoEvento = eventoAtual
    ? leads.filter((l) => l.eventoObjkey === eventoAtual.objkey)
    : [];

   useEffect(() => {
    getMapaCoresMercados().then(setCoresMercado);
  }, []);

  useEffect(() => {
    carregarLeads();
  }, [carregarLeads]);

  // Carrega o evento cacheado (última seleção do usuário) e, em paralelo,
  // busca a lista atual de eventos no IFS. Se ainda não houver nenhum
  // evento selecionado, assume o primeiro da lista retornada como padrão.
  const carregarEventos = useCallback(async () => {
    setCarregandoEventos(true);
    try {
      const [cache, lista] = await Promise.all([
        getEventoSelecionadoCache(),
        buscarEventosIFS(),
      ]);

      setEventos(lista);

      if (cache) {
        // Se o evento cacheado ainda existir na lista atual, usa a versão
        // mais recente vinda do IFS (meta/observação podem ter mudado);
        // senão, mantém o que estava salvo.
        const atualizado = lista.find((e) => e.objkey === cache.objkey);
        setEventoAtual(atualizado ?? cache);
      } else if (lista.length > 0) {
        setEventoAtual(lista[0]);
        await cacheEventoSelecionado(lista[0]);
      }
    } catch (err) {
      console.warn("[AgendaScreen] Falha ao carregar eventos:", err);
    } finally {
      setCarregandoEventos(false);
    }
  }, []);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  const handleSelecionarEvento = async (evento: EventoLead) => {
    setEventoAtual(evento);
    setSeletorVisible(false);
    try {
      await cacheEventoSelecionado(evento);
    } catch (err) {
      console.warn("[AgendaScreen] Falha ao salvar evento selecionado:", err);
    }
  };

  const handleAbrirSeletor = () => {
    setSeletorVisible(true);
    // Atualiza a lista toda vez que o seletor é aberto, garantindo que
    // eventos criados/alterados no IFS apareçam sem precisar sair da tela.
    carregarEventos();
  };

  // Cards derivados — agora só do evento
  const leadsCard = leadsDoEvento.map(paraCardEvento);  

 

  const total = leadsDoEvento.length;
  const syncCount = leadsDoEvento.filter((l) => l.status === "sync").length;
  const pendenteCount = leadsDoEvento.filter((l) => l.status === "pendente").length;
  const erroCount = leadsDoEvento.filter((l) => l.status === "erro").length;

  const metaTotal = eventoAtual?.metaLeads && eventoAtual.metaLeads > 0 ? eventoAtual.metaLeads : META_FALLBACK;
  const progresso = total > 0 ? Math.min(Math.round((total / metaTotal) * 100), 100) : 0;

  const stats: EventoStats = {
    leadsFeitos: total,
    metaTotal,
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

      {/* Modais de lead */}
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

      {/* Modal: seletor de eventos */}
      <SeletorEventoModal
        visible={seletorVisible}
        onClose={() => setSeletorVisible(false)}
        eventos={eventos}
        eventoAtual={eventoAtual}
        carregando={carregandoEventos}
        onSelecionar={handleSelecionarEvento}
      />

      {/* Header fixo escuro */}
      <EventoHeader
        tab={tab}
        onTabChange={setTab}
        stats={stats}
        eventoAtual={eventoAtual}
        carregandoEventos={carregandoEventos}
        onAbrirSeletor={handleAbrirSeletor}
      />

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

          {tab === "leads" && <TabLeads leads={leadsCard} onLeadPress={handleLeadPress} />}

          {tab === "perfil" && <TabPerfil leads={leadsCard} coresMercado={coresMercado} />}
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