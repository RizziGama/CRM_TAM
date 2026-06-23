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

type TabEvento = "resumo" | "leads" | "perfil";

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AgendaScreen() {
  const [tabEvento, setTabEvento] = useState<TabEvento>("resumo");
  const [novoLeadVisible, setNovoLeadVisible] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <StatusBar barStyle="light-content" backgroundColor="#111" />

      {/* ── Modal Novo Lead ──────────────────────────────────────────────── */}
      <Modal visible={novoLeadVisible} animationType="slide" presentationStyle="fullScreen">
        <NovoLeadScreen
          onClose={() => setNovoLeadVisible(false)}
          onSave={() => setNovoLeadVisible(false)}
        />
      </Modal>

      {/* ── Header escuro ────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: "#111", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
        {/* Pill topo */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>
            EVENTO ATIVO · {EVENTO.datas}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#CC0000", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff", letterSpacing: 0.5 }}>AO VIVO</Text>
          </View>
        </View>

        {/* Nome evento */}
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 4 }}>
          {EVENTO.nome}
        </Text>
        <Text style={{ fontSize: 13, color: "#AAA", marginBottom: 8 }}>
          {EVENTO.subtitulo}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <Ionicons name="location-outline" size={14} color="#888" />
          <Text style={{ fontSize: 12, color: "#888" }}>{EVENTO.local}</Text>
        </View>

        {/* Botão alterar evento */}
        <TouchableOpacity style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: "#222", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
          alignSelf: "flex-start", marginBottom: 20,
          borderWidth: 1, borderColor: "#333",
        }}>
          <MaterialCommunityIcons name="pencil-outline" size={15} color="#ccc" />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#ccc" }}>Alterar evento</Text>
          <Ionicons name="chevron-down" size={14} color="#888" />
        </TouchableOpacity>

        {/* Progresso */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ fontSize: 13, color: "#AAA" }}>{EVENTO.leadsFeitos} de {EVENTO.metaTotal} leads</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#CC0000" }}>{EVENTO.progresso}%</Text>
        </View>
        <View style={{ height: 5, backgroundColor: "#333", borderRadius: 3, overflow: "hidden", marginBottom: 20 }}>
          <View style={{ height: "100%", width: `${EVENTO.progresso}%`, backgroundColor: "#CC0000", borderRadius: 3 }} />
        </View>

        {/* Stats 4 cards */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { value: EVENTO.sync, label: "Sync", color: "#22C55E" },
            { value: EVENTO.pendente, label: "Pend.", color: "#F59E0B" },
            { value: EVENTO.erro, label: "Erro", color: "#CC0000" },
            { value: EVENTO.meta, label: "Meta", color: "#888" },
          ].map((item) => (
            <View key={item.label} style={{
              flex: 1, backgroundColor: "#1C1C1C", borderRadius: 12,
              paddingVertical: 12, alignItems: "center", gap: 4,
            }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: item.color }}>{item.value}</Text>
              <Text style={{ fontSize: 11, color: "#666" }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Tab bar interna */}
        <View style={{ flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: "#222" }}>
          {(["resumo", "leads", "perfil"] as TabEvento[]).map((tab) => {
            const labels = { resumo: "Resumo", leads: "Leads", perfil: "Perfil Clientes" };
            const active = tabEvento === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setTabEvento(tab)}
                style={{ marginRight: 24, paddingBottom: 10, borderBottomWidth: active ? 2 : 0, borderBottomColor: "#fff" }}
              >
                <Text style={{ fontSize: 14, fontWeight: active ? "700" : "400", color: active ? "#fff" : "#666" }}>
                  {labels[tab]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Conteúdo branco ──────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1, backgroundColor: "#F4F4F6" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {tabEvento === "resumo" && (
          <>
            {/* Meta do Evento */}
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MaterialCommunityIcons name="target" size={18} color="#CC0000" />
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#111" }}>Meta do Evento</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                {[
                  { value: EVENTO.leadsFeitos, label: "Capturados", color: "#CC0000" },
                  { value: EVENTO.metaTotal, label: "Meta Total", color: "#111" },
                  { value: EVENTO.metaTotal - EVENTO.leadsFeitos, label: "Restantes", color: "#22C55E" },
                ].map((item, i) => (
                  <View key={item.label} style={{ flex: 1, alignItems: "center", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: "#F0F0F0" }}>
                    <Text style={{ fontSize: 28, fontWeight: "800", color: item.color }}>{item.value}</Text>
                    <Text style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Status Sincronização IFS */}
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MaterialCommunityIcons name="sync" size={18} color="#555" />
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#111" }}>Status de Sincronização IFS</Text>
              </View>
              {[
                { icon: "checkmark-circle", color: "#22C55E", label: "Sincronizados com IFS", value: EVENTO.sync },
                { icon: "time-outline", color: "#F59E0B", label: "Aguardando Sincronização", value: EVENTO.pendente },
                { icon: "alert-circle-outline", color: "#CC0000", label: "Erro — Requer Atenção", value: EVENTO.erro },
              ].map((item) => (
                <View key={item.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F5F5F5" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                    <Text style={{ fontSize: 14, color: "#444" }}>{item.label}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: item.color }}>{item.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {tabEvento === "leads" && (
          <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center" }}>
            <Ionicons name="people-outline" size={40} color="#DDD" />
            <Text style={{ color: "#AAA", marginTop: 8 }}>Lista de leads do evento</Text>
          </View>
        )}

        {tabEvento === "perfil" && (
          <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center" }}>
            <Ionicons name="business-outline" size={40} color="#DDD" />
            <Text style={{ color: "#AAA", marginTop: 8 }}>Perfil de clientes</Text>
          </View>
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
