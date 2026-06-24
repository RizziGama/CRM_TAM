import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import NovoLeadScreen from "./NovoLeadScreen";

// ─── Dados Mock ───────────────────────────────────────────────────────────────

const EVENTO = {
  nome: "EBACE 2026",
  subtitulo: "European Business Aviation Convention",
  local: "Palexpo — Genebra · Genebra, Suíça",
  datas: "22–25 JUN 2026",
  leadsFeitos: 6,
  metaTotal: 15,
  progresso: 40,
  sync: 3,
  pendente: 2,
  erro: 1,
  meta: 15,
};

type StatusLead = "sync" | "pendente" | "erro";
type Potencial  = "Alto" | "Médio" | "Baixo";
type TabEvento  = "resumo" | "leads" | "perfil";

interface LeadEvento {
  id: string;
  initials: string;
  bgColor: string;
  empresa: string;
  badge: string;
  contato: string;
  status: StatusLead;
  segmento: string;
  potencial: Potencial;
}

const LEADS_EVENTO: LeadEvento[] = [
  { id:"1", initials:"OR", bgColor:"#2D2D2D", empresa:"ORE INVESTPAR S/A",    badge:"VA12", contato:"ANTONIO SILVA",   status:"sync",     segmento:"Financeiro",     potencial:"Alto"  },
  { id:"2", initials:"GR", bgColor:"#1A1A2E", empresa:"GRUPO ALPHA EN...",    badge:"VA13", contato:"RENATA CAMPOS",   status:"pendente", segmento:"Energia",        potencial:"Médio" },
  { id:"3", initials:"MI", bgColor:"#1C3A1C", empresa:"MINERVA AGRO LTDA",   badge:"VA14", contato:"CARLOS EDUARDO",  status:"sync",     segmento:"Agronegócio",    potencial:"Alto"  },
  { id:"4", initials:"ST", bgColor:"#1A1A5E", empresa:"STELLAR TECH VEN...", badge:"VA15", contato:"AMANDA FERREIRA", status:"erro",     segmento:"Tecnologia",     potencial:"Médio" },
  { id:"5", initials:"BH", bgColor:"#3A1A2E", empresa:"BLUE HEALTH S/A",     badge:"VA16", contato:"MARCOS LIMA",     status:"sync",     segmento:"Saúde",          potencial:"Alto"  },
  { id:"6", initials:"IN", bgColor:"#2A2A1A", empresa:"INFRALOG BRASIL",     badge:"VA17", contato:"PAULA MENDES",    status:"pendente", segmento:"Infraestrutura", potencial:"Baixo" },
];

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

function PotencialBar({ leads }: { leads: LeadEvento[] }) {
  const total = leads.length;
  const counts = { Alto: 0, Médio: 0, Baixo: 0 } as Record<Potencial, number>;
  leads.forEach((l) => counts[l.potencial]++);

  return (
    <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1, marginTop:12 }}>
      <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:14 }}>
        <Ionicons name="star-outline" size={17} color="#F59E0B" />
        <Text style={{ fontSize:14, fontWeight:"700", color:"#111" }}>Potencial dos Leads</Text>
      </View>

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
    </View>
  );
}

// ─── Aba: Leads do Evento ─────────────────────────────────────────────────────

