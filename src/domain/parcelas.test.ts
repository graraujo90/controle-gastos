import { describe, expect, it } from 'vitest'
import { planInstallments, splitInstallments } from './parcelas'

describe('splitInstallments', () => {
  it('divisão exata', () => {
    expect(splitInstallments(30000, 3)).toEqual([10000, 10000, 10000])
  })

  it('centavos que sobram vão na primeira parcela e a soma fecha', () => {
    const parts = splitInstallments(10000, 3)
    expect(parts).toEqual([3334, 3333, 3333])
    expect(parts.reduce((a, b) => a + b)).toBe(10000)
  })
})

describe('planInstallments', () => {
  it('valor total: divide e vence mês a mês', () => {
    expect(planInstallments(10000, 'total', 3, '2026-11-05')).toEqual([
      { number: 1, amount: 3334, dueDate: '2026-11-05' },
      { number: 2, amount: 3333, dueDate: '2026-12-05' },
      { number: 3, amount: 3333, dueDate: '2027-01-05' },
    ])
  })

  it('valor da parcela: repete o valor', () => {
    const plan = planInstallments(2500, 'parcela', 4, '2026-10-10')
    expect(plan.map((p) => p.amount)).toEqual([2500, 2500, 2500, 2500])
  })

  it('dia 31 se ajusta ao último dia dos meses curtos sem perder o dia original', () => {
    const plan = planInstallments(300, 'total', 3, '2027-01-31')
    expect(plan.map((p) => p.dueDate)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
  })
})
