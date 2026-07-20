// ─── Configuração ─────────────────────────────────────────────────────────────
//
// As credenciais ficam em variáveis de ambiente (.env) ao invés de hardcoded.
// Crie/edite o arquivo .env na raiz do projeto com:
//
//   EXPO_PUBLIC_IFS_USER=INTEGRACAO
//   EXPO_PUBLIC_IFS_PASS=sua_senha_aqui
//
// Reinicie o Expo com --clear depois de criar/editar o .env.
// (Variáveis EXPO_PUBLIC_* ficam visíveis no bundle do cliente — isso é
// inevitável em apps que chamam a API direto do front-end. O ganho aqui é
// não deixar a senha "hardcoded" e versionada no histórico do git/arquivo.
// Adicione .env ao .gitignore.)

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const IFS_HOST = "https://tamifssup.avcweb.com.br:443/int/ifsapplications/projection/v1";

const IFS_BASE_URL = `${IFS_HOST}/BusinessLeadHandling.svc`;
const IFS_REPRESENTATIVE_URL = `${IFS_HOST}/BusinessRepresentativeHandling.svc`;
const IFS_EVENTOS_URL = `${IFS_HOST}/custProjEventLead.svc`;

const IFS_USER = process.env.EXPO_PUBLIC_IFS_USER ?? "INTEGRACAO";
const IFS_PASS = process.env.EXPO_PUBLIC_IFS_PASS ?? "";

if (!IFS_PASS) {
  console.warn(
    "[IFS] EXPO_PUBLIC_IFS_PASS não definida. Crie um arquivo .env na raiz do projeto."
  );
}

const basicAuth = "Basic " + btoa(`${IFS_USER}:${IFS_PASS}`);

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface IFSApiResponse {
  success: boolean;
  leadId?: string;
  error?: string;
  rawError?: string;
}

export interface ExecutivoInfo {
  id: string;       // RepresentativeId — usado como MainRepresentativeId no lead
  nome: string;      // Nome completo (PersonInfoRef.Name)
  userId: string;    // Username funcional do IFS (ex.: "RAFAEL.LEITE")
  ativo: boolean;    // Objstate === "Active"
}

// Evento de captação de leads (EventosLeadsSet no IFS).
export interface EventoLead {
  objkey: string;          // Objkey — identificador único do registro no IFS
  eventId: number | null;  // Cf_Event_Id
  nome: string;            // Cf_Nome_Evento
  dataEvento: string;      // Cf_Data_Evento — "YYYY-MM-DD"
  metaLeads: number;       // Cf_Meta_Leasds
  leadsRealizados: number | null; // Cf_Leads_Realizados (vindo do IFS, se houver)
  observacao: string;      // Cf_Observacao
  status: string;          // Cf_Status
}

const EXECUTIVO_CACHE_KEY = "executivoInfo";
const EVENTO_SELECIONADO_KEY = "eventoSelecionado";

// ─── Mapeamentos ──────────────────────────────────────────────────────────────

const mapIdioma = (idioma: string): string => {
  if (idioma.includes("Português")) return "bp"; // Português Brasil = "bp" no IFS
  if (idioma.includes("English"))   return "en";
  if (idioma.includes("Español"))   return "es";
  if (idioma.includes("Français"))  return "fr";
  if (idioma.includes("Deutsch"))   return "de";
  return "bp";
};

// "DD/MM/YYYY" → "YYYY-MM-DD"
const formatDateToISO = (date: string): string => {
  const parts = date.split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return new Date().toISOString().split("T")[0];
};

// ─── Verificar Executivo de Vendas ─────────────────────────────────────────────
//
// Consulta a lista de Executivos de Vendas do IFS (BusinessRepresentativeSet) e
// retorna o registro correspondente ao usuário logado no Azure AD, comparando
// o "UserId" do IFS (ex.: "RAFAEL.LEITE") com a parte antes do "@" do e-mail
// corporativo (ex.: "rafael.leite@dominio.com" → "RAFAEL.LEITE").
//
// Retorna null se:
//  - o usuário não existir na lista de representantes, OU
//  - existir mas estiver com Objstate = "Blocked".

