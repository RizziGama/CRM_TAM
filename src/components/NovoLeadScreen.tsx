import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { criarLeadIFS, getExecutivoCache, ExecutivoInfo } from "./ifsService";
import { LeadLocal, novoIdLocal, upsertLeadLocal } from "./leadsStore";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = "diversos" | "contatos" | "atividades" | "executivos";
type Potencial = "Alto" | "Médio" | "Baixo";

interface Props {
  onClose?: () => void;
  onSave?: (data: LeadData) => void;
  initialData?: Partial<LeadData> & { status?: string };
  mode?: "novo" | "editar";
}

interface LeadData {
  cnpj: string;
  nomeEmpresa: string;
  nomeContato: string;
  idioma: string;
  pais: string;
  origem: string;
  mercado: string;
  segmento: string;
  potencial: Potencial;
  dataCriacao: string;
  leadDuplicado: boolean;
  notasEvento: string;
  telefone: string;
  email: string;
  executivoSecundario: string;
  id?: string; // ID do registro local (leadsStore) — presente ao editar
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const formatDate = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// Iniciais a partir do nome completo do executivo (ex.: "RAFAEL DE CARVALHO
// FERREIRA LEITE" -> "RL"), mesmo padrão usado em azureAuth.ts/UserMenu.
const computeInitials = (nome: string): string => {
  const words = nome.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const FieldLabel: React.FC<{ label: string }> = ({ label }) => (
  <Text style={{ fontSize: 10, fontWeight: "700", color: "#999", letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" }}>
    {label}
  </Text>
);

const InputField: React.FC<{
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
}> = ({ placeholder, value, onChangeText, keyboardType = "default", autoCapitalize = "words" }) => (
  <View style={{ backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 }}>
    <TextInput
      placeholder={placeholder}
      placeholderTextColor="#BBBBBB"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={{ fontSize: 15, color: "#111", padding: 0 }}
    />
  </View>
);

const SelectField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, marginBottom: 10 }}>
    <FieldLabel label={label} />
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 15, color: "#111", fontWeight: "500" }}>{value}</Text>
      <Ionicons name="chevron-down" size={16} color="#999" />
    </View>
  </View>
);

