import { describe, expect, it } from 'vitest'
import { payables, pendingByKind } from './contas'

describe('pendingByKind', () => {
  const pending = [
    { type: 'despesa', amount: 1000, dueDate: '2026-10-05' },
    { type: 'receita', amount: 500000, dueDate: '2026-10-30' },
    { type: 'receita', amount: 20000, dueDate: '2026-10-01' },
    { type: 'investimento', amount: 100000, dueDate: '2026-10-20' },
    { type: 'investimento', amount: 30000, dueDate: '2026-10-25', resgate: true },
    { type: 'investimento', amount: 70000, dueDate: '2026-11-20' },
  ] as const

  const r = pendingByKind([...pending], '2026-10-09', '2026-10')

  it('separa a pagar, a receber e a investir', () => {
    expect(r.pagar.monthTotal).toBe(1000)
    expect(r.investir.monthTotal).toBe(100000)
  })

  it('resgate pendente é dinheiro a receber, não a investir', () => {
    expect(r.receber.monthTotal).toBe(500000 + 20000 + 30000)
    expect(r.receber.monthCount).toBe(3)
  })

  it('receita prevista para data já passada conta como atrasada', () => {
    expect(r.receber.overdueCount).toBe(1)
    expect(r.receber.overdueTotal).toBe(20000)
  })
})

describe('payables', () => {
  const unpaid = [
    { amount: 1000, dueDate: '2026-09-20' }, // atrasada, mês anterior
    { amount: 2000, dueDate: '2026-10-05' }, // atrasada, mês atual
    { amount: 3000, dueDate: '2026-10-09' }, // vence hoje
    { amount: 4000, dueDate: '2026-10-25' }, // a vencer no mês
    { amount: 5000, dueDate: '2026-11-05' }, // mês seguinte
  ]

  it('separa atrasadas, de hoje e do mês', () => {
    expect(payables(unpaid, '2026-10-09', '2026-10')).toEqual({
      overdueCount: 2,
      overdueTotal: 3000,
      todayCount: 1,
      todayTotal: 3000,
      monthCount: 3,
      monthTotal: 9000,
    })
  })

  it('lista vazia zera tudo', () => {
    expect(payables([], '2026-10-09', '2026-10').overdueCount).toBe(0)
  })
})