export async function buscarExecutivoDeVendas(
  emailAzure: string
): Promise<ExecutivoInfo | null> {
  const userIdAlvo = emailAzure.split("@")[0]?.trim().toUpperCase();
  if (!userIdAlvo) return null;

  try {
    const url =
      `${IFS_REPRESENTATIVE_URL}/BusinessRepresentativeSet` +
      `?$expand=PersonInfoRef($select=Name,UserId)` +
      `&$select=RepresentativeId,Objstate`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": basicAuth,
      },
    });

    if (!response.ok) {
      console.warn(`[IFS] Falha ao buscar executivos: HTTP ${response.status}`);
      return null;
    }

    const json = await response.json();
    const lista: any[] = json?.value ?? [];

    const encontrado = lista.find((rep) => {
      const userId: string = rep?.PersonInfoRef?.UserId ?? "";
      return userId.trim().toUpperCase() === userIdAlvo;
    });

    if (!encontrado) {
      console.log(`[IFS] Usuário "${userIdAlvo}" não encontrado na lista de Executivos de Vendas.`);
      return null;
    }

    const ativo = encontrado.Objstate === "Active";

    return {
      id: String(encontrado.RepresentativeId),
      nome: encontrado.PersonInfoRef?.Name ?? emailAzure,
      userId: encontrado.PersonInfoRef?.UserId ?? userIdAlvo,
      ativo,
    };
  } catch (err) {
    console.error("[IFS] Erro ao verificar executivo de vendas:", err);
    return null;
  }
}

// ─── Cache local do Executivo logado ───────────────────────────────────────────
//
// Guardamos o executivo já validado no SecureStore para não precisar consultar
// o IFS de novo em toda tela que precisa mostrar/usar o nome/ID real.

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
//
// Busca a lista de eventos cadastrados no IFS (EventosLeadsSet). Usado na tela
// de Agenda para permitir trocar/selecionar o evento ativo.

export async function buscarEventosIFS(): Promise<EventoLead[]> {
  try {
    const url = `${IFS_EVENTOS_URL}/EventosLeadsSet`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": basicAuth,
      },
    });

    if (!response.ok) {
      console.warn(`[IFS] Falha ao buscar eventos: HTTP ${response.status}`);
      return [];
    }

    const json = await response.json();
    const lista: any[] = json?.value ?? [];

    return lista.map((ev) => ({
      objkey: ev.Objkey,
      eventId: ev.Cf_Event_Id ?? null,
      nome: ev.Cf_Nome_Evento?.trim() || "Evento sem nome",
      dataEvento: ev.Cf_Data_Evento ?? "",
      metaLeads: typeof ev.Cf_Meta_Leasds === "number" ? ev.Cf_Meta_Leasds : 0,
      leadsRealizados:
        typeof ev.Cf_Leads_Realizados === "number" ? ev.Cf_Leads_Realizados : null,
      observacao: ev.Cf_Observacao ?? "",
      status: ev.Cf_Status ?? "",
    }));
  } catch (err) {
    console.error("[IFS] Erro ao buscar eventos:", err);
    return [];
  }
}

// ─── Cache local do Evento selecionado ─────────────────────────────────────────
//
// Guarda qual evento o usuário escolheu como "ativo" na tela de Agenda, para
// que a seleção sobreviva entre aberturas do app (até trocar de novo).

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

// ─── Tipos de dados do IFS ─────────────────────────────────────────────────────

export interface PaisIFS {
  codigo: string;
  nome: string;
}

export interface IdiomaIFS {
  codigo: string;
  nome: string;
}

export interface OrigemIFS {
  codigo: string;   // SourceId puro do IFS (ex.: "20", "LB26")
  nome: string;     // Description
}

export interface MercadoIFS {
  codigo: string; // MarketCode
  nome: string;   // Description
}

export interface SegmentoIFS {
  codigo: string; // ex.: código do segmento no IFS
  nome: string;   // Description
}


