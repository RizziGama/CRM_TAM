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
  Modal,
  Pressable,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { criarLeadIFS, getExecutivoCache, ExecutivoInfo, PaisIFS, buscarPaisesIFS } from "./ifsService";
import { LeadLocal, novoIdLocal, upsertLeadLocal } from "./leadsStore";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  paisCodigo: string; // código IFS do país (ex.: "BR"), vem junto com a seleção
                       // no modal — é isso que vai no payload, não o nome.
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

// Aplica máscara de CPF (11 dígitos) enquanto o usuário digita; a partir do
// 12º dígito, passa a aplicar a máscara de CNPJ automaticamente — assim o
// mesmo campo aceita os dois documentos sem precisar de um seletor separado.
const formatCpfCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  if (digits.length <= 11) {
    // Máscara de CPF: 000.000.000-00
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  // Máscara de CNPJ: 00.000.000/0000-00
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

// Diz se o valor digitado (só dígitos) já corresponde a um CPF (11) ou
// CNPJ (14) completo — útil pra validação antes de salvar, se precisar.
const isCpfCnpjCompleto = (value: string): boolean => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14;
};

// Máscara de telefone: alterna sozinha entre celular (11 dígitos —
// "(00) 00000-0000") e fixo (10 dígitos — "(00) 0000-0000") conforme a
// quantidade de números digitados.
const formatTelefone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Validação simples de e-mail: exige "algo@algo.algo". Campo vazio é
// considerado válido (e-mail é opcional) — só acusa erro se o usuário
// digitou algo e faltar o "@"/domínio.
const isEmailValido = (email: string): boolean => {
  const valor = email.trim();
  if (!valor) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
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
  error?: boolean;
  errorText?: string;
}> = ({ placeholder, value, onChangeText, keyboardType = "default", autoCapitalize = "words", error = false, errorText }) => (
  <View style={{ marginBottom: 10 }}>
    <View style={{
      backgroundColor: "#F4F4F6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      borderWidth: error ? 1.5 : 0, borderColor: error ? "#CC0000" : "transparent",
    }}>
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
    {error && errorText ? (
      <Text style={{ fontSize: 11, color: "#CC0000", marginTop: 4, marginLeft: 4 }}>{errorText}</Text>
    ) : null}
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

// ─── Conteúdo do formulário (antes era a aba "Diversos"; agora é a tela toda) ─

const LeadFormContent: React.FC<{
  data: LeadData;
  setData: (d: Partial<LeadData>) => void;
  executivo: ExecutivoInfo | null;
  carregandoExecutivo: boolean;
  onPressPais: () => void;
}> = ({ data, setData, executivo, carregandoExecutivo, onPressPais}) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
    {/* Card principal */}
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      {/* CPF/CNPJ com máscara dinâmica (troca sozinha conforme a qtd. de dígitos) */}
      <InputField
        placeholder="CPF / CNPJ"
        value={data.cnpj}
        onChangeText={(v) => setData({ cnpj: formatCpfCnpj(v) })}
        keyboardType="numeric"
        autoCapitalize="none"
      />

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

      <InputField
        placeholder="Telefone"
        value={data.telefone}
        onChangeText={(v) => setData({ telefone: formatTelefone(v) })}
        keyboardType="phone-pad"
        autoCapitalize="none"
      />
      <InputField
        placeholder="E-mail do Contato"
        value={data.email}
        onChangeText={(v) => setData({ email: v })}
        keyboardType="email-address"
        autoCapitalize="none"
        error={!isEmailValido(data.email)}
        errorText="Informe um e-mail válido (ex.: nome@dominio.com)"
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
      </View>
        <TouchableOpacity
        
          onPress={onPressPais}
          style={{
            flex: 1,
            backgroundColor: "#F4F4F6",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 12,
          }}
        >
          <FieldLabel label="País" />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: "#111",
                fontWeight: "700",
                flex: 1,
              }}
            >
              {data.pais}
            </Text>

            <Ionicons
              name="chevron-down"
              size={14}
              color="#999"
            />
          </View>
        </TouchableOpacity>

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
            const activeColor = p === "Alto" ? "#22C55E" : p === "Médio" ? "#F59E0B" : "#CC0000";
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

      <NotasEvento value={data.notasEvento} onChangeText={(v) => setData({ notasEvento: v })} />
    </View>
  </ScrollView>
);

