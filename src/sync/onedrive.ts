// Tudo que fala com a Microsoft: login (MSAL) e arquivos do OneDrive (Microsoft Graph).
// O app só lê e grava um arquivo: FILE_NAME dentro da pasta FOLDER_NAME.
import type { AccountInfo, PublicClientApplication } from '@azure/msal-browser'
import { AUTHORITY, CLIENT_ID, FILE_NAME, FOLDER_NAME, redirectUri, SCOPES } from './config'

const GRAPH = 'https://graph.microsoft.com/v1.0'

/** Onde o arquivo de dados mora: a pasta (do próprio usuário ou compartilhada com ele). */
export interface FolderRef {
  driveId: string
  folderId: string
}

export class GraphError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** O login expirou e não dá para renovar sem o usuário: é preciso conectar de novo. */
export class ReconnectError extends Error {}

let clientPromise: Promise<PublicClientApplication> | null = null

// A biblioteca de login é carregada só quando a sincronização é usada.
function client(): Promise<PublicClientApplication> {
  clientPromise ??= import('@azure/msal-browser').then(async ({ PublicClientApplication }) => {
    const app = new PublicClientApplication({
      auth: { clientId: CLIENT_ID, authority: AUTHORITY, redirectUri: redirectUri() },
      cache: { cacheLocation: 'localStorage' },
    })
    await app.initialize()
    return app
  })
  return clientPromise
}

/** Conclui um login que acabou de voltar da Microsoft. Devolve a conta, ou null se não havia login em curso. */
export async function completeLogin(): Promise<AccountInfo | null> {
  const app = await client()
  // O app usa rotas em "#": o retorno do login também vem no "#", então é tratado aqui, antes das telas.
  const result = await app.handleRedirectPromise({ navigateToLoginRequestUrl: false })
  return result?.account ?? null
}

/** Leva o usuário à tela de login da Microsoft. A página é recarregada na volta. */
export async function login(): Promise<void> {
  const app = await client()
  await app.loginRedirect({ scopes: SCOPES, prompt: 'select_account' })
}

export async function forgetAccount(homeAccountId: string): Promise<void> {
  const app = await client()
  const account = app.getAccount({ homeAccountId })
  // Limpa só o que o app guardou neste aparelho; não desloga a conta Microsoft do navegador.
  if (account) await app.clearCache({ account })
}

async function token(homeAccountId: string): Promise<string> {
  const app = await client()
  const account = app.getAccount({ homeAccountId })
  if (!account) throw new ReconnectError('Conta não encontrada neste aparelho.')
  try {
    return (await app.acquireTokenSilent({ scopes: SCOPES, account })).accessToken
  } catch (error) {
    const { InteractionRequiredAuthError } = await import('@azure/msal-browser')
    if (error instanceof InteractionRequiredAuthError) throw new ReconnectError('O acesso ao OneDrive expirou.')
    throw error
  }
}

async function graph(homeAccountId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(GRAPH + path, {
    ...init,
    cache: 'no-store',
    headers: { ...init.headers, Authorization: `Bearer ${await token(homeAccountId)}` },
  })
  if (!response.ok && response.status !== 404 && response.status !== 412) {
    const body = await response.json().catch(() => null)
    throw new GraphError(response.status, body?.error?.message ?? `Erro ${response.status} do OneDrive.`)
  }
  return response
}

/** Pasta do app no OneDrive de quem está conectado; cria se ainda não existir. */
export async function ownFolder(homeAccountId: string): Promise<FolderRef> {
  let response = await graph(homeAccountId, `/me/drive/root:/${encodeURIComponent(FOLDER_NAME)}`)
  if (response.status === 404) {
    response = await graph(homeAccountId, '/me/drive/root/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
    })
  }
  const item = await response.json()
  return { driveId: item.parentReference.driveId, folderId: item.id }
}

/** Pasta compartilhada por outra pessoa, localizada pelo link de compartilhamento do OneDrive. */
export async function sharedFolder(homeAccountId: string, link: string): Promise<FolderRef> {
  const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(link.trim())))
  const shareId = 'u!' + base64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')
  const response = await graph(homeAccountId, `/shares/${shareId}/driveItem`, {
    // Faz o link passar a valer para a conta conectada, como acontece ao abri-lo no navegador.
    headers: { Prefer: 'redeemSharingLinkIfNecessary' },
  })
  if (response.status === 404) throw new GraphError(404, 'Link de compartilhamento não encontrado.')
  const item = await response.json()
  if (!item.folder) throw new GraphError(400, 'O link precisa ser da pasta "Controle de Gastos", não de um arquivo.')
  return { driveId: item.parentReference.driveId, folderId: item.id }
}

const filePath = (ref: FolderRef) => `/drives/${ref.driveId}/items/${ref.folderId}:/${FILE_NAME}`

/** Conteúdo e versão (eTag) do arquivo de dados; null se ele ainda não existe. */
export async function download(homeAccountId: string, ref: FolderRef): Promise<{ text: string; eTag: string } | null> {
  const meta = await graph(homeAccountId, filePath(ref))
  if (meta.status === 404) return null
  const item = await meta.json()
  const url: string | undefined = item['@microsoft.graph.downloadUrl']
  // O endereço de download já vem autorizado; sem ele, baixa pela própria API.
  const content = url ? await fetch(url, { cache: 'no-store' }) : await graph(homeAccountId, `${filePath(ref)}:/content`)
  if (!content.ok) throw new GraphError(content.status, 'Não foi possível baixar os dados do OneDrive.')
  return { text: await content.text(), eTag: item.eTag }
}

/**
 * Grava o arquivo de dados. Com `eTag`, só grava se ninguém alterou o arquivo desde a leitura;
 * devolve null quando alguém alterou (o chamador deve baixar, juntar e tentar de novo).
 */
export async function upload(homeAccountId: string, ref: FolderRef, text: string, eTag?: string): Promise<string | null> {
  const response = await graph(homeAccountId, `${filePath(ref)}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(eTag ? { 'If-Match': eTag } : {}) },
    body: text,
  })
  if (response.status === 412) return null
  if (response.status === 404) throw new GraphError(404, 'A pasta de dados não foi encontrada no OneDrive.')
  return (await response.json()).eTag
}
