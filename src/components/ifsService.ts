// ─── Configuração ─────────────────────────────────────────────────────────────
//
// Este service NÃO fala mais diretamente com o IFS. Todas as chamadas passam
// pela API PASS (middleware), que guarda as credenciais reais do IFS só no
// servidor. O app só precisa do token da própria API PASS.
//
// Crie/edite o arquivo .env na raiz do projeto com:
//
//   EXPO_PUBLIC_API_PASS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
//
// Reinicie o Expo com --clear depois de criar/editar o .env.
//
// IMPORTANTE: mesmo sendo EXPO_PUBLIC_*, esse token ainda fica visível no
// bundle do cliente (limitação estrutural de apps sem backend de sessão).
// A diferença é que ele só abre a API PASS, não o IFS inteiro — o
// IFS_USER/IFS_PASS antigo pode (e deve) ser removido do .env, pois não é
// mais usado neste arquivo.
//
// Adicione .env ao .gitignore.

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_PASS_BASE =
  "https://core.apipass.com.br/api/cfc2eddc-b1d5-4671-a5a1-97e774f7f71b/TAM_IFS_Desenvolvimento";

const API_PASS_TOKEN = process.env.EXPO_PUBLIC_API_PASS_TOKEN ?? "";

if (!API_PASS_TOKEN) {
  console.warn(
    "[ApiPass] EXPO_PUBLIC_API_PASS_TOKEN não definida. Crie um arquivo .env na raiz do projeto."
  );
}

// ─── Helper genérico de chamada à API PASS ─────────────────────────────────────
//
// Centraliza header de auth, tratamento de erro de rede/HTTP e parsing de
// JSON. Todas as funções abaixo passam por aqui — se um dia a auth mudar
// (ex.: trocar Bearer fixo por JWT do Azure AD), só muda neste um lugar.

interface ApiPassResult<T = any> {
  ok: boolean;
  status: number;
  json: T | null;
  rawText: string;
}

