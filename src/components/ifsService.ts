// ─── Configuração ─────────────────────────────────────────────────────────────

const IFS_BASE_URL =
  "https://tamifssup.avcweb.com.br:443/int/ifsapplications/projection/v1/BusinessLeadHandling.svc";

const IFS_USER = "INTEGRACAO";
const IFS_PASS = "Fk0E8M>8t?7y";

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
  OldLeadId: null, // ajuste caso você tenha esse valor
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
    console.error("[IFS] Exceção:", err);
    return {
      success: false,
      error: err?.message?.includes("fetch") || err?.message?.includes("Network")
        ? "Sem conexão com o servidor IFS."
        : err?.message ?? "Erro inesperado.",
    };
  }
}
