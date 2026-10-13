import { describe, expect, it } from 'vitest'
import { groupPurchases, planInstallments, splitInstallments } from './parcelas'

describe('groupPurchases', () => {
  const part = (id: string, n: number, paid: boolean) => ({
    id, amount: 60000, paid, installmentGroupId: 'geladeira', installmentNumber: n, installmentTotal: 3,
  })
  const cash = (id: string, amount: number) => ({ id, amount, paid: true })

  it('compra parcelada vira um item com o total, na posição da primeira parcela encontrada', () => {
    const r = groupPurchases([cash('a', 1000), part('p2', 2, false), cash('b', 2000), part('p1', 1, true), part('p3', 3, false)])
    expect(r.map((p) => p.tx.id)).toEqual(['a', 'p1', 'b'])
    expect(r[1]).toMatchObject({ total: 180000, count: 3, paidCount: 1 })
  })

  it('compra à vista fica como está', () => {
    expect(groupPurchases([cash('a', 1000)])).toEqual([{ tx: cash('a', 1000), total: 1000, count: 1, paidCount: 1 }])
  })

  it('compras parceladas diferentes não se misturam', () => {
    const other = { ...part('x1', 1, true), installmentGroupId: 'sofa', amount: 10000 }
    const r = groupPurchases([part('p1', 1, true), other, part('p2', 2, true)])
    expect(r.map((p) => p.total)).toEqual([120000, 10000])
  })
})

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