const NotasEvento: React.FC<{ value: string; onChangeText: (v: string) => void }> = ({ value, onChangeText }) => (
  <View style={{ backgroundColor: "#F4F4F6", borderRadius: 12, padding: 16, marginTop: 4 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <MaterialCommunityIcons name="file-document-outline" size={16} color="#888" />
      <Text style={{ fontSize: 10, fontWeight: "700", color: "#888", letterSpacing: 1.2, textTransform: "uppercase" }}>
        Notas do Evento
      </Text>
    </View>
    <TextInput
      placeholder="Anotações rápidas sobre o contato, interesse, próximos passos..."
      placeholderTextColor="#BBBBBB"
      value={value}
      onChangeText={onChangeText}
      multiline
      numberOfLines={4}
      textAlignVertical="top"
      style={{ fontSize: 14, color: "#555", minHeight: 80, padding: 0 }}
    />
  </View>
);

// ─── Card do Executivo de Vendas real ──────────────────────────────────────────

const CardExecutivo: React.FC<{ executivo: ExecutivoInfo | null; carregando: boolean }> = ({
  executivo,
  carregando,
}) => (
  <View style={{ backgroundColor: "#FFF0F0", borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#CC0000", alignItems: "center", justifyContent: "center" }}>
      {carregando ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
          {executivo ? computeInitials(executivo.nome) : "?"}
        </Text>
      )}
    </View>
    <View>
      <Text style={{ fontSize: 10, fontWeight: "700", color: "#CC0000", letterSpacing: 1, textTransform: "uppercase" }}>
        Executivo de Vendas
      </Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: "#111", marginTop: 2 }}>
        {carregando ? "Carregando..." : executivo?.nome ?? "Não identificado"}
      </Text>
      <Text style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
        {executivo ? `ID: ${executivo.id}` : ""}
      </Text>
    </View>
  </View>
);

// ─── Aba: Diversos ────────────────────────────────────────────────────────────

const TabDiversos: React.FC<{
  data: LeadData;
  setData: (d: Partial<LeadData>) => void;
  executivo: ExecutivoInfo | null;
  carregandoExecutivo: boolean;
}> = ({ data, setData, executivo, carregandoExecutivo }) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
    {/* Card principal */}
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      {/* CNPJ com máscara */}
      <View style={{ backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 }}>
        <TextInput
          placeholder="CNPJ"
          placeholderTextColor="#BBBBBB"
          value={data.cnpj}
          onChangeText={(v) => setData({ cnpj: formatCNPJ(v) })}
          keyboardType="numeric"
          style={{ fontSize: 15, color: "#111", padding: 0 }}
        />
      </View>

      <InputField
        placeholder="Nome da Empresa"
        value={data.nomeEmpresa}
        onChangeText={(v) => setData({ nomeEmpresa: v })}
      />

      <InputField
        placeholder="Nome do Contato"
        value={data.nomeContato}
        onChangeText={(v) => setData({ nomeContato: v })}
      />

      {/* Idioma + País */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <View style={{ flex: 1, backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
          <FieldLabel label="Idioma" />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: "#111", fontWeight: "500", flex: 1 }}>{data.idioma}</Text>
            <Ionicons name="chevron-down" size={14} color="#999" />
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
          <FieldLabel label="País" />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: "#111", fontWeight: "700", flex: 1 }}>{data.pais}</Text>
            <Ionicons name="chevron-down" size={14} color="#999" />
          </View>
        </View>
      </View>

      <SelectField label="Origem" value={data.origem} />
    </View>

    {/* Card Executivo de Vendas — agora com dados reais do IFS */}
    <CardExecutivo executivo={executivo} carregando={carregandoExecutivo} />

    {/* Card campos adicionais */}
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <SelectField label="Mercado" value={data.mercado} />
      <SelectField label="Segmento" value={data.segmento} />

      {/* Potencial do Lead */}
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: "#888", letterSpacing: 0.8, marginBottom: 10 }}>
          POTENCIAL DO LEAD
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["Alto", "Médio", "Baixo"] as Potencial[]).map((p) => {
            const active = data.potencial === p;
            const activeColor = p === "Alto" ? "#CC0000" : p === "Médio" ? "#F59E0B" : "#6B7280";
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setData({ potencial: p })}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 24,
                  alignItems: "center",
                  backgroundColor: active ? activeColor : "#F4F4F6",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : "#888" }}>
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Data Criação */}
      <View style={{ backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, marginBottom: 10 }}>
        <FieldLabel label="Data Criação" />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 15, color: "#111", fontWeight: "500" }}>{data.dataCriacao}</Text>
          <Ionicons name="calendar-outline" size={18} color="#999" />
        </View>
      </View>

      {/* Lead Duplicado */}
      <TouchableOpacity
        onPress={() => setData({ leadDuplicado: !data.leadDuplicado })}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 }}
        activeOpacity={0.7}
      >
        <View style={{
          width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
          borderColor: data.leadDuplicado ? "#CC0000" : "#CCC",
          backgroundColor: data.leadDuplicado ? "#CC0000" : "#fff",
          alignItems: "center", justifyContent: "center",
        }}>
          {data.leadDuplicado && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
        <Text style={{ fontSize: 14, color: "#555" }}>Lead Duplicado</Text>
      </TouchableOpacity>

      <NotasEvento value={data.notasEvento} onChangeText={(v) => setData({ notasEvento: v })} />
    </View>
  </ScrollView>
);

// ─── Aba: Contatos ────────────────────────────────────────────────────────────

