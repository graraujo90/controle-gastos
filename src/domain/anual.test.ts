import { describe, expect, it } from 'vitest'
import { annualSummary } from './anual'

describe('annualSummary', () => {
  const txs = [
    { month: '2025-12', type: 'receita', amount: 100000 },
    { month: '2025-12', type: 'despesa', amount: 30000 },
    { month: '2025-12', type: 'investimento', amount: 20000 },
    { month: '2026-01', type: 'receita', amount: 500000 },
    { month: '2026-01', type: 'despesa', amount: 300000 },
    { month: '2026-01', type: 'investimento', amount: 100000 },
    { month: '2026-02', type: 'receita', amount: 500000 },
    { month: '2026-02', type: 'despesa', amount: 650000 },
    { month: '2027-01', type: 'receita', amount: 999999 },
  ] as const

  const rows = annualSummary([...txs], 2026, 10000)

  it('traz os 12 meses do ano', () => {
    expect(rows.map((r) => r.month)).toHaveLength(12)
    expect(rows[0].month).toBe('2026-01')
    expect(rows[11].month).toBe('2026-12')
  })

  it('saldo inicial de janeiro = saldo informado + resultado dos anos anteriores', () => {
    expect(rows[0].saldoInicial).toBe(10000 + 100000 - 30000 - 20000)
  })

  it('resultado do mês desconta despesas e investimentos; pode ser prejuízo', () => {
    expect(rows[0].resultado).toBe(100000)
    expect(rows[1].resultado).toBe(-150000)
  })

  it('saldo inicial de um mês é o saldo final do anterior', () => {
    expect(rows[1].saldoInicial).toBe(rows[0].saldoInicial + rows[0].resultado)
    expect(rows[2].saldoInicial).toBe(rows[1].saldoInicial + rows[1].resultado)
  })

  it('acumulado do ano soma só os meses do ano', () => {
    expect(rows[0].acumuladoAno).toBe(100000)
    expect(rows[1].acumuladoAno).toBe(-50000)
    expect(rows[11].acumuladoAno).toBe(-50000)
  })

  it('aportado no ano zera em janeiro: não carrega anos anteriores', () => {
    expect(rows[0].aportadoAno).toBe(100000)
    expect(rows[11].aportadoAno).toBe(100000)
    expect(annualSummary([...txs], 2027, 0)[11].aportadoAno).toBe(0)
  })

  it('percentual investido compara aportes e receitas acumulados no ano', () => {
    expect(rows[0].percentualInvestido).toBe(20)
    expect(rows[1].percentualInvestido).toBe(10)
    expect(annualSummary([], 2026, 0)[5].percentualInvestido).toBeNull()
  })

  it('ignora lançamentos de anos seguintes', () => {
    expect(rows.reduce((sum, r) => sum + r.receitas, 0)).toBe(1000000)
  })
})
