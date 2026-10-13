import { describe, expect, it } from 'vitest'
import { summarize, totalsByCategory } from './resumo'

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