const TabContatos: React.FC<{ data: LeadData; setData: (d: Partial<LeadData>) => void }> = ({ data, setData }) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <InputField
        placeholder="Telefone"
        value={data.telefone}
        onChangeText={(v) => setData({ telefone: v })}
        keyboardType="phone-pad"
        autoCapitalize="none"
      />
      <InputField
        placeholder="E-mail do Contato"
        value={data.email}
        onChangeText={(v) => setData({ email: v })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
    </View>
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <NotasEvento value={data.notasEvento} onChangeText={(v) => setData({ notasEvento: v })} />
    </View>
  </ScrollView>
);

// ─── Aba: Atividades ──────────────────────────────────────────────────────────

const TabAtividades: React.FC<{ data: LeadData; setData: (d: Partial<LeadData>) => void }> = ({ data, setData }) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFF0F0", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="chart-line-variant" size={16} color="#CC0000" />
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#111" }}>
            Lead criado no evento EBACE 2026
          </Text>
          <Text style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
            Hoje · {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, "0")}
          </Text>
        </View>
      </View>
    </View>
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <NotasEvento value={data.notasEvento} onChangeText={(v) => setData({ notasEvento: v })} />
    </View>
  </ScrollView>
);

// ─── Aba: Executivos ──────────────────────────────────────────────────────────

const TabExecutivos: React.FC<{ data: LeadData; setData: (d: Partial<LeadData>) => void }> = ({ data, setData }) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <Text style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>Executivo Secundário</Text>
      <View style={{ backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
        <TextInput
          placeholder="Buscar executivo..."
          placeholderTextColor="#BBBBBB"
          value={data.executivoSecundario}
          onChangeText={(v) => setData({ executivoSecundario: v })}
          style={{ fontSize: 15, color: "#111", padding: 0 }}
        />
      </View>
    </View>
  </ScrollView>
);

// ─── Tela Principal ───────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "diversos", label: "Diversos" },
  { key: "contatos", label: "Contatos" },
  { key: "atividades", label: "Atividades" },
  { key: "executivos", label: "Execut." },
];

