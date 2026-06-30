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

const IFS_BASE_URL =
  "https://tamifssup.avcweb.com.br:443/int/ifsapplications/projection/v1/BusinessLeadHandling.svc";

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

// ─── Criar Lead ───────────────────────────────────────────────────────────────

export async function criarLeadIFS(formData: {
  nomeEmpresa: string;
  nomeContato?: string;
  cnpj?: string;
  idioma?: string;
  dataCriacao?: string;
  [key: string]: any;
}): Promise<IFSApiResponse> {

  if (!formData.nomeEmpresa?.trim()) {
    return { success: false, error: "Nome da empresa é obrigatório." };
  }

  const payload = {
    Name: formData.nomeEmpresa.trim(),
    AssociationNo: null,
    DefaultLanguage: mapIdioma(formData.idioma ?? "Português"),
    Country: "BR",
    CorporateForm: null,
    Turnover: null,
    TurnoverCurrency: "BRL",
    PotentialId: null,
    SourceId: "Id20",
    StageId: null,
    MainRepresentativeId: "197",
    MarketCode: null,
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
    CountryCode: "BR",
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
