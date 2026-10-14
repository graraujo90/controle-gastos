// @vitest-environment happy-dom
// Simula dois aparelhos conversando com um "OneDrive" em memória, passando pelo fluxo real de conexão.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O "OneDrive" de mentira: um arquivo e a versão dele. */
const cloud = vi.hoisted(() => ({
  text: null as string | null,
  version: 0,
  /** Acesso vencido: o OneDrive recusa até a conta passar de novo pela Microsoft. */
  expired: false,
  /** Idas à Microsoft para renovar o acesso; `silentOnly` é a tentativa automática, sem tela. */
  reauth: [] as { silentOnly: boolean }[],
  /** A Microsoft voltou sem login (pediu senha numa tentativa sem tela). */
  loginFails: false,
}))

vi.mock('./onedrive', () => {
  class GraphError extends Error {}
  class ReconnectError extends Error {}
  class TimeoutError extends Error {}
  return {
    GraphError,
    ReconnectError,
    TimeoutError,
    completeLogin: async () => {
      if (cloud.loginFails) throw new Error('login_required')
      return { homeAccountId: 'conta-1', username: 'teste@outlook.com' }
    },
    login: async () => undefined,
    forgetAccount: async () => undefined,
    ownFolder: async () => ({ driveId: 'd', folderId: 'f' }),
    sharedFolder: async () => ({ driveId: 'd', folderId: 'f' }),
    reauthenticate: async (_id: string, _user: string, silentOnly: boolean) => {
      cloud.reauth.push({ silentOnly })
    },
    download: async () => {
      if (cloud.expired) throw new ReconnectError('O acesso ao OneDrive expirou.')
      return cloud.text === null ? null : { text: cloud.text, eTag: String(cloud.version) }
    },
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

type Device = Awaited<ReturnType<typeof newDevice>>

const descriptions = async (device: Device) =>
  (await device.db.transactions.toArray()).map((t) => t.description).sort()

describe('sincronização entre aparelhos', () => {
  beforeEach(() => {
    cloud.text = null
    cloud.version = 0
    cloud.expired = false
    cloud.reauth = []
    cloud.loginFails = false
    sessionStorage.clear()
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

  it('acesso vencido: ao abrir, tenta renovar sem tela uma única vez; depois fica o aviso', async () => {
    const a = await newDevice()
    await a.connect('dono')
    cloud.expired = true
    // Reabrir o mesmo aparelho: banco novo nos testes, então leva junto o que estava guardado.
    const reopen = async (from: Device) => {
      const saved = await from.db.local.toArray()
      const device = await newDevice()
      await device.db.local.bulkPut(saved)
      await device.engine.initSync()
      await settle(device.engine)
      return device
    }

    // Ao abrir, a 1ª sincronização falha e o app vai sozinho à Microsoft, sem tela de login.
    const again = await reopen(a)
    await vi.waitFor(() => expect(cloud.reauth).toEqual([{ silentOnly: true }]))
    expect((await again.db.local.get('syncPending'))?.value).toMatchObject({ mode: 'dono', auto: true })

    // A Microsoft pediu senha e voltou sem conta: fica o aviso, sem nova tentativa automática.
    cloud.loginFails = true
    const back = await reopen(again)
    await settle(back.engine)
    expect(back.engine.getSyncState().status).toBe('reconectar')
    expect(cloud.reauth).toHaveLength(1)

    // Tocar em "Entrar de novo" vai à Microsoft com a conta indicada, podendo mostrar a tela.
    await back.engine.reconnect()
    expect(cloud.reauth.at(-1)).toEqual({ silentOnly: false })
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

describe('lançamentos recorrentes', () => {
  type Device = Awaited<ReturnType<typeof newDevice>>

  async function addRecurring(device: Device, count: number | undefined, paid = true) {
    const { todayISO } = await import('../lib/format')
    const category = (await device.db.categories.toArray()).find((c) => c.type === 'despesa' && !c.parentId)!
    const method = (await device.db.paymentMethods.toArray()).find((m) => m.kind !== 'credito')!
    await device.repo.saveRecurring(
      {
        type: 'despesa', date: todayISO(), dueDate: todayISO(), amount: 150000, categoryId: category.id,
        subcategoryId: null, paymentMethodId: method.id, description: 'aluguel', paid, resgate: false,
      },
      { frequency: 'mensal', count },
    )
    return (await device.db.recurrences.toArray())[0]
  }
  const numbers = async (device: Device) =>
    (await device.db.transactions.toArray()).map((t) => t.recurrenceNumber!).sort((a, b) => a - b)

  beforeEach(() => {
    cloud.text = null
    cloud.version = 0
  })

  it('com número de vezes: cria todas; a 1ª segue o formulário e as futuras ficam pendentes', async () => {
    const a = await newDevice()
    const rule = await addRecurring(a, 3)
    const txs = (await a.db.transactions.toArray()).sort((x, y) => x.recurrenceNumber! - y.recurrenceNumber!)
    expect(txs.map((t) => t.id)).toEqual([`${rule.id}:1`, `${rule.id}:2`, `${rule.id}:3`])
    expect(txs.map((t) => t.paid)).toEqual([true, false, false])
    expect(txs.every((t) => t.amount === 150000 && t.description === 'aluguel')).toBe(true)
    expect(new Set(txs.map((t) => t.month)).size).toBe(3)
  })

  it('sem data para acabar: lança 12 meses à frente e não recria o que foi apagado', async () => {
    const a = await newDevice()
    const rule = await addRecurring(a, undefined)
    expect(await numbers(a)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])

    await a.repo.deleteTransaction(`${rule.id}:3`)
    await a.repo.extendRecurrences()
    expect(await numbers(a)).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it('"este e os próximos" muda os seguintes pendentes e o modelo, sem tocar nos confirmados', async () => {
    const a = await newDevice()
    const rule = await addRecurring(a, 4)
    const second = (await a.db.transactions.get(`${rule.id}:2`))!
    await a.repo.setPaid((await a.db.transactions.get(`${rule.id}:3`))!, true)

    await a.repo.updateFollowing(second, {
      type: 'despesa', amount: 180000, categoryId: second.categoryId, subcategoryId: null,
      paymentMethodId: second.paymentMethodId, description: 'aluguel reajustado', resgate: false,
    })

    const amounts = Object.fromEntries((await a.db.transactions.toArray()).map((t) => [t.recurrenceNumber, t.amount]))
    // 1 é anterior; 2 é o próprio (o formulário grava à parte); 3 já estava confirmado; só o 4 muda.
    expect(amounts).toEqual({ 1: 150000, 2: 150000, 3: 150000, 4: 180000 })
    expect((await a.db.recurrences.get(rule.id))!.amount).toBe(180000)
  })

  it('"excluir este e os próximos" apaga daqui em diante e encerra a repetição', async () => {
    const a = await newDevice()
    const rule = await addRecurring(a, undefined)
    await a.repo.endRecurrence(rule.id, 3)
    expect(await numbers(a)).toEqual([1, 2])
    await a.repo.extendRecurrences()
    expect(await numbers(a)).toEqual([1, 2])
    expect((await a.db.recurrences.get(rule.id))!.ended).toBe(true)
  })

  it('encerrar pela tela apaga só os futuros pendentes', async () => {
    const a = await newDevice()
    const rule = await addRecurring(a, 5)
    await a.repo.endRecurrence(rule.id)
    // A 1ª é de hoje (não é futura); as outras quatro eram futuras e pendentes.
    expect(await numbers(a)).toEqual([1])
  })

  it('dois aparelhos completando a mesma recorrência não criam lançamentos em dobro', async () => {
    const a = await newDevice()
    const rule = await addRecurring(a, undefined)
    await a.connect('dono')
    expect(cloud.text).toContain(`${rule.id}:13`)

    const b = await newDevice()
    await b.connect('convidado')
    expect(await numbers(b)).toHaveLength(13)

    // Dois meses depois, cada aparelho abre o app sem ter sincronizado antes e completa por conta própria.
    const later = new Date()
    later.setMonth(later.getMonth() + 2)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(later)
    try {
      await a.repo.extendRecurrences()
      await b.repo.extendRecurrences()
      expect(await numbers(a)).toEqual(await numbers(b))
      expect((await numbers(b)).length).toBeGreaterThan(13)

      await a.engine.syncNow()
      await b.engine.syncNow()
      const all = await numbers(b)
      expect(new Set(all).size).toBe(all.length)
      expect(await b.db.transactions.count()).toBe(all.length)
    } finally {
      vi.useRealTimers()
    }
  })
})