// ─── Funções de busca de dados do IFS ─────────────────────────────────────────
export async function buscarPaisesIFS(): Promise<PaisIFS[]> {
  try {
    const response = await fetch(
      `${IFS_BASE_URL}/Reference_IsoCountry?$select=CountryCode,Description`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: basicAuth,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[IFS] Erro ao buscar países: ${response.status}`);
      return [];
    }

    const json = await response.json();

    return (json?.value ?? [])
      .map((item: any) => ({
        codigo: item.CountryCode,
        nome: item.Description,
      }))
      .sort((a: PaisIFS, b: PaisIFS) =>
        a.nome.localeCompare(b.nome, "pt-BR")
      );
  } catch (err) {
    console.error("[IFS] Erro ao buscar países:", err);
    return [];
  }
}

export async function obterCodigoPais(nomePais: string): Promise<string> {
  const paises = await buscarPaisesIFS();

  const encontrado = paises.find(
    (p) =>
      p.nome.trim().toUpperCase() ===
      nomePais.trim().toUpperCase()
  );

  return encontrado?.codigo ?? "BR";
}

export async function buscarIdiomasIFS(): Promise<IdiomaIFS[]> {
  try {
    const response = await fetch(
      `${IFS_BASE_URL}/Reference_Languages?$select=LanguageCode,Description`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: basicAuth,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[IFS] Erro ao buscar idiomas: ${response.status}`);
      return [];
    }

    const json = await response.json();

    return (json?.value ?? [])
      .map((item: any) => ({
        codigo: item.LanguageCode,
        nome: item.Description,
      }))
      .sort((a: IdiomaIFS, b: IdiomaIFS) =>
        a.nome.localeCompare(b.nome, "pt-BR")
      );
  } catch (err) {
    console.error("[IFS] Erro ao buscar idiomas:", err);
    return [];
  }
}

// ─── Origens (CustomerSource) ────────────────────────────────────────────────

const IFS_ORIGENS_URL = `${IFS_HOST}/CustomerSourcesHandling.svc`;

export async function buscarOrigensIFS(): Promise<OrigemIFS[]> {
  try {
    const response = await fetch(
      `${IFS_ORIGENS_URL}/CustomerSourceSet?$select=SourceId,Description,Objstate`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: basicAuth,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[IFS] Erro ao buscar origens: ${response.status}`);
      return [];
    }

    const json = await response.json();

    return (json?.value ?? [])
      .map((item: any) => ({
        codigo: String(item.SourceId ?? "").trim(),
        nome: String(item.Description ?? "").trim() || String(item.SourceId ?? ""),
      }))
      .filter((o: OrigemIFS) => o.codigo)
      .sort((a: OrigemIFS, b: OrigemIFS) =>
        a.nome.localeCompare(b.nome, "pt-BR")
      );
  } catch (err) {
    console.error("[IFS] Erro ao buscar origens:", err);
    return [];
  }
}

export async function buscarMercadosIFS(): Promise<MercadoIFS[]> {
  try {
    const response = await fetch(
      `${IFS_REPRESENTATIVE_URL}/Reference_SalesMarket?$select=MarketCode,Description`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: basicAuth,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[IFS] Erro ao buscar mercados: ${response.status}`);
      return [];
    }

    const json = await response.json();

    return (json?.value ?? [])
      .map((item: any) => ({
        codigo: String(item.MarketCode ?? "").trim(),
        nome: String(item.Description ?? "").trim() || String(item.MarketCode ?? ""),
      }))
      .filter((m: MercadoIFS) => m.codigo)
      .sort((a: MercadoIFS, b: MercadoIFS) =>
        a.nome.localeCompare(b.nome, "pt-BR")
      );
  } catch (err) {
    console.error("[IFS] Erro ao buscar mercados:", err);
    return [];
  }
}


// ─── Cores dos Mercados (derivadas do IFS) ─────────────────────────────────
//
// Antes cada tela calculava a cor por hash do nome do mercado — o que causava
// colisão (mercados diferentes com a mesma cor) e divergência entre telas
// (paletas de tamanhos diferentes em cada arquivo). Agora a cor é atribuída
// pela POSIÇÃO do mercado numa lista canônica vinda do IFS, ordenada por
// MarketCode (estável). Isso garante mapeamento único e idêntico em
// qualquer tela que chame esta função.