function TabLeads({ onLeadPress }: { onLeadPress: (l: LeadEvento) => void }) {
  const statusCfg: Record<StatusLead, { icon: string; color: string; label: string; bg: string }> = {
    sync:     { icon:"checkmark-circle",     color:"#22C55E", label:"Sync",  bg:"#F0FDF4" },
    pendente: { icon:"time-outline",         color:"#F59E0B", label:"Pend.", bg:"#FFFBEB" },
    erro:     { icon:"alert-circle-outline", color:"#CC0000", label:"Erro",  bg:"#FFF0F0" },
  };

  return (
    <>
      {LEADS_EVENTO.map((lead) => {
        const cfg = statusCfg[lead.status];
        return (
          <TouchableOpacity
            key={lead.id}
            onPress={() => onLeadPress(lead)}
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

function TabPerfil() {
  // Contagem por segmento
  const segCounts: Record<string, number> = {};
  LEADS_EVENTO.forEach((l) => {
    segCounts[l.segmento] = (segCounts[l.segmento] || 0) + 1;
  });

  const donutSlices = Object.entries(segCounts).map(([seg, count]) => ({
    color: SEGMENTOS_CONFIG[seg] ?? "#999",
    count,
    label: seg,
  }));

  const total = LEADS_EVENTO.length;

  return (
    <>
      {/* Card Segmentos */}
      <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:4, elevation:1 }}>
        <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:16 }}>
          <MaterialCommunityIcons name="chart-bar" size={17} color="#CC0000" />
          <Text style={{ fontSize:14, fontWeight:"700", color:"#111" }}>Segmentos de Mercado</Text>
        </View>

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
      </View>

      {/* Card Potencial */}
      <PotencialBar leads={LEADS_EVENTO} />
    </>
  );
}

// ─── Header escuro (fixo) ─────────────────────────────────────────────────────

function EventoHeader({ tab, onTabChange }: { tab: TabEvento; onTabChange: (t: TabEvento) => void }) {
  const LABELS: Record<TabEvento, string> = { resumo:"Resumo", leads:"Leads", perfil:"Perfil Clientes" };
  return (
    <View style={{ backgroundColor:"#111", paddingHorizontal:20, paddingTop:12, paddingBottom:0 }}>
      {/* Topo */}
      <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <Text style={{ fontSize:11, fontWeight:"700", color:"#888", letterSpacing:1, textTransform:"uppercase" }}>
          EVENTO ATIVO · {EVENTO.datas}
        </Text>
        <View style={{ flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#CC0000", borderRadius:20, paddingHorizontal:10, paddingVertical:4 }}>
          <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#fff" }} />
          <Text style={{ fontSize:11, fontWeight:"700", color:"#fff" }}>AO VIVO</Text>
        </View>
      </View>

      <Text style={{ fontSize:28, fontWeight:"800", color:"#fff", marginBottom:4 }}>{EVENTO.nome}</Text>
      <Text style={{ fontSize:13, color:"#AAA", marginBottom:8 }}>{EVENTO.subtitulo}</Text>
      <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:16 }}>
        <Ionicons name="location-outline" size={14} color="#888" />
        <Text style={{ fontSize:12, color:"#888" }}>{EVENTO.local}</Text>
      </View>

      <TouchableOpacity style={{ flexDirection:"row", alignItems:"center", gap:8, backgroundColor:"#222", borderRadius:24, paddingHorizontal:16, paddingVertical:10, alignSelf:"flex-start", marginBottom:16, borderWidth:1, borderColor:"#333" }}>
        <MaterialCommunityIcons name="pencil-outline" size={15} color="#ccc" />
        <Text style={{ fontSize:13, fontWeight:"600", color:"#ccc" }}>Alterar evento</Text>
        <Ionicons name="chevron-down" size={14} color="#888" />
      </TouchableOpacity>

      {/* Progresso */}
      <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:8 }}>
        <Text style={{ fontSize:13, color:"#AAA" }}>{EVENTO.leadsFeitos} de {EVENTO.metaTotal} leads</Text>
        <Text style={{ fontSize:13, fontWeight:"700", color:"#CC0000" }}>{EVENTO.progresso}%</Text>
      </View>
      <View style={{ height:5, backgroundColor:"#333", borderRadius:3, overflow:"hidden", marginBottom:16 }}>
        <View style={{ height:"100%", width:`${EVENTO.progresso}%`, backgroundColor:"#CC0000", borderRadius:3 }} />
      </View>

      {/* Stats */}
      <View style={{ flexDirection:"row", gap:10, marginBottom:20 }}>
        {[
          { value:EVENTO.sync,     label:"Sync",  color:"#22C55E" },
          { value:EVENTO.pendente, label:"Pend.", color:"#F59E0B" },
          { value:EVENTO.erro,     label:"Erro",  color:"#CC0000" },
          { value:EVENTO.meta,     label:"Meta",  color:"#888"    },
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
  const [leadEditando, setLeadEditando] = useState<LeadEvento | null>(null);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:"#111" }}>
      <StatusBar barStyle="light-content" backgroundColor="#111" />

      {/* Modais */}
      <Modal visible={novoLeadVisible} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen onClose={() => setNovoLeadVisible(false)} onSave={() => setNovoLeadVisible(false)} />
      </Modal>
      <Modal visible={leadEditando !== null} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          mode="editar"
          initialData={leadEditando ? { nomeEmpresa:leadEditando.empresa, nomeContato:leadEditando.contato, mercado:leadEditando.segmento } : undefined}
          onClose={() => setLeadEditando(null)}
          onSave={() => setLeadEditando(null)}
        />
      </Modal>

      {/* Header fixo escuro */}
      <EventoHeader tab={tab} onTabChange={setTab} />

      {/* Conteúdo rolável branco */}
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
                  { value:EVENTO.leadsFeitos,                     label:"Capturados", color:"#CC0000" },
                  { value:EVENTO.metaTotal,                       label:"Meta Total", color:"#111"   },
                  { value:EVENTO.metaTotal - EVENTO.leadsFeitos,  label:"Restantes",  color:"#22C55E" },
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
                { icon:"checkmark-circle",     color:"#22C55E", label:"Sincronizados com IFS",    value:EVENTO.sync },
                { icon:"time-outline",         color:"#F59E0B", label:"Aguardando Sincronização", value:EVENTO.pendente },
                { icon:"alert-circle-outline", color:"#CC0000", label:"Erro — Requer Atenção",    value:EVENTO.erro },
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

        {tab === "leads" && <TabLeads onLeadPress={setLeadEditando} />}

        {tab === "perfil" && <TabPerfil />}
      </ScrollView>

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
