import { describe, expect, it } from 'vitest'
import { payables } from './contas'

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