const CORES_MERCADO = [
  "#CC0000", // vermelho   (ex.: Financeiro)
  "#F59E0B", // âmbar      (ex.: Energia)
  "#22C55E", // verde      (ex.: Agronegócio)
  "#6366F1", // índigo     (ex.: Tecnologia)
  "#06B6D4", // ciano      (ex.: Saúde)
  "#111111", // preto      (ex.: Infraestrutura)
  "#8B5CF6", // roxo
  "#EC4899", // rosa
  "#F97316", // laranja
  "#14B8A6", // teal
  "#0EA5E9", // azul claro
  "#A855F7", // violeta
  "#84CC16", // lima
  "#E11D48", // rosé escuro
  "#FACC15", // amarelo
  "#3B82F6", // azul
];
const COR_MERCADO_DESCONHECIDO = "#9CA3AF"; // cinza — para "—" ou mercado fora da lista IFS

const MERCADO_CORES_CACHE_KEY = "mercadoCoresMap";

export async function getMapaCoresMercados(forcarAtualizacao = false): Promise<Record<string, string>> {
  if (!forcarAtualizacao) {
    try {
      const cached = await AsyncStorage.getItem(MERCADO_CORES_CACHE_KEY);
      if (cached) return JSON.parse(cached) as Record<string, string>;
    } catch {}
  }

  const mercados = await buscarMercadosIFS(); // já vem ordenado por nome
  // Reordena por código (identificador estável no IFS) pra a posição não
  // mudar se a Description de algum mercado for editada no futuro.
  const ordenados = [...mercados].sort((a, b) => a.codigo.localeCompare(b.codigo));

  const mapa: Record<string, string> = {};
  ordenados.forEach((m, i) => {
    mapa[m.nome] = CORES_MERCADO[i % CORES_MERCADO.length];
  });

  try {
    await AsyncStorage.setItem(MERCADO_CORES_CACHE_KEY, JSON.stringify(mapa));
  } catch (err) {
    console.warn("[IFS] Falha ao cachear cores de mercado:", err);
  }

  return mapa;
}

