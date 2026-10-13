import { describe, expect, it } from 'vitest'
import { budgetLevel, effectiveBudgets } from './orcamento'

describe('effectiveBudgets', () => {
  const budgets = [
    { month: '2026-08', categoryId: 'moradia', limit: 200000 },
    { month: '2026-10', categoryId: 'moradia', limit: 250000 },
    { month: '2026-09', categoryId: 'lazer', limit: 50000 },
    { month: '2026-11', categoryId: 'lazer', limit: 0 },
  ]

  it('limite segue valendo nos meses seguintes até ser alterado', () => {
    expect(effectiveBudgets(budgets, '2026-09')).toEqual(new Map([['moradia', 200000], ['lazer', 50000]]))
    expect(effectiveBudgets(budgets, '2026-10').get('moradia')).toBe(250000)
    expect(effectiveBudgets(budgets, '2027-03').get('moradia')).toBe(250000)
  })

  it('não vale para meses anteriores ao primeiro limite', () => {
    expect(effectiveBudgets(budgets, '2026-07').size).toBe(0)
    expect(effectiveBudgets(budgets, '2026-08').has('lazer')).toBe(false)
  })

  it('limite zero remove o orçamento daquele mês em diante', () => {
    expect(effectiveBudgets(budgets, '2026-10').get('lazer')).toBe(50000)
    expect(effectiveBudgets(budgets, '2026-11').has('lazer')).toBe(false)
  })
})

describe('budgetLevel', () => {
  it('classifica pelo percentual usado', () => {
    expect(budgetLevel(0, 1000)).toBe('ok')
    expect(budgetLevel(799, 1000)).toBe('ok')
    expect(budgetLevel(800, 1000)).toBe('alerta')
    expect(budgetLevel(1000, 1000)).toBe('alerta')
    expect(budgetLevel(1001, 1000)).toBe('estourado')
  })
})