async function callApiPass<T = any>(
  path: string,
  options: { method?: "GET" | "POST"; body?: any } = {}
): Promise<ApiPassResult<T>> {
  const { method = "GET", body } = options;

  const response = await fetch(`${API_PASS_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${API_PASS_TOKEN}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const rawText = await response.text().catch(() => "");
  let json: T | null = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }

  return { ok: response.ok, status: response.status, json, rawText };
}

// Extrai a lista de itens da resposta, aceitando tanto o shape cru do IFS
// ({ body: { value: [...] } } ou { value: [...] }) quanto um formato já
// normalizado no futuro ({ success, value: [...] }). Mantém o client
// funcionando mesmo se algum endpoint da API PASS mudar de formato depois.
function extrairLista(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.value)) return json.value;
  if (Array.isArray(json.body?.value)) return json.body.value;
  if (Array.isArray(json.body)) return json.body;
  return [];
}

// Normaliza a resposta do POST /leads. A API PASS NÃO formata essa
// resposta — ela repassa o retorno cru do IFS, algo como:
//   { body: { LeadId: "VA228", ... }, status: 200, headers: {}, ... }
// Esta função aceita esse shape cru e também, por segurança, um eventual
// shape já formatado ({ success, leadId }), caso a API PASS passe a
// formatar isso no futuro.
function normalizarRespostaLead(json: any, rawText: string): IFSApiResponse {
  // Já veio formatado (ex.: { success: true, leadId: "..." })?
  if (typeof json?.success === "boolean") {
    return json as IFSApiResponse;
  }

  // Shape cru do IFS: { body: { LeadId, ... }, status }
  const entidade = json?.body ?? json;
  const leadId = entidade?.LeadId ?? entidade?.leadId;
  const httpStatus = json?.status ?? 200;

  if (leadId && httpStatus >= 200 && httpStatus < 300) {
    return { success: true, leadId: String(leadId) };
  }

  // Shape de erro típico do OData/IFS: { error: { message, code } } ou
  // { body: { error: { message } } }
  const erroOData =
    entidade?.error?.message ?? json?.error?.message ?? entidade?.Message ?? json?.Message;

  return {
    success: false,
    error: erroOData || "Resposta inesperada da API PASS ao criar lead.",
    rawError: rawText,
  };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface IFSApiResponse {
  success: boolean;
  leadId?: string;
  error?: string;
  rawError?: string;
}

export interface ExecutivoInfo {
  id: string; // RepresentativeId — usado como MainRepresentativeId no lead
  nome: string; // Nome completo (PersonInfoRef.Name)
  userId: string; // Username funcional do IFS (ex.: "RAFAEL.LEITE")
  ativo: boolean; // Objstate === "Active"
}

// Evento de captação de leads (EventosLeadsSet no IFS).
export interface EventoLead {
  objkey: string; // Objkey — identificador único do registro no IFS
  eventId: number | null; // Cf_Event_Id
  nome: string; // Cf_Nome_Evento
  dataEvento: string; // Cf_Data_Evento — "YYYY-MM-DD"
  metaLeads: number; // Cf_Meta_Leasds
  leadsRealizados: number | null; // Cf_Leads_Realizados (vindo do IFS, se houver)
  observacao: string; // Cf_Observacao
  status: string; // Cf_Status
}

export interface PaisIFS {
  codigo: string;
  nome: string;
}

export interface IdiomaIFS {
  codigo: string;
  nome: string;
}

export interface OrigemIFS {
  codigo: string; // SourceId puro do IFS (ex.: "20", "LB26")
  nome: string; // Description
}

export interface MercadoIFS {
  codigo: string; // MarketCode
  nome: string; // Description
}

export interface SegmentoIFS {
  codigo: string;
  nome: string;
}

const EXECUTIVO_CACHE_KEY = "executivoInfo";
const EVENTO_SELECIONADO_KEY = "eventoSelecionado";

// ─── Mapeamentos ──────────────────────────────────────────────────────────────

const mapIdioma = (idioma: string): string => {
  if (idioma.includes("Português")) return "bp";
  if (idioma.includes("English")) return "en";
  if (idioma.includes("Español")) return "es";
  if (idioma.includes("Français")) return "fr";
  if (idioma.includes("Deutsch")) return "de";
  return "bp";
};

const mapPotencial = (potencial?: string): string | null => {
  const mapa: Record<string, string> = {
    Alto: "ALTO",
    Médio: "MEDIO",
    Medio: "MEDIO",
    Baixo: "BAIXO",
  };
  return potencial ? mapa[potencial] ?? null : null;
};

// "DD/MM/YYYY" → "YYYY-MM-DD"
const formatDateToISO = (date: string): string => {
  const parts = date.split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return new Date().toISOString().split("T")[0];
};

// ─── Verificar Executivo de Vendas ─────────────────────────────────────────────
//
// GET /executivos na API PASS — hoje devolve o shape cru do IFS
// (BusinessRepresentativeSet com PersonInfoRef expandido). Comparamos o
// "UserId" do IFS (ex.: "RAFAEL.LEITE") com a parte antes do "@" do e-mail
// corporativo (ex.: "rafael.leite@dominio.com" → "RAFAEL.LEITE").
//
// Retorna null se o usuário não existir na lista, ou se existir mas estiver
// com Objstate = "Blocked".

export async function buscarExecutivoDeVendas(
  emailAzure: string
): Promise<ExecutivoInfo | null> {
  const userIdAlvo = emailAzure.split("@")[0]?.trim().toUpperCase();
  if (!userIdAlvo) return null;

  try {
    const { ok, status, json } = await callApiPass("/executivos");

    if (!ok) {
      console.warn(`[ApiPass] Falha ao buscar executivos: HTTP ${status}`);
      return null;
    }

    const lista = extrairLista(json);

    const encontrado = lista.find((rep) => {
      // Aceita tanto o shape cru (PersonInfoRef.UserId) quanto um eventual
      // shape normalizado (userId direto no item).
      const userId: string =
        rep?.PersonInfoRef?.UserId ?? rep?.userId ?? rep?.UserId ?? "";
      return userId.trim().toUpperCase() === userIdAlvo;
    });

    if (!encontrado) {
      console.log(
        `[ApiPass] Usuário "${userIdAlvo}" não encontrado na lista de Executivos de Vendas.`
      );
      return null;
    }

    const objstate = encontrado.Objstate ?? encontrado.objstate ?? encontrado.ativo;
    const ativo =
      typeof objstate === "boolean" ? objstate : objstate === "Active";

    return {
      id: String(encontrado.RepresentativeId ?? encontrado.id ?? ""),
      nome:
        encontrado.PersonInfoRef?.Name ??
        encontrado.nome ??
        encontrado.Name ??
        emailAzure,
      userId:
        encontrado.PersonInfoRef?.UserId ??
        encontrado.userId ??
        encontrado.UserId ??
        userIdAlvo,
      ativo,
    };
  } catch (err) {
    console.error("[ApiPass] Erro ao verificar executivo de vendas:", err);
    return null;
  }
}

// ─── Cache local do Executivo logado ───────────────────────────────────────────

export async function cacheExecutivo(info: ExecutivoInfo): Promise<void> {
  await SecureStore.setItemAsync(EXECUTIVO_CACHE_KEY, JSON.stringify(info));
}

export async function getExecutivoCache(): Promise<ExecutivoInfo | null> {
  const stored = await SecureStore.getItemAsync(EXECUTIVO_CACHE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ExecutivoInfo;
  } catch {
    return null;
  }
}

export async function clearExecutivoCache(): Promise<void> {
  await SecureStore.deleteItemAsync(EXECUTIVO_CACHE_KEY);
}

// ─── Eventos de Captação de Leads ───────────────────────────────────────────────

export async function buscarEventosIFS(): Promise<EventoLead[]> {
  try {
    const { ok, status, json } = await callApiPass("/eventos");

    if (!ok) {
      console.warn(`[ApiPass] Falha ao buscar eventos: HTTP ${status}`);
      return [];
    }

    const lista = extrairLista(json);

    return lista.map((ev) => ({
      objkey: ev.Objkey ?? ev.objkey,
      eventId: ev.Cf_Event_Id ?? ev.eventId ?? null,
      nome: (ev.Cf_Nome_Evento ?? ev.nome)?.trim() || "Evento sem nome",
      dataEvento: ev.Cf_Data_Evento ?? ev.dataEvento ?? "",
      metaLeads:
        typeof ev.Cf_Meta_Leasds === "number"
          ? ev.Cf_Meta_Leasds
          : typeof ev.metaLeads === "number"
          ? ev.metaLeads
          : 0,
      leadsRealizados:
        typeof ev.Cf_Leads_Realizados === "number"
          ? ev.Cf_Leads_Realizados
          : typeof ev.leadsRealizados === "number"
          ? ev.leadsRealizados
          : null,
      observacao: ev.Cf_Observacao ?? ev.observacao ?? "",
      status: ev.Cf_Status ?? ev.status ?? "",
    }));
  } catch (err) {
    console.error("[ApiPass] Erro ao buscar eventos:", err);
    return [];
  }
}

// ─── Cache local do Evento selecionado ─────────────────────────────────────────

export async function cacheEventoSelecionado(evento: EventoLead): Promise<void> {
  await AsyncStorage.setItem(EVENTO_SELECIONADO_KEY, JSON.stringify(evento));
}

export async function getEventoSelecionadoCache(): Promise<EventoLead | null> {
  try {
    const stored = await AsyncStorage.getItem(EVENTO_SELECIONADO_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as EventoLead;
  } catch {
    return null;
  }
}

// ─── Funções de busca de dados do IFS (via API PASS) ───────────────────────────

export async function buscarPaisesIFS(): Promise<PaisIFS[]> {
  try {
    const { ok, status, json } = await callApiPass("/paises");

    if (!ok) {
      console.warn(`[ApiPass] Erro ao buscar países: ${status}`);
      return [];
    }

    return extrairLista(json)
      .map((item: any) => ({
        codigo: item.CountryCode ?? item.codigo,
        nome: item.Description ?? item.nome,
      }))
      .sort((a: PaisIFS, b: PaisIFS) => a.nome.localeCompare(b.nome, "pt-BR"));
  } catch (err) {
    console.error("[ApiPass] Erro ao buscar países:", err);
    return [];
  }
}

export async function obterCodigoPais(nomePais: string): Promise<string> {
  const paises = await buscarPaisesIFS();

  const encontrado = paises.find(
    (p) => p.nome.trim().toUpperCase() === nomePais.trim().toUpperCase()
  );

  return encontrado?.codigo ?? "BR";
}

export async function buscarIdiomasIFS(): Promise<IdiomaIFS[]> {
  try {
    const { ok, status, json } = await callApiPass("/idiomas");

    if (!ok) {
      console.warn(`[ApiPass] Erro ao buscar idiomas: ${status}`);
      return [];
    }

    return extrairLista(json)
      .map((item: any) => ({
        codigo: item.LanguageCode ?? item.codigo,
        nome: item.Description ?? item.nome,
      }))
      .sort((a: IdiomaIFS, b: IdiomaIFS) => a.nome.localeCompare(b.nome, "pt-BR"));
  } catch (err) {
    console.error("[ApiPass] Erro ao buscar idiomas:", err);
    return [];
  }
}

export async function buscarOrigensIFS(): Promise<OrigemIFS[]> {
  try {
    const { ok, status, json } = await callApiPass("/origens");

    if (!ok) {
      console.warn(`[ApiPass] Erro ao buscar origens: ${status}`);
      return [];
    }

    return extrairLista(json)
      .map((item: any) => ({
        codigo: String(item.SourceId ?? item.codigo ?? "").trim(),
        nome:
          String(item.Description ?? item.nome ?? "").trim() ||
          String(item.SourceId ?? item.codigo ?? ""),
      }))
      .filter((o: OrigemIFS) => o.codigo)
      .sort((a: OrigemIFS, b: OrigemIFS) => a.nome.localeCompare(b.nome, "pt-BR"));
  } catch (err) {
    console.error("[ApiPass] Erro ao buscar origens:", err);
    return [];
  }
}

export async function buscarMercadosIFS(): Promise<MercadoIFS[]> {
  try {
    const { ok, status, json } = await callApiPass("/mercados");

    if (!ok) {
      console.warn(`[ApiPass] Erro ao buscar mercados: ${status}`);
      return [];
    }

    return extrairLista(json)
      .map((item: any) => ({
        codigo: String(item.MarketCode ?? item.codigo ?? "").trim(),
        nome:
          String(item.Description ?? item.nome ?? "").trim() ||
          String(item.MarketCode ?? item.codigo ?? ""),
      }))
      .filter((m: MercadoIFS) => m.codigo)
      .sort((a: MercadoIFS, b: MercadoIFS) => a.nome.localeCompare(b.nome, "pt-BR"));
  } catch (err) {
    console.error("[ApiPass] Erro ao buscar mercados:", err);
    return [];
  }
}

// ─── Cores dos Mercados (derivadas do IFS) ─────────────────────────────────
//
// A cor é atribuída pela POSIÇÃO do mercado numa lista canônica vinda do
// IFS (via API PASS), ordenada por MarketCode (estável), garantindo
// mapeamento único e idêntico em qualquer tela que chame esta função.

const CORES_MERCADO = [
  "#CC0000",
  "#F59E0B",
  "#22C55E",
  "#6366F1",
  "#06B6D4",
  "#111111",
  "#8B5CF6",
  "#EC4899",
  "#F97316",
  "#14B8A6",
  "#0EA5E9",
  "#A855F7",
  "#84CC16",
  "#E11D48",
  "#FACC15",
  "#3B82F6",
];
const COR_MERCADO_DESCONHECIDO = "#9CA3AF";

const MERCADO_CORES_CACHE_KEY = "mercadoCoresMap";

export async function getMapaCoresMercados(
  forcarAtualizacao = false
): Promise<Record<string, string>> {
  if (!forcarAtualizacao) {
    try {
      const cached = await AsyncStorage.getItem(MERCADO_CORES_CACHE_KEY);
      if (cached) return JSON.parse(cached) as Record<string, string>;
    } catch {}
  }

  const mercados = await buscarMercadosIFS();
  const ordenados = [...mercados].sort((a, b) => a.codigo.localeCompare(b.codigo));

  const mapa: Record<string, string> = {};
  ordenados.forEach((m, i) => {
    mapa[m.nome] = CORES_MERCADO[i % CORES_MERCADO.length];
  });

  try {
    await AsyncStorage.setItem(MERCADO_CORES_CACHE_KEY, JSON.stringify(mapa));
  } catch (err) {
    console.warn("[ApiPass] Falha ao cachear cores de mercado:", err);
  }

  return mapa;
}

export function corMercado(mapa: Record<string, string>, nomeMercado: string): string {
  return mapa[nomeMercado] ?? COR_MERCADO_DESCONHECIDO;
}

// ─── Criar Lead ───────────────────────────────────────────────────────────────
//
// POST /leads na API PASS. A API PASS NÃO formata essa resposta — ela
// repassa o retorno cru do IFS, do tipo:
//   { body: { LeadId: "VA228", ... }, status: 200, headers: {}, ... }
// Por isso a resposta passa por normalizarRespostaLead() antes de voltar
// pro chamador, garantindo sempre o shape { success, leadId } ou
// { success: false, error, rawError }.

export async function criarLeadIFS(formData: {
  nomeEmpresa: string;
  nomeContato?: string;
  cnpj?: string;
  idioma?: string;
  idiomaCodigo?: string;
  pais?: string;
  paisCodigo?: string;
  origemCodigo?: string;
  mercadoCodigo?: string;
  eventoObjkey?: string;
  dataCriacao?: string;
  mainRepresentativeId?: string;
  potencial?: string;
  [key: string]: any;
}): Promise<IFSApiResponse> {
  if (!formData.nomeEmpresa?.trim()) {
    return { success: false, error: "Nome da empresa é obrigatório." };
  }

  if (!formData.mainRepresentativeId) {
    console.warn(
      "[ApiPass] mainRepresentativeId não informado — verifique se o executivo logado foi validado corretamente antes de salvar."
    );
  }

  // Mesma lógica de antes: se a tela já mandou o código do país, usa ele
  // direto; só cai no lookup por nome como fallback de compatibilidade.
  const codigoPais =
    formData.paisCodigo?.trim() || (await obterCodigoPais(formData.pais ?? "Brasil"));

  const codigoOrigemPuro = formData.origemCodigo?.trim();
  const sourceIdIFS = codigoOrigemPuro ? `Id${codigoOrigemPuro}` : "Id20";

  // O prepare-lead-payload na API PASS já monta o resto do payload (campos
  // Cf_, defaults, etc.) — o app só precisa mandar o shape "de entrada" que
  // o node espera, igual antes.
  const body = {
    nomeEmpresa: formData.nomeEmpresa.trim(),
    nomeContato: formData.nomeContato?.trim() || undefined,
    idioma: formData.idioma,
    idiomaCodigo: formData.idiomaCodigo?.trim() || mapIdioma(formData.idioma ?? "Português"),
    paisCodigo: codigoPais,
    origemCodigo: codigoOrigemPuro,
    mercadoCodigo: formData.mercadoCodigo?.trim() || undefined,
    eventoObjkey: formData.eventoObjkey?.trim() || undefined,
    dataCriacao: formatDateToISO(formData.dataCriacao ?? ""),
    mainRepresentativeId: formData.mainRepresentativeId ?? "197",
    potencial: formData.potencial,
    consentimentoTratamentoDados: false,
  };

  if (__DEV__) {
    console.log("[ApiPass] Body /leads:", JSON.stringify(body, null, 2));
  }

  try {
    const { ok, status, json, rawText } = await callApiPass<any>("/leads", {
      method: "POST",
      body,
    });

    if (__DEV__) {
      console.log("[ApiPass] Resposta crua /leads:", status, rawText);
    }

    if (!ok || !json) {
      return {
        success: false,
        error: `Erro HTTP ${status} ao chamar API PASS.`,
        rawError: rawText,
      };
    }

    return normalizarRespostaLead(json, rawText);
  } catch (err: any) {
    console.error("[ApiPass] Exceção ao criar lead:", err);

    const msg = String(err?.message ?? "");
    const isFailedToFetch =
      msg === "Failed to fetch" ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      err?.name === "TypeError";

    // Mensagem exibida ao usuário: sempre genérica e acionável, sem termos
    // técnicos (CORS, certificado, nome de ambiente de teste). O detalhe
    // técnico real vai só em rawError, que é logado/consultado por quem dá
    // suporte — nunca mostrado direto na tela.
    const mensagem = isFailedToFetch
      ? "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente."
      : "Ocorreu um erro inesperado ao salvar o lead. Tente novamente em instantes.";

    return {
      success: false,
      error: mensagem,
      rawError: `${err?.name}: ${msg}`,
    };
  }
}