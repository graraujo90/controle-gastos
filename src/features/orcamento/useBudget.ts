import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Category } from '../../db/types'
import { budgetLevel, budgetTotals, effectiveBudgets, type BudgetLevel } from '../../domain/orcamento'
import { totalsByCategory } from '../../domain/resumo'
import { useMonthData } from '../lancamentos/useMonthData'

export interface BudgetRow {
  category: Category
  spent: number
  /** undefined = categoria sem limite definido. */
  limit?: number
  level?: BudgetLevel
}

export const LEVEL_BAR: Record<BudgetLevel, string> = {
  ok: 'bg-emerald-500',
  alerta: 'bg-amber-500',
  estourado: 'bg-rose-500',
}

/** Gasto x limite de cada categoria de despesa no mês. */
export function useBudget(month: string) {
  const { transactions, categories } = useMonthData(month)
  const budgets = useLiveQuery(() => db.budgets.where('month').belowOrEqual(month).toArray(), [month]) ?? []

  const limits = effectiveBudgets(budgets, month)
  const expenses = transactions.filter((t) => t.type === 'despesa')
  const spentBy = new Map(totalsByCategory(expenses).map((r) => [r.categoryId, r.total]))

  const rows: BudgetRow[] = [...categories.values()]
    // Arquivadas só aparecem se ainda tiverem gasto no mês.
    .filter((c) => c.type === 'despesa' && !c.parentId && (!c.archived || spentBy.has(c.id)))
    .map((category) => {
      const spent = spentBy.get(category.id) ?? 0
      const limit = limits.get(category.id)
      return { category, spent, limit, level: limit ? budgetLevel(spent, limit) : undefined }
    })
    // Com limite primeiro (as mais apertadas no topo), depois as sem limite por gasto.
    .sort(
      (a, b) =>
        Number(!!b.limit) - Number(!!a.limit) ||
        (a.limit && b.limit ? b.spent / b.limit - a.spent / a.limit : b.spent - a.spent) ||
        a.category.name.localeCompare(b.category.name, 'pt-BR'),
    )

  // O total considera todas as despesas do mês; categoria sem limite conta como limite zero.
  const totals = budgetTotals(rows)

  return {
    rows,
    expenses,
    categories,
    totalLimit: totals.limit,
    totalSpent: totals.spent,
    unbudgetedSpent: totals.unbudgeted,
  }
}
