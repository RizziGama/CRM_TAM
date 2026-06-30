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
});

export interface AzureAuthResult {
  accessToken: string;
  idToken?: string;
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
