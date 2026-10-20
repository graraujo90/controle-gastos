// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { partsByInstallment } from '../domain/divisao'
import { dueDateFor } from '../domain/fatura'
import { db } from './db'
import {
  deleteInstallments, deleteSplitParts, deleteTransactions, extendRecurrences, removePerson, resetAll, saveInstallments,
  saveMethod, savePerson, saveRecurring, saveSplit, saveSplitInstallments, saveSplitRecurring, saveTransaction,
  setCategoryMany, setPaid, setPaidMany, setPersonMany, setShareOverride, shiftInstallments, splitSiblings,
  updateFollowing, updateInstallmentGroup, updateSplit,
} from './repo'
import type { Transaction } from './types'

/** Compra de R$ 400 em 4 vezes no boleto, de outubro a janeiro. */
async function buyInFour() {
  const category = (await db.categories.toArray()).find((c) => c.type === 'despesa' && !c.parentId)!
  const method = (await db.paymentMethods.toArray()).find((m) => m.kind !== 'credito')!
  await saveInstallments(
    {
      type: 'despesa', date: '2026-10-05', categoryId: category.id, subcategoryId: null,
      paymentMethodId: method.id, description: 'geladeira', paid: false, resgate: false,
    },
    ['2026-10-05', '2026-11-05', '2026-12-05', '2027-01-05'].map((dueDate, i) => ({ number: i + 1, amount: 10000, dueDate })),
  )
  return byNumber()
}

const byNumber = async () =>
  (await db.transactions.toArray()).sort((a, b) => a.installmentNumber! - b.installmentNumber!)

const changesFrom = (tx: Transaction, extra: Partial<Transaction>) => ({
  categoryId: tx.categoryId, subcategoryId: tx.subcategoryId, paymentMethodId: tx.paymentMethodId,
  description: tx.description, ...extra,
})

