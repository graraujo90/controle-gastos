import type { Budget } from '../db/types'

/**
 * Limite vigente de cada categoria no mês: vale o último definido até aquele mês,
 * então um limite informado uma vez segue valendo nos meses seguintes.
 * Limite 0 significa "sem limite" a partir daquele mês.
 */
export function effectiveBudgets(
  budgets: Pick<Budget, 'month' | 'categoryId' | 'limit'>[],
  month: string,
): Map<string, number> {
  const latest = new Map<string, { month: string; limit: number }>()
  for (const b of budgets) {
    if (b.month > month) continue
    const current = latest.get(b.categoryId)
    if (!current || b.month > current.month) latest.set(b.categoryId, b)
  }
  const out = new Map<string, number>()
  for (const [categoryId, b] of latest) if (b.limit > 0) out.set(categoryId, b.limit)
  return out
}

export interface BudgetTotals {
  /** Soma dos limites definidos. */
  limit: number
  /** Todas as despesas do mês, com ou sem limite. */
  spent: number
  /** Parte de `spent` que veio de categorias sem limite. */
  unbudgeted: number
}

/**
 * Total do orçamento do mês. Categoria sem limite conta como limite zero: o que for gasto nela
 * consome o orçamento em vez de ficar de fora da conta.
 */
export function budgetTotals(rows: { spent: number; limit?: number }[]): BudgetTotals {
  const totals = { limit: 0, spent: 0, unbudgeted: 0 }
  for (const row of rows) {
    totals.spent += row.spent
    if (row.limit) totals.limit += row.limit
    else totals.unbudgeted += row.spent
  }
  return totals
}

export type BudgetLevel = 'ok' | 'alerta' | 'estourado'

/** 'alerta' a partir de 80% do limite; 'estourado' quando passa dele. */
export function budgetLevel(spent: number, limit: number): BudgetLevel {
  if (spent > limit) return 'estourado'
  return spent >= limit * 0.8 ? 'alerta' : 'ok'
}
