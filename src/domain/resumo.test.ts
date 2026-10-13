import { describe, expect, it } from 'vitest'
import { CARDS_ROW, expenseBreakdown, methodBreakdown, summarize, totalsByCategory } from './resumo'

describe('expenseBreakdown', () => {
  const b = expenseBreakdown([
    { categoryId: 'moradia', subcategoryId: 'aluguel', amount: 82000, paid: true },
    { categoryId: 'moradia', subcategoryId: 'energia', amount: 18000, paid: false },
    { categoryId: 'alim', subcategoryId: null, amount: 60000, paid: true },
    { categoryId: 'alim', subcategoryId: 'mercado', amount: 40000, paid: true },
  ])

  it('soma o total e o que já foi pago', () => {
    expect(b.total).toBe(200000)
    expect(b.paid).toBe(182000)
  })

  it('peso de cada categoria no total, da maior para a menor', () => {
    expect(b.categories.map((c) => [c.id, c.total, c.share])).toEqual([
      ['moradia', 100000, 0.5],
      ['alim', 100000, 0.5],
    ])
  })

  it('peso de cada subcategoria dentro da categoria, com os sem subcategoria à parte', () => {
    expect(b.categories[0].subs).toEqual([
      { id: 'aluguel', total: 82000, share: 0.82 },
      { id: 'energia', total: 18000, share: 0.18 },
    ])
    expect(b.categories[1].subs).toEqual([
      { id: '', total: 60000, share: 0.6 },
      { id: 'mercado', total: 40000, share: 0.4 },
    ])
  })

  it('sem despesas não divide por zero', () => {
    expect(expenseBreakdown([])).toEqual({ total: 0, paid: 0, categories: [] })
  })
})

describe('methodBreakdown', () => {
  const credit = new Set(['nubank', 'itau'])

  it('agrupa os cartões de crédito e mostra o peso de cada um dentro do grupo', () => {
    const rows = methodBreakdown(
      [
        { paymentMethodId: 'pix', amount: 20000 },
        { paymentMethodId: 'nubank', amount: 45000 },
        { paymentMethodId: 'itau', amount: 15000 },
        { paymentMethodId: 'dinheiro', amount: 20000 },
      ],
      credit,
    )
    expect(rows.map((r) => [r.id, r.total, r.share])).toEqual([
      [CARDS_ROW, 60000, 0.6],
      ['pix', 20000, 0.2],
      ['dinheiro', 20000, 0.2],
    ])
    expect(rows[0].kind === 'cartoes' && rows[0].cards).toEqual([
      { id: 'nubank', total: 45000, share: 0.75 },
      { id: 'itau', total: 15000, share: 0.25 },
    ])
  })

  it('sem gasto no crédito não cria a linha de cartões', () => {
    const rows = methodBreakdown([{ paymentMethodId: 'pix', amount: 100 }], credit)
    expect(rows).toEqual([{ kind: 'forma', id: 'pix', total: 100, share: 1 }])
  })
})

describe('summarize', () => {
  it('separa os três tipos e desconta investimentos do resultado', () => {
    const s = summarize([
      { type: 'receita', amount: 500000 },
      { type: 'despesa', amount: 120050 },
      { type: 'despesa', amount: 30000 },
      { type: 'investimento', amount: 100000 },
    ])
    expect(s).toEqual({ receitas: 500000, despesas: 150050, investimentos: 100000, resultado: 249950 })
  })

  it('resgate abate dos investimentos e cobre a despesa no resultado, sem virar receita', () => {
    const s = summarize([
      { type: 'receita', amount: 500000 },
      { type: 'despesa', amount: 700000 },
      { type: 'investimento', amount: 50000 },
      { type: 'investimento', amount: 250000, resgate: true },
    ])
    expect(s).toEqual({ receitas: 500000, despesas: 700000, investimentos: -200000, resultado: 0 })
  })

  it('mês vazio zera tudo', () => {
    expect(summarize([])).toEqual({ receitas: 0, despesas: 0, investimentos: 0, resultado: 0 })
  })
})

describe('totalsByCategory', () => {
  it('soma por categoria e ordena do maior para o menor', () => {
    const r = totalsByCategory([
      { categoryId: 'a', amount: 100 },
      { categoryId: 'b', amount: 500 },
      { categoryId: 'a', amount: 250 },
    ])
    expect(r).toEqual([
      { categoryId: 'b', total: 500 },
      { categoryId: 'a', total: 350 },
    ])
  })
})
