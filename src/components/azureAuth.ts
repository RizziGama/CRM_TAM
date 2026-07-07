import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

// Obrigatório: garante que a aba do navegador feche sozinha e devolva o
// controle ao app assim que o redirect (login OU logout) acontecer.
WebBrowser.maybeCompleteAuthSession();

const TENANT_ID = '0f6c3d72-4681-407d-8b0c-53c6d8fa9219';
const CLIENT_ID = 'bc20655f-af9c-4d09-9465-b86fc63518e0';

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
  endSessionEndpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout`,
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'tamexecutiva',
  path: 'redirect',
});

export interface AzureAuthResult {
  accessToken: string;
  idToken?: string;
}

export interface AzureUserInfo {
  name: string;
  email: string;
  initials: string;
}

// ─── Decodificação do ID Token (JWT) ───────────────────────────────────────
//
// O ID Token é um JWT (header.payload.signature) em Base64URL. Não
// precisamos validar assinatura aqui — isso já foi feito pelo Azure AD na
// troca do código; só precisamos ler o "payload" para extrair claims como
// nome e e-mail do usuário que acabou de logar.

function base64UrlDecode(input: string): string {
  // Base64URL -> Base64 padrão
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  // atob está disponível tanto no runtime web quanto no Hermes/React Native.
  const decoded = atob(base64);

  // Decodifica UTF-8 corretamente (nomes com acentos, etc.)
  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
  } catch {
    return decoded;
  }
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch (err) {
    console.warn('[azureAuth] Falha ao decodificar ID Token:', err);
    return null;
  }
}

function computeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Extrai nome/e-mail reais das claims do Azure AD. Diferentes tenants/fluxos
// podem popular claims um pouco diferentes, então tentamos várias opções
// antes de cair num fallback.
function extractUserInfo(idToken: string): AzureUserInfo | null {
  const claims = decodeJwtPayload(idToken);
  if (!claims) return null;

  // Prioridade: claims.name (o mais comum no v2.0 endpoint) > montagem via
  // given_name/family_name (caso existam) > preferred_username/email > fallback.
  //
  // FIX: antes, quando "name" existia mas "given_name"/"family_name" não,
  // o código montava `${given_name} ${family_name}`.trim() mesmo assim,
  // resultando em string vazia e derrubando pro fallback "Usuário".
  const nameFromParts =
    claims.given_name || claims.family_name
      ? `${claims.given_name ?? ''} ${claims.family_name ?? ''}`.trim()
      : '';

  const name: string =
    claims.name ||
    nameFromParts ||
    claims.preferred_username ||
    claims.email ||
    'Usuário';

  const email: string =
    claims.preferred_username || claims.email || claims.upn || '';

  return {
    name,
    email,
    initials: computeInitials(name || email || '?'),
  };
}

// ─── Login ──────────────────────────────────────────────────────────────────

export async function loginAzure(): Promise<AzureAuthResult | null> {
  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);

  // Usuário cancelou / fechou a janela de login — não é erro, só sai.
  if (result.type !== 'success') {
    return null;
  }

  const code = result.params.code;
  if (!code) {
    throw new Error('Código de autorização não retornado pelo Azure AD.');
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier! },
    },
    discovery
  );

  await SecureStore.setItemAsync('accessToken', tokenResult.accessToken);
  await SecureStore.setItemAsync('idToken', tokenResult.idToken ?? '');

  // Extrai nome/e-mail reais do usuário que acabou de logar e persiste para
  // uso em qualquer tela (avatar, menu de usuário, etc.) sem precisar
  // decodificar o token de novo toda hora.
  if (tokenResult.idToken) {
    const userInfo = extractUserInfo(tokenResult.idToken);
    if (userInfo) {
      await SecureStore.setItemAsync('userInfo', JSON.stringify(userInfo));
    }
  }

  return {
    accessToken: tokenResult.accessToken,
    idToken: tokenResult.idToken,
  };
}

// ─── Logout ─────────────────────────────────────────────────────────────────

export async function logoutAzure(): Promise<void> {
  const idToken = await SecureStore.getItemAsync('idToken');

  // Apaga a sessão local primeiro — mesmo que o passo de logout no
  // navegador falhe lá embaixo, o usuário já está deslogado do app.
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('idToken');
  await SecureStore.deleteItemAsync('userInfo');

  const params = new URLSearchParams({
    post_logout_redirect_uri: redirectUri,
    ...(idToken ? { id_token_hint: idToken } : {}),
  });
  const logoutUrl = `${discovery.endSessionEndpoint}?${params.toString()}`;

  try {
    // AuthSession.startAsync foi removido do expo-auth-session moderno.
    // O jeito atual de abrir/fechar a sessão de logout do navegador é via
    // expo-web-browser, com maybeCompleteAuthSession() acima fechando o
    // fluxo quando o redirect (tamexecutiva://redirect) acontecer.
    await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri);
  } catch (err) {
    console.warn('[azureAuth] Falha ao encerrar sessão SSO no navegador:', err);
  }
}

// ─── Token atual ────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('accessToken');
}

// ─── Usuário logado atual ──────────────────────────────────────────────────
//
// Retorna nome/e-mail/iniciais reais do usuário Microsoft autenticado,
// lidos do ID Token salvo no login. Retorna null se não houver sessão.

export async function getUserInfo(): Promise<AzureUserInfo | null> {
  const stored = await SecureStore.getItemAsync('userInfo');
  if (stored) {
    try {
      return JSON.parse(stored) as AzureUserInfo;
    } catch {
      // cai para tentar recalcular a partir do idToken abaixo
    }
  }

  // Fallback: se por algum motivo o userInfo não foi persistido (ex.: login
  // feito antes desta atualização), tenta recalcular a partir do idToken
  // ainda salvo, e já corrige o cache para as próximas leituras.
  const idToken = await SecureStore.getItemAsync('idToken');
  if (idToken) {
    const userInfo = extractUserInfo(idToken);
    if (userInfo) {
      await SecureStore.setItemAsync('userInfo', JSON.stringify(userInfo));
      return userInfo;
    }
  }

  return null;
}