describe('alcance em compra parcelada', () => {
  beforeEach(async () => {
    await resetAll()
  })

  it('"esta e as próximas" leva a subcategoria só da parcela aberta em diante, sem mexer em valor e vencimento', async () => {
    const [, second] = await buyInFour()
    const sub = (await db.categories.toArray()).find((c) => c.parentId === second.categoryId)
    const subId = sub?.id ?? 'sub-teste'
    await updateInstallmentGroup(second, changesFrom(second, { subcategoryId: subId, description: 'geladeira nova' }), 'proximas')

    const txs = await byNumber()
    // A 2ª é gravada pelo formulário; a função cuida das outras.
    expect(txs.map((t) => t.subcategoryId)).toEqual([null, null, subId, subId])
    expect(txs.map((t) => t.description)).toEqual(['geladeira', 'geladeira', 'geladeira nova', 'geladeira nova'])
    expect(txs.map((t) => t.amount)).toEqual([10000, 10000, 10000, 10000])
    expect(txs.map((t) => t.dueDate)).toEqual(['2026-10-05', '2026-11-05', '2026-12-05', '2027-01-05'])
  })

  it('"todas" alcança também as parcelas anteriores', async () => {
    const [, , third] = await buyInFour()
    await updateInstallmentGroup(third, changesFrom(third, { description: 'fogão' }), 'todas')
    expect((await byNumber()).map((t) => t.description)).toEqual(['fogão', 'fogão', 'geladeira', 'fogão'])
  })

  it('passar para o cartão de crédito recalcula a fatura de cada parcela', async () => {
    const [first] = await buyInFour()
    const cardId = await saveMethod({ name: 'Cartão teste', kind: 'credito', use: 'pagamento', closingDay: 25, dueDay: 5, archived: false })
    await updateInstallmentGroup(first, changesFrom(first, { paymentMethodId: cardId }), 'todas')

    const others = (await byNumber()).slice(1)
    // Compra em 05/10 com fechamento dia 25: 1ª fatura vence 05/11; a 2ª parcela cai em 05/12, e assim por diante.
    expect(others.map((t) => t.dueDate)).toEqual(['2026-12-05', '2027-01-05', '2027-02-05'])
    expect(others.map((t) => t.month)).toEqual(['2026-12', '2027-01', '2027-02'])
  })

  it('mover de fatura leva todas as parcelas juntas, e voltar desfaz', async () => {
    const [first] = await buyInFour()
    const cardId = await saveMethod({ name: 'Cartão teste', kind: 'credito', use: 'pagamento', closingDay: 25, dueDay: 5, archived: false })
    await updateInstallmentGroup(first, changesFrom(first, { paymentMethodId: cardId }), 'todas')
    const third = (await byNumber())[2]

    await shiftInstallments(third, cardId, -1)
    const moved = (await byNumber()).filter((t) => t.id !== third.id)
    // Sem o ajuste: 05/11, 05/12, 05/01, 05/02. Uma fatura antes (a 3ª é gravada pelo formulário):
    expect(moved.map((t) => t.dueDate)).toEqual(['2026-10-05', '2026-11-05', '2027-01-05'])
    expect(moved.every((t) => t.invoiceShift === -1)).toBe(true)

    await shiftInstallments(third, cardId, 0)
    const back = (await byNumber()).filter((t) => t.id !== third.id)
    expect(back.map((t) => t.dueDate)).toEqual(['2026-11-05', '2026-12-05', '2027-02-05'])
    expect(back.every((t) => t.invoiceShift === undefined)).toBe(true)
  })

  it('valor mudado vale para cada parcela do alcance; o total da compra muda junto', async () => {
    const [, , third] = await buyInFour()
    await updateInstallmentGroup(third, changesFrom(third, { amount: 11000 }), 'proximas')
    // A 3ª é gravada pelo formulário; a função leva o valor só para a 4ª.
    expect((await byNumber()).map((t) => t.amount)).toEqual([10000, 10000, 10000, 11000])

    await updateInstallmentGroup(third, changesFrom(third, { amount: 12000, myShare: 6000 }), 'todas')
    const txs = (await byNumber()).filter((t) => t.id !== third.id)
    expect(txs.map((t) => t.amount)).toEqual([12000, 12000, 12000])
    expect(txs.map((t) => t.myShare)).toEqual([6000, 6000, 6000])
  })

  it('sem mudar o valor, cada parcela mantém o seu (inclusive os centavos da 1ª)', async () => {
    const category = (await db.categories.toArray()).find((c) => c.type === 'despesa' && !c.parentId)!
    const method = (await db.paymentMethods.toArray()).find((m) => m.kind !== 'credito')!
    await saveInstallments(
      { type: 'despesa', date: '2026-10-05', categoryId: category.id, subcategoryId: null, paymentMethodId: method.id, description: 'tv', paid: false, resgate: false },
      [10001, 10000].map((amount, i) => ({ number: i + 1, amount, dueDate: `2026-1${i}-05` })),
    )
    const [, second] = await byNumber()
    await updateInstallmentGroup(second, changesFrom(second, { description: 'televisão' }), 'todas')
    expect((await byNumber()).map((t) => [t.amount, t.description])).toEqual([[10001, 'televisão'], [10000, 'tv']])
  })

  it('excluir "esta e as próximas" mantém as anteriores e deixa registro para a sincronização', async () => {
    const [, , third] = await buyInFour()
    await deleteInstallments(third, 'proximas')
    expect((await byNumber()).map((t) => t.installmentNumber)).toEqual([1, 2])
    expect(await db.deletions.count()).toBe(2)
  })

  it('excluir "todas" apaga a compra inteira', async () => {
    const [, second] = await buyInFour()
    await deleteInstallments(second, 'todas')
    expect(await db.transactions.count()).toBe(0)
  })
})