// ─── Modal: Seletor de País ───────────────────────────────────────────────────
//
// Mesmo padrão do seletor de eventos do AgendaScreen: modal transparente,
// com fundo escurecido, mostrando um cartão flutuante por cima da tela atual
// (não é uma tela cheia nova) e lista rolável dos países vindos do IFS
// (Reference_IsoCountry). Ao tocar num país, guarda nome + código e fecha.

const SeletorPaisModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  paises: PaisIFS[];
  paisAtual: string;
  carregando: boolean;
  onSelecionar: (pais: PaisIFS) => void;
}> = ({ visible, onClose, paises, paisAtual, carregando, onSelecionar }) => (
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
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#111" }}>Selecione um país</Text>
          <Text style={{ fontSize: 12, color: "#999", marginTop: 2 }}>Países cadastrados no IFS</Text>
        </View>

        {carregando ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#CC0000" />
          </View>
        ) : paises.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center", paddingHorizontal: 20 }}>
            <Ionicons name="earth-outline" size={40} color="#DDD" />
            <Text style={{ color: "#BBB", marginTop: 10, fontSize: 13, textAlign: "center" }}>
              Nenhum país encontrado no IFS
            </Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {paises.map((item) => {
              const ativo = item.nome.trim().toUpperCase() === paisAtual.trim().toUpperCase();
              return (
                <TouchableOpacity
                  key={item.codigo}
                  onPress={() => onSelecionar(item)}
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
                  <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#111" }} numberOfLines={1}>
                    {item.nome}
                  </Text>
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

// ─── Tela Principal ───────────────────────────────────────────────────────────

export default function NovoLeadScreen({ onClose, onSave, initialData, mode = "novo" }: Props) {
  const isEditing = mode === "editar";
  const [saving, setSaving] = useState(false);
  const [data, setDataState] = useState<LeadData>({
    cnpj: "",
    nomeEmpresa: "",
    nomeContato: "",
    idioma: "Português (Brasil)",
    pais: "BRASIL",
    paisCodigo: "BR",
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


  
  const [paises, setPaises] = useState<PaisIFS[]>([]);
  const [modalPaises, setModalPaises] = useState(false);
  const [loadingPaises, setLoadingPaises] = useState(false);

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

  const abrirModalPaises = async () => {
  try {
    setLoadingPaises(true);

    // evita consultar o IFS toda vez que abrir
    if (paises.length === 0) {
      const lista = await buscarPaisesIFS();
      setPaises(lista);
    }

    setModalPaises(true);
  } catch (err) {
    Alert.alert(
      "Erro",
      "Não foi possível carregar a lista de países."
    );
  } finally {
    setLoadingPaises(false);
  }
};
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

    if (!isEmailValido(data.email)) {
      Alert.alert("E-mail inválido", "Informe um e-mail válido (ex.: nome@dominio.com) ou deixe o campo em branco.");
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
        paisCodigo:    data.paisCodigo,
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

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <LeadFormContent
          data={data}
          setData={setData}
          executivo={executivo}
          carregandoExecutivo={carregandoExecutivo}
          onPressPais={abrirModalPaises}
        />
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
      <SeletorPaisModal
        visible={modalPaises}
        onClose={() => setModalPaises(false)}
        paises={paises}
        paisAtual={data.pais}
        carregando={loadingPaises}
        onSelecionar={(item) => {
          setData({ pais: item.nome, paisCodigo: item.codigo });
          setModalPaises(false);
        }}
      />
    </SafeAreaView>
  );
}