export default function NovoLeadScreen({ onClose, onSave, initialData, mode = "novo" }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("diversos");
  const isEditing = mode === "editar";
  const [saving, setSaving] = useState(false);
  const [data, setDataState] = useState<LeadData>({
    cnpj: "",
    nomeEmpresa: "",
    nomeContato: "",
    idioma: "Português (Brasil)",
    pais: "BRASIL",
    origem: "Indicação",
    mercado: "FINANCE - Financeiro",
    segmento: "Financeiro",
    potencial: "Médio",
    dataCriacao: formatDate(),
    leadDuplicado: false,
    notasEvento: "",
    telefone: "",
    email: "",
    executivoSecundario: "",
    ...initialData,
  });

  // ID local estável — se for edição, reaproveita o id do lead existente;
  // se for novo, gera um id uma única vez (não muda a cada render).
  const [leadId] = useState<string>(() => initialData?.id ?? novoIdLocal());

  // Trava de segurança: leads já sincronizados com o IFS não podem ser
  // editados. Isso normalmente já é garantido pelas telas que abrem este
  // componente (Leads/Dashboard/Agenda não deixam abrir edição de um lead
  // "sync"), mas mantemos essa checagem aqui também como última linha de
  // defesa, caso algum lugar do app ainda passe um lead sincronizado.
  useEffect(() => {
    if (isEditing && initialData?.status === "sync") {
      Alert.alert(
        "Lead já sincronizado",
        "Este lead já foi sincronizado com o IFS e não pode mais ser editado.",
        [{ text: "OK", onPress: () => onClose?.() }]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Executivo de Vendas real (logado e já validado contra o IFS no login).
  // Vem do cache local — não precisa consultar o IFS de novo aqui.
  const [executivo, setExecutivo] = useState<ExecutivoInfo | null>(null);
  const [carregandoExecutivo, setCarregandoExecutivo] = useState(true);

  useEffect(() => {
    let mounted = true;
    getExecutivoCache()
      .then((info) => {
        if (mounted) setExecutivo(info);
      })
      .catch((err) => {
        console.warn("[NovoLeadScreen] Falha ao buscar executivo do cache:", err);
      })
      .finally(() => {
        if (mounted) setCarregandoExecutivo(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setData = (partial: Partial<LeadData>) =>
    setDataState((prev) => ({ ...prev, ...partial }));

  // sincronizar = false  -> só salva localmente (cache), status "pendente",
  //                          não chama o IFS. Útil pra guardar rascunho.
  // sincronizar = true   -> salva localmente E tenta criar/atualizar no IFS
  //                          (fluxo original).
  const handleSave = async (sincronizar: boolean) => {
    if (!data.nomeEmpresa?.trim()) {
      Alert.alert("Campo obrigatório", "Informe o Nome da Empresa antes de salvar.");
      return;
    }

    if (sincronizar && !executivo) {
      Alert.alert(
        "Executivo não identificado",
        "Não foi possível identificar o Executivo de Vendas responsável. Faça login novamente antes de sincronizar o lead."
      );
      return;
    }

    setSaving(true);

    const agora = new Date().toISOString();

    // Monta o registro local. Salvamos ANTES de chamar a API, como
    // "pendente" — assim o lead nunca se perde, mesmo se o app fechar ou a
    // rede cair no meio do caminho. Se já existir (edição), preserva
    // criadoEm/ifsLeadId originais.
    const leadLocalBase: LeadLocal = {
      id: leadId,
      status: "pendente",
      criadoEm: initialData?.id ? (initialData as any).criadoEm ?? agora : agora,
      atualizadoEm: agora,
      cnpj: data.cnpj,
      nomeEmpresa: data.nomeEmpresa,
      nomeContato: data.nomeContato,
      idioma: data.idioma,
      pais: data.pais,
      origem: data.origem,
      mercado: data.mercado,
      segmento: data.segmento,
      potencial: data.potencial,
      dataCriacao: data.dataCriacao,
      leadDuplicado: data.leadDuplicado,
      notasEvento: data.notasEvento,
      telefone: data.telefone,
      email: data.email,
      executivoSecundario: data.executivoSecundario,
      mainRepresentativeId: executivo?.id,
      executivoNome: executivo?.nome,
    };

    // ── Só salvar localmente (sem chamar o IFS) ─────────────────────────
    if (!sincronizar) {
      try {
        await upsertLeadLocal(leadLocalBase);
        Alert.alert(
          "💾 Lead salvo",
          `Lead "${data.nomeEmpresa}" salvo localmente como pendente. Você pode sincronizá-lo com o IFS depois, na tela de Leads.`,
          [{ text: "OK", onPress: () => onSave?.(data) }]
        );
      } catch (err) {
        Alert.alert("Erro", "Não foi possível salvar o lead localmente.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── Salvar + sincronizar com o IFS (fluxo original) ─────────────────
    try {
      await upsertLeadLocal(leadLocalBase);

      const result = await criarLeadIFS({
        nomeEmpresa:   data.nomeEmpresa,
        nomeContato:   data.nomeContato,
        cnpj:          data.cnpj,
        idioma:        data.idioma,
        pais:          data.pais,
        origem:        data.origem,
        mercado:       data.mercado,
        segmento:      data.segmento,
        potencial:     data.potencial,
        dataCriacao:   data.dataCriacao,
        notasEvento:   data.notasEvento,
        leadDuplicado: data.leadDuplicado,
        mainRepresentativeId: executivo!.id,
      });

      if (result.success) {
        await upsertLeadLocal({
          ...leadLocalBase,
          status: "sync",
          ifsLeadId: result.leadId,
          erro: undefined,
          atualizadoEm: new Date().toISOString(),
        });

        Alert.alert(
          "✅ Lead Criado!",
          `Lead "${data.nomeEmpresa}" sincronizado com o IFS.${result.leadId ? "\nID: " + result.leadId : ""}`,
          [{ text: "OK", onPress: () => onSave?.(data) }]
        );
      } else {
        // Não deu certo, mas o lead JÁ ESTÁ salvo localmente como "erro" —
        // dá pra reenviar depois, sem perder o que foi digitado.
        await upsertLeadLocal({
          ...leadLocalBase,
          status: "erro",
          erro: result.error,
          atualizadoEm: new Date().toISOString(),
        });

        Alert.alert(
          "❌ Erro ao Sincronizar",
          `${result.error ?? "Não foi possível criar o lead no IFS."}\n\nO lead foi salvo localmente e você pode tentar sincronizar novamente na tela de Leads.`,
          [
            { text: "Tentar novamente agora", onPress: () => handleSave(true) },
            { text: "Salvar e fechar", onPress: () => onSave?.(data) },
          ]
        );
      }
    } catch (err) {
      // Falha inesperada (ex.: exceção fora do criarLeadIFS) — ainda assim
      // o lead já ficou salvo localmente como "pendente" acima.
      await upsertLeadLocal({
        ...leadLocalBase,
        status: "erro",
        erro: "Erro inesperado ao sincronizar.",
        atualizadoEm: new Date().toISOString(),
      });
      Alert.alert(
        "Erro inesperado",
        "O lead foi salvo localmente. Tente sincronizar novamente na tela de Leads."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "diversos":
        return (
          <TabDiversos
            data={data}
            setData={setData}
            executivo={executivo}
            carregandoExecutivo={carregandoExecutivo}
          />
        );
      case "contatos":    return <TabContatos data={data} setData={setData} />;
      case "atividades":  return <TabAtividades data={data} setData={setData} />;
      case "executivos":  return <TabExecutivos data={data} setData={setData} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F6" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F4F6" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F4F4F6",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#EBEBEB", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={18} color="#444" />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#CC0000", letterSpacing: 1, textTransform: "uppercase" }}>
              {isEditing ? "Editar Lead" : "Novo Lead"}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111" }}>
              {isEditing ? data.nomeEmpresa || "Cadastro de Prospect" : "Cadastro de Prospect"}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: "#EBEBEB", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#555", letterSpacing: 1 }}>AUTO</Text>
        </View>
      </View>

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 4 }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24,
                backgroundColor: active ? "#CC0000" : "#fff",
                borderWidth: active ? 0 : 1,
                borderColor: "#E0E0E0",
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : "#666" }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Conteúdo da Aba ─────────────────────────────────────────────── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {renderTab()}
      </KeyboardAvoidingView>

      {/* ── Footer: Cancelar + Salvar + Salvar e Sincronizar ──────────────── */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16, paddingTop: 12,
        backgroundColor: "#F4F4F6",
        borderTopWidth: 1, borderTopColor: "#EBEBEB",
      }}>
        <TouchableOpacity
          onPress={onClose}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDD", alignItems: "center", justifyContent: "center" }}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>

        {/* Salvar (só localmente, sem chamar o IFS) */}
        <TouchableOpacity
          onPress={() => handleSave(false)}
          disabled={saving}
          style={{
            flex: 1, height: 52, borderRadius: 28, backgroundColor: "#fff",
            borderWidth: 1.5, borderColor: "#CC0000",
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
            opacity: saving ? 0.6 : 1,
          }}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="content-save-outline" size={18} color="#CC0000" />
          <Text style={{ color: "#CC0000", fontWeight: "700", fontSize: 13 }}>Salvar</Text>
        </TouchableOpacity>

        {/* Salvar e Sincronizar com o IFS */}
        <TouchableOpacity
          onPress={() => handleSave(true)}
          disabled={saving}
          style={{
            flex: 1.4, height: 52, borderRadius: 28, backgroundColor: "#CC0000",
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            shadowColor: "#CC0000", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
            opacity: saving ? 0.8 : 1,
          }}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sync" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                {isEditing ? "Atualizar e Sincronizar" : "Salvar e Sincronizar"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
