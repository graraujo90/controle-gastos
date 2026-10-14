// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { deleteInstallments, resetAll, saveInstallments, saveMethod, updateInstallmentGroup } from './repo'
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