describe('vários lançamentos de uma vez', () => {
  beforeEach(async () => {
    await resetAll()
  })

  async function setup() {
    const category = (await db.categories.toArray()).find((c) => c.type === 'despesa' && !c.parentId)!
    const cash = (await db.paymentMethods.toArray()).find((m) => m.kind !== 'credito')!
    const card = await saveMethod({ name: 'Cartão teste', kind: 'credito', use: 'pagamento', closingDay: 25, dueDay: 5, archived: false })
    const add = (description: string, paymentMethodId: string) =>
      saveTransaction({
        type: 'despesa', date: '2026-10-10', dueDate: paymentMethodId === card ? '2026-11-05' : '2026-10-10', amount: 1000,
        categoryId: category.id, subcategoryId: null, paymentMethodId, description, paid: false, resgate: false,
      })
    await add('padaria', cash.id)
    await add('farmácia', cash.id)
    await add('livro', card)
    await add('cinema', card)
    const all = await db.transactions.toArray()
    const get = (d: string) => all.find((t) => t.description === d)!
    return { get }
  }
  const paidOf = async () =>
    Object.fromEntries((await db.transactions.toArray()).map((t) => [t.description, t.paid]))

  it('confirmar marca os escolhidos; no cartão, a fatura inteira', async () => {
    const { get } = await setup()
    await setPaidMany([get('padaria'), get('livro')], true)
    expect(await paidOf()).toEqual({ padaria: true, farmácia: false, livro: true, cinema: true })
  })

  it('excluir vários deixa registro de exclusão para cada um', async () => {
    const { get } = await setup()
    await deleteTransactions([get('padaria').id, get('cinema').id])
    expect((await db.transactions.toArray()).map((t) => t.description).sort()).toEqual(['farmácia', 'livro'])
    expect(await db.deletions.count()).toBe(2)
  })

  it('mudar categoria troca categoria e subcategoria só dos escolhidos', async () => {
    const { get } = await setup()
    const other = (await db.categories.toArray()).filter((c) => c.type === 'despesa' && !c.parentId)[1]
    await setCategoryMany([get('livro').id, get('cinema').id], other.id, null)
    const cats = Object.fromEntries((await db.transactions.toArray()).map((t) => [t.description, t.categoryId]))
    expect(cats.livro).toBe(other.id)
    expect(cats.cinema).toBe(other.id)
    expect(cats.padaria).not.toBe(other.id)
  })
})

describe('compra dividida em categorias', () => {
  beforeEach(async () => {
    await resetAll()
  })

  async function market() {
    const [food, cleaning, other] = (await db.categories.toArray()).filter((c) => c.type === 'despesa' && !c.parentId)
    const cash = (await db.paymentMethods.toArray()).find((m) => m.kind !== 'credito')!
    const input = {
      type: 'despesa' as const, date: '2026-10-10', dueDate: '2026-10-10', paymentMethodId: cash.id,
      description: 'mercado', paid: false, resgate: false,
    }
    await saveSplit(input, [
      { categoryId: food.id, subcategoryId: null, amount: 22000 },
      { categoryId: cleaning.id, subcategoryId: null, amount: 8000 },
    ])
    return { input, food, cleaning, other, parts: await db.transactions.toArray() }
  }

  it('cria uma despesa por parte, ligadas e com os mesmos dados da compra', async () => {
    const { parts } = await market()
    expect(parts).toHaveLength(2)
    expect(new Set(parts.map((t) => t.splitGroupId)).size).toBe(1)
    expect(parts.every((t) => t.date === '2026-10-10' && t.description === 'mercado' && t.month === '2026-10')).toBe(true)
    expect(parts.reduce((sum, t) => sum + t.amount, 0)).toBe(30000)
  })

  it('editar mantém as partes que ficam e exclui as retiradas', async () => {
    const { input, food, other, parts } = await market()
    const kept = parts.find((t) => t.categoryId === food.id)!
    await updateSplit(kept, input, [
      { id: kept.id, categoryId: food.id, subcategoryId: null, amount: 20000 },
      { categoryId: other.id, subcategoryId: null, amount: 10000 },
    ], 'este')
    const after = await db.transactions.toArray()
    expect(after.map((t) => t.amount).sort()).toEqual([10000, 20000])
    expect(after.some((t) => t.id === kept.id)).toBe(true)
    expect(await db.deletions.count()).toBe(1)
  })

  it('confirmar uma parte confirma a compra inteira', async () => {
    const { parts } = await market()
    await setPaid(parts[0], true)
    expect((await db.transactions.toArray()).every((t) => t.paid)).toBe(true)
    await setPaidMany([parts[1]], false)
    expect((await db.transactions.toArray()).every((t) => !t.paid)).toBe(true)
  })

  it('excluir a divisão apaga todas as partes', async () => {
    const { parts } = await market()
    await deleteSplitParts(parts[0], 'este')
    expect(await db.transactions.count()).toBe(0)
  })
})

