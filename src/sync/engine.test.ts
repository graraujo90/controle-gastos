// @vitest-environment happy-dom
// Simula dois aparelhos conversando com um "OneDrive" em memória, passando pelo fluxo real de conexão.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O "OneDrive" de mentira: um arquivo e a versão dele. */
const cloud = vi.hoisted(() => ({ text: null as string | null, version: 0 }))

vi.mock('./onedrive', () => {
  class GraphError extends Error {}
  class ReconnectError extends Error {}
  class TimeoutError extends Error {}
  return {
    GraphError,
    ReconnectError,
    TimeoutError,
    completeLogin: async () => ({ homeAccountId: 'conta-1', username: 'teste@outlook.com' }),
    login: async () => undefined,
    forgetAccount: async () => undefined,
    ownFolder: async () => ({ driveId: 'd', folderId: 'f' }),
    sharedFolder: async () => ({ driveId: 'd', folderId: 'f' }),
    download: async () => (cloud.text === null ? null : { text: cloud.text, eTag: String(cloud.version) }),
    upload: async (_account: string, _ref: unknown, text: string, eTag?: string) => {
      if (eTag !== undefined && eTag !== String(cloud.version)) return null
      cloud.text = text
      return String(++cloud.version)
    },
  }
})

/** Liga um "aparelho" novo: banco zerado e módulos recarregados, como um navegador que nunca abriu o app. */
async function newDevice() {
  vi.resetModules()
  // O Dexie guarda a referência do banco ao ser carregado; é nela que se troca por um banco vazio.
  const { default: Dexie } = await import('dexie')
  Dexie.dependencies.indexedDB = new (await import('fake-indexeddb')).IDBFactory()
  const { db } = await import('../db/db')
  const repo = await import('../db/repo')
  const engine = await import('./engine')
  const connect = async (mode: 'dono' | 'convidado') => {
    await db.local.put({ key: 'syncPending', value: { mode, link: 'https://1drv.ms/x' } })
    await engine.initSync()
    await settle(engine)
  }
  return { db, repo, engine, connect }
}

/** Espera a sincronização em curso terminar; falha se ela nunca sair de "sincronizando". */
async function settle(engine: typeof import('./engine')) {
  for (let i = 0; i < 200; i++) {
    if (engine.getSyncState().status !== 'sincronizando') return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('a sincronização ficou presa em "sincronizando"')
}

async function addExpense(device: Awaited<ReturnType<typeof newDevice>>, description: string) {
  const category = (await device.db.categories.toArray()).find((c) => c.type === 'despesa' && !c.parentId)!
  const method = (await device.db.paymentMethods.toArray())[0]
  return device.repo.saveTransaction({
    type: 'despesa', date: '2026-10-13', dueDate: '2026-10-13', amount: 1000, categoryId: category.id,
    subcategoryId: null, paymentMethodId: method.id, description, paid: true, resgate: false,
  })
}

const descriptions = async (device: Awaited<ReturnType<typeof newDevice>>) =>
  (await device.db.transactions.toArray()).map((t) => t.description).sort()

describe('sincronização entre aparelhos', () => {
  beforeEach(() => {
    cloud.text = null
    cloud.version = 0
  })

  it('primeiro aparelho (dono) cria o arquivo na nuvem com os dados dele', async () => {
    const a = await newDevice()
    await addExpense(a, 'mercado')
    await a.connect('dono')

    expect(a.engine.getSyncState().status).toBe('ok')
    expect(cloud.text).toContain('mercado')
  })

  it('segundo aparelho, sem lançamentos, adota os dados da nuvem e termina sincronizado', async () => {
    const a = await newDevice()
    await addExpense(a, 'mercado')
    await a.connect('dono')

    const b = await newDevice()
    await b.connect('dono')

    expect(b.engine.getSyncState().status).toBe('ok')
    expect(await descriptions(b)).toEqual(['mercado'])
    // Adota também as categorias da nuvem, sem duplicar com os cadastros iniciais do aparelho.
    expect(await b.db.categories.count()).toBe(await a.db.categories.count())
  })

  it('lançamento feito depois de conectar chega à nuvem e ao outro aparelho', async () => {
    const a = await newDevice()
    await a.connect('dono')
    const b = await newDevice()
    await b.connect('convidado')

    await addExpense(b, 'farmácia')
    await b.engine.syncNow()
    expect(cloud.text).toContain('farmácia')

    // "a" foi recarregado ao criar "b"; reabrir o aparelho A é conectar de novo um banco que já tem os dados.
    const again = await newDevice()
    await again.connect('dono')
    expect(await descriptions(again)).toEqual(['farmácia'])
  })

  it('exclusão em um aparelho remove o lançamento da nuvem', async () => {
    const a = await newDevice()
    const id = await addExpense(a, 'mercado')
    await a.connect('dono')
    await a.repo.deleteTransaction(id)
    await a.engine.syncNow()

    const b = await newDevice()
    await b.connect('convidado')
    expect(await descriptions(b)).toEqual([])
  })

  it('aparelho com lançamentos conectando a uma nuvem com dados pede escolha, sem misturar', async () => {
    const a = await newDevice()
    await addExpense(a, 'da nuvem')
    await a.connect('dono')

    const b = await newDevice()
    await addExpense(b, 'do aparelho')
    await b.connect('dono')
    expect(b.engine.getSyncState().status).toBe('escolher')
    expect(await descriptions(b)).toEqual(['do aparelho'])

    await b.engine.choose('nuvem')
    await settle(b.engine)
    expect(b.engine.getSyncState().status).toBe('ok')
    expect(await descriptions(b)).toEqual(['da nuvem'])
  })
})