export function corMercado(mapa: Record<string, string>, nomeMercado: string): string {
  return mapa[nomeMercado] ?? COR_MERCADO_DESCONHECIDO;
}
// ─── Criar Lead ───────────────────────────────────────────────────────────────

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
  [key: string]: any;
}): Promise<IFSApiResponse> {

  if (!formData.nomeEmpresa?.trim()) {
    return { success: false, error: "Nome da empresa é obrigatório." };
  }

  if (!formData.mainRepresentativeId) {
    console.warn(
      "[IFS] mainRepresentativeId não informado — verifique se o executivo logado foi validado corretamente antes de salvar."
    );
  }

  // Se a tela já mandou o código do país (fluxo normal, vindo da seleção no
  // modal), usa ele direto. Só cai no lookup por nome (obterCodigoPais) como
  // fallback de compatibilidade, caso algum chamador antigo não informe.
  const codigoPais =
    formData.paisCodigo?.trim() ||
    (await obterCodigoPais(formData.pais ?? "Brasil"));

  // Origem: sempre no formato "Id<SOURCE_ID>". Se a tela mandou o código
  // puro (ex.: "70"), prefixa com "Id"; se veio vazio, usa "Id20"
  // (Prospecção) como default de compatibilidade.
  const codigoOrigemPuro = formData.origemCodigo?.trim();
  const sourceIdIFS = codigoOrigemPuro ? `Id${codigoOrigemPuro}` : "Id20";

  const payload = {
    Name: formData.nomeEmpresa.trim(),
    AssociationNo: null,
    DefaultLanguage: formData.idiomaCodigo?.trim() || mapIdioma(formData.idioma ?? "Português"),
    Country: codigoPais,
    CorporateForm: null,
    Turnover: null,
    TurnoverCurrency: "BRL",
    PotentialId: null,
    SourceId: sourceIdIFS,
    StageId: null,
    MainRepresentativeId: formData.mainRepresentativeId ?? "197",
    MarketCode: formData.mercadoCodigo?.trim() || null,
    Note: null,
    CreationDate: formatDateToISO(formData.dataCriacao ?? ""),
    CurrentUser: "INTEGRACAO",
    IsActivityConnected: "FALSE",
    DuplicateAction: "NOTHING",
    ReferenceType: "BusinessLead",
    VisibleDataSubConstColumn: "FALSE",
    ValidDataProcessingPurpose: false,
    DuplicateLead: false,
    ...(formData.nomeContato?.trim() && {
      MainContactName: formData.nomeContato.trim(),
    }),
    CountryCode: codigoPais,
    SourceRef: "BUSINESS_LEAD",
    CorporateFormDesc: null,
    OldLeadId: null,
    Duplicated: "FALSE",
    MainContactPersonId: null,
    NewPerson: true,

    // Campos customizados (Cf_)
    Cf_Atributos_Sensibilida: null,
    Cf_Cent_Serv_Mais_Proximo: null,
    Cf_Data_De_Aniversario: null,
    Cf_Direto_Ou_Indicado: null,
    Cf_Fatos_Relevantes_Clien: null,
    Cf_Modelo_Aeronave: null,
    Cf_Origem: null,
    Cf_Pratica_Gosta_Esporte: null,
    Cf_Programa_Recompensas: null,
    Cf_Regiao_Do_Cliente: null,
    Cf_Segmento_De_Atuacao: null,
    Cf_Tipo_De_Negocio: null,
    Cf_Evento_Lead: formData.eventoObjkey?.trim() || null,
  };

  console.log("[IFS] Payload:", JSON.stringify(payload, null, 2));
  console.log("[IFS] URL:", `${IFS_BASE_URL}/BusinessLeads`);
  console.log("[IFS] Ambiente:", typeof window !== "undefined" ? "WEB (navegador)" : "NATIVO (mobile)");

  try {
    const response = await fetch(`${IFS_BASE_URL}/BusinessLeads`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Accept":        "application/json",
        "Authorization": basicAuth,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text().catch(() => "");
    console.log(`[IFS] Status: ${response.status}`);
    console.log(`[IFS] Body: ${responseText}`);

    if (response.status === 200 || response.status === 201) {
      let leadId: string | undefined;
      try {
        const json = JSON.parse(responseText);
        leadId = json?.LeadId ?? json?.value?.LeadId;
      } catch {}
      return { success: true, leadId };
    }

    let errorMsg = `Erro HTTP ${response.status}`;
    try {
      const json = JSON.parse(responseText);
      const detail = json?.error?.details?.[0]?.message ?? "";
      const base   = json?.error?.message ?? json?.message ?? errorMsg;
      errorMsg = detail ? `${base}\n${detail}` : base;
    } catch {}

    return { success: false, error: errorMsg, rawError: responseText };

  } catch (err: any) {
    console.error("[IFS] Exceção bruta:", err);
    console.error("[IFS] Tipo do erro (name):", err?.name);
    console.error("[IFS] Mensagem:", err?.message);
    console.error("[IFS] Stack:", err?.stack);

    // "Failed to fetch" / "NetworkError" no navegador, sem NENHUM status HTTP
    // retornado, é o padrão clássico de bloqueio por CORS ou recusa de conexão
    // (servidor inacessível, SSL inválido, DNS, firewall).
    const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
    const msg = String(err?.message ?? "");
    const isFailedToFetch =
      msg === "Failed to fetch" ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      err?.name === "TypeError";

    let mensagem: string;
    if (isWeb && isFailedToFetch) {
      mensagem =
        "Não foi possível conectar ao servidor IFS pelo navegador (sem nenhuma resposta HTTP). " +
        "Causas mais prováveis, em ordem:\n" +
        "1) CORS — o servidor IFS não autoriza chamadas vindas de um navegador web.\n" +
        "2) Rede/VPN — o domínio só é alcançável dentro da rede corporativa/VPN.\n" +
        "3) Certificado SSL inválido ou não confiável para o navegador.\n\n" +
        "Como o app final roda nativo (Expo Go / build), esse bloqueio tende a não " +
        "existir lá. Teste no celular via Expo Go para confirmar.";
    } else if (isFailedToFetch) {
      mensagem = "Sem conexão com o servidor IFS. Verifique a rede/VPN do dispositivo.";
    } else {
      mensagem = msg || "Erro inesperado.";
    }

    return {
      success: false,
      error: mensagem,
      rawError: `${err?.name}: ${msg}`,
    };
  }
  
}