describe('recorrência no cartão movida de fatura', () => {
  beforeEach(async () => {
    await resetAll()
  })

  // Assinatura no dia 26, cartão que fecha dia 25 e vence dia 5: sem ajuste, cai duas faturas à frente.
  async function subscription(count: number | undefined, invoiceShift?: number) {
    const category = (await db.categories.toArray()).find((c) => c.type === 'despesa' && !c.parentId)!
    const cardId = await saveMethod({ name: 'Cartão teste', kind: 'credito', use: 'pagamento', closingDay: 25, dueDay: 5, archived: false })
    const card = (await db.paymentMethods.get(cardId))!
    await saveRecurring(
      {
        type: 'despesa', date: '2026-10-26', dueDate: dueDateFor('2026-10-26', card, invoiceShift), amount: 3990,
        categoryId: category.id, subcategoryId: null, paymentMethodId: cardId, description: 'streaming', paid: false,
        resgate: false, invoiceShift,
      },
      { frequency: 'mensal', count },
    )
    return card
  }
  const occurrences = async () =>
    (await db.transactions.toArray()).sort((a, b) => a.recurrenceNumber! - b.recurrenceNumber!)

  it('todas as ocorrências caem na fatura movida', async () => {
    await subscription(3, -1)
    const txs = await occurrences()
    expect(txs.map((t) => t.dueDate)).toEqual(['2026-11-05', '2026-12-05', '2027-01-05'])
    expect(txs.every((t) => t.invoiceShift === -1)).toBe(true)
  })

  it('as criadas depois pelo horizonte seguem o ajuste', async () => {
    const card = await subscription(undefined, -1)
    await extendRecurrences()
    const txs = await occurrences()
    expect(txs.length).toBeGreaterThan(3)
    expect(txs.every((t) => t.dueDate === dueDateFor(t.date, card, -1))).toBe(true)
  })

  it('"este e os próximos" leva o ajuste para as seguintes e para a regra; as anteriores ficam', async () => {
    await subscription(4)
    const [, second] = await occurrences()
    await updateFollowing(second, {
      type: 'despesa', amount: 3990, categoryId: second.categoryId, subcategoryId: null,
      paymentMethodId: second.paymentMethodId, description: 'streaming', resgate: false, invoiceShift: -1,
    })
    const txs = await occurrences()
    // 1ª sem ajuste; 2ª é gravada pelo formulário; 3ª e 4ª uma fatura antes.
    expect(txs.map((t) => t.dueDate)).toEqual(['2026-12-05', '2027-01-05', '2027-01-05', '2027-02-05'])
    expect((await db.recurrences.toArray())[0].invoiceShift).toBe(-1)
  })
})

