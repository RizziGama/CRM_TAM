import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Tipos ────────────────────────────────────────────────────────────────────
//
// Guarda TODOS os leads criados no app localmente — sincronizados, pendentes
// ou com erro — pra ter histórico real (nada de mock) e permitir reenviar os
// que falharam ou ainda não sincronizaram.

export type LeadStatus = "sync" | "pendente" | "erro";

export interface LeadLocal {
  id: string;              // ID local (gerado no app, estável mesmo antes de sincronizar)
  ifsLeadId?: string;       // ID retornado pelo IFS quando o sync dá certo
  status: LeadStatus;
  erro?: string;            // última mensagem de erro, se houver
  criadoEm: string;         // ISO — quando foi criado localmente
  atualizadoEm: string;     // ISO — última tentativa/atualização

  // Dados do formulário (mesmo shape do LeadData do NovoLeadScreen)
  cnpj: string;
  nomeEmpresa: string;
  nomeContato: string;
  idioma: string;
  pais: string;
  origem: string;
  mercado: string;
  segmento: string;
  potencial: string;
  dataCriacao: string;
  leadDuplicado: boolean;
  notasEvento: string;
  telefone: string;
  email: string;
  executivoSecundario: string;

  evento?: string;         // nome do evento (exibição)
  eventoObjkey?: string;   // Objkey do evento no IFS — usado pra filtrar

  // Executivo responsável no momento da criação (pra manter atribuição
  // correta mesmo que outro usuário reenvie depois)
  mainRepresentativeId?: string;
  executivoNome?: string;
}

const STORAGE_KEY = "leads_locais";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function novoIdLocal(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function lerLista(): Promise<LeadLocal[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LeadLocal[];
  } catch (err) {
    console.warn("[leadsStore] Falha ao ler leads locais:", err);
    return [];
  }
}

async function salvarLista(lista: LeadLocal[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

// ─── API pública ──────────────────────────────────────────────────────────────

// Lista todos os leads, mais recentes primeiro.
export async function listarLeadsLocais(): Promise<LeadLocal[]> {
  const lista = await lerLista();
  return [...lista].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
}

// Cria ou atualiza (por id) um lead local.
export async function upsertLeadLocal(lead: LeadLocal): Promise<void> {
  const lista = await lerLista();
  const idx = lista.findIndex((l) => l.id === lead.id);
  if (idx >= 0) {
    lista[idx] = lead;
  } else {
    lista.push(lead);
  }
  await salvarLista(lista);
}

export async function removerLeadLocal(id: string): Promise<void> {
  const lista = await lerLista();
  await salvarLista(lista.filter((l) => l.id !== id));
}

export async function buscarLeadLocalPorId(id: string): Promise<LeadLocal | null> {
  const lista = await lerLista();
  return lista.find((l) => l.id === id) ?? null;
}

// Limpa TODO o cache local de leads (AsyncStorage). Não afeta o que já
// está sincronizado no IFS — apenas remove os registros salvos no
// dispositivo (histórico local de pendentes/erro/sync).
export async function limparCacheLeadsLocais(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[leadsStore] Falha ao limpar cache local de leads:", err);
    throw err;
  }
}