describe('pessoas', () => {
  beforeEach(async () => {
    await resetAll()
  })

  const basics = async () => ({
    category: (await db.categories.toArray()).find((c) => c.type === 'despesa' && !c.parentId)!,
    cash: (await db.paymentMethods.toArray()).find((m) => m.kind !== 'credito')!,
  })

  it('pessoa sem uso é excluída; com lançamento, só arquivada', async () => {
    const { category, cash } = await basics()
    const unused = await savePerson({ name: 'Visita', kind: 'adulto', archived: false })
    const ana = await savePerson({ name: 'Ana', kind: 'adulto', archived: false })
    await saveTransaction({
      type: 'despesa', date: '2026-10-10', dueDate: '2026-10-10', amount: 8000, categoryId: category.id,
      subcategoryId: null, paymentMethodId: cash.id, description: 'salão', paid: true, resgate: false, personId: ana,
    })
    expect(await removePerson(unused)).toBe('excluida')
    expect(await removePerson(ana)).toBe('arquivada')
    expect((await db.people.get(ana))!.archived).toBe(true)
    expect(await db.deletions.count()).toBe(1)
  })

  it('recorrência e parcelas levam a pessoa; o alcance troca a pessoa nas outras parcelas', async () => {
    const { category, cash } = await basics()
    const pedro = await savePerson({ name: 'Pedro', kind: 'adulto', archived: false })
    const base = {
      type: 'despesa' as const, date: '2026-10-10', categoryId: category.id, subcategoryId: null,
      paymentMethodId: cash.id, description: 'futebol', paid: false, resgate: false, personId: pedro,
    }
    await saveRecurring({ ...base, dueDate: '2026-10-10', amount: 12000 }, { frequency: 'mensal', count: 3 })
    expect((await db.transactions.toArray()).every((t) => t.personId === pedro)).toBe(true)

    await deleteTransactions((await db.transactions.toArray()).map((t) => t.id))
    await saveInstallments({ ...base, description: 'chuteira' }, [
      { number: 1, amount: 5000, dueDate: '2026-10-10' },
      { number: 2, amount: 5000, dueDate: '2026-11-10' },
    ])
    const [first] = (await db.transactions.toArray()).sort((a, b) => a.installmentNumber! - b.installmentNumber!)
    await updateInstallmentGroup(first, {
      categoryId: first.categoryId, subcategoryId: null, paymentMethodId: first.paymentMethodId,
      description: first.description, personId: undefined,
    }, 'todas')
    const second = (await db.transactions.toArray()).find((t) => t.installmentNumber === 2)!
    expect(second.personId).toBeUndefined()
  })

  it('mudar pessoa de vários, inclusive para a família', async () => {
    const { category, cash } = await basics()
    const ana = await savePerson({ name: 'Ana', kind: 'adulto', archived: false })
    const add = (description: string) => saveTransaction({
      type: 'receita', date: '2026-10-05', dueDate: '2026-10-05', amount: 100000, categoryId: category.id,
      subcategoryId: null, paymentMethodId: cash.id, description, paid: true, resgate: false,
    })
    const ids = [await add('salário'), await add('bônus')]
    await setPersonMany(ids, ana)
    expect((await db.transactions.toArray()).every((t) => t.personId === ana)).toBe(true)
    await setPersonMany([ids[1]], null)
    expect((await db.transactions.get(ids[1]))!.personId).toBeUndefined()
  })
})

describe('divisão parcelada e recorrente', () => {
  beforeEach(async () => {
    await resetAll()
  })

  async function setup() {
    const [home, sport] = (await db.categories.toArray()).filter((c) => c.type === 'despesa' && !c.parentId)
    const cash = (await db.paymentMethods.toArray()).find((m) => m.kind !== 'credito')!
    const pedro = await savePerson({ name: 'Pedro', kind: 'adulto', archived: false })
    const common = {
      type: 'despesa' as const, date: '2026-10-10', paymentMethodId: cash.id, description: 'geladeira', paid: false,
      resgate: false,
    }
    return { home, sport, cash, pedro, common }
  }
  const slotOf = async (n: number) =>
    (await db.transactions.toArray()).filter((t) => t.installmentNumber === n).sort((a, b) => b.amount - a.amount)

  // Geladeira de R$ 1.000 em 4×: R$ 700 da família (Casa) e R$ 300 do Pedro (Esporte).
  async function fridge() {
    const s = await setup()
    const plan = ['2026-10-10', '2026-11-10', '2026-12-10', '2027-01-10'].map((dueDate, i) => ({ number: i + 1, amount: 25000, dueDate }))
    const parts = [
      { categoryId: s.home.id, subcategoryId: null, amount: 70000 },
      { categoryId: s.sport.id, subcategoryId: null, personId: s.pedro, amount: 30000 },
    ]
    await saveSplitInstallments(s.common, parts, plan, partsByInstallment(plan.map((p) => p.amount), [70000, 30000], 'total'))
    return s
  }

  it('cada parte vira uma série de parcelas; cada parcela fecha com o valor da fatura', async () => {
    const { pedro } = await fridge()
    const txs = await db.transactions.toArray()
    expect(txs).toHaveLength(8)
    expect(new Set(txs.map((t) => t.splitGroupId)).size).toBe(1)
    expect(new Set(txs.map((t) => t.installmentGroupId)).size).toBe(2)
    for (const n of [1, 2, 3, 4]) expect((await slotOf(n)).reduce((sum, t) => sum + t.amount, 0)).toBe(25000)
    expect(txs.filter((t) => t.personId === pedro).reduce((sum, t) => sum + t.amount, 0)).toBe(30000)
  })

  it('abrir uma parcela traz só as partes daquela parcela; confirmar confirma as duas', async () => {
    await fridge()
    const [first] = await slotOf(2)
    expect((await splitSiblings(first)).map((t) => t.installmentNumber)).toEqual([2, 2])
    await setPaid(first, true)
    expect((await db.transactions.toArray()).filter((t) => t.paid).map((t) => t.installmentNumber)).toEqual([2, 2])
  })

  it('"esta e as próximas": muda a pessoa da parte e cria a parte nova da parcela em diante', async () => {
    const { home, sport, common, cash } = await fridge()
    const [familyPart, pedroPart] = await slotOf(3)
    await updateSplit(familyPart, { ...common, dueDate: '2026-12-10', paymentMethodId: cash.id }, [
      { id: familyPart.id, categoryId: home.id, subcategoryId: null, amount: 12500 },
      { id: pedroPart.id, categoryId: sport.id, subcategoryId: null, amount: 7500 },
      { categoryId: sport.id, subcategoryId: null, amount: 5000 },
    ], 'proximos')
    // Parcelas 1 e 2 não mudam; 3 e 4 passam a ter três partes, ainda somando a parcela.
    expect((await slotOf(2)).map((t) => t.amount)).toEqual([17500, 7500])
    for (const n of [3, 4]) {
      const slot = await slotOf(n)
      expect(slot.map((t) => t.amount)).toEqual([12500, 7500, 5000])
      expect(slot.find((t) => t.amount === 7500)!.personId).toBeUndefined()
    }
  })

  it('excluir "todas" apaga a compra inteira, com todas as partes', async () => {
    await fridge()
    const [first] = await slotOf(1)
    await deleteSplitParts(first, 'todas')
    expect(await db.transactions.count()).toBe(0)
  })

  it('recorrência dividida: uma regra por parte; "este e os próximos" retira uma parte daqui em diante', async () => {
    const { home, sport, pedro, common } = await setup()
    await saveSplitRecurring({ ...common, description: 'internet', dueDate: '2026-10-10' }, [
      { categoryId: home.id, subcategoryId: null, amount: 8000 },
      { categoryId: sport.id, subcategoryId: null, personId: pedro, amount: 2000 },
    ], { frequency: 'mensal', count: 4 })
    expect(await db.recurrences.count()).toBe(2)
    const byDate = async (date: string) => (await db.transactions.toArray()).filter((t) => t.date === date)
    expect((await byDate('2026-12-10')).map((t) => t.amount).sort()).toEqual([2000, 8000])

    const [third] = (await byDate('2026-12-10')).filter((t) => t.amount === 8000)
    await updateSplit(third, { ...common, description: 'internet', dueDate: '2026-12-10', date: '2026-12-10' }, [
      { id: third.id, categoryId: home.id, subcategoryId: null, amount: 10000 },
    ], 'proximos')
    expect((await byDate('2026-11-10')).map((t) => t.amount).sort()).toEqual([2000, 8000])
    expect((await byDate('2026-12-10')).map((t) => t.amount)).toEqual([10000])
    expect((await byDate('2027-01-10')).map((t) => t.amount)).toEqual([10000])
  })
})

describe('ajuste manual da proporção', () => {
  beforeEach(async () => {
    await resetAll()
  })

  it('vale só para o mês; voltar ao automático apaga e deixa registro para a sincronização', async () => {
    await setShareOverride('2026-10', { ana: 50, pedro: 50 })
    expect((await db.settings.get('proporcao:2026-10'))!.value).toEqual({ ana: 50, pedro: 50 })
    expect(await db.settings.get('proporcao:2026-11')).toBeUndefined()
    await setShareOverride('2026-10', null)
    expect(await db.settings.get('proporcao:2026-10')).toBeUndefined()
    expect(await db.deletions.count()).toBe(1)
  })
})
