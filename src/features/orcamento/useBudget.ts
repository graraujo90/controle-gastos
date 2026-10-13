import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Category } from '../../db/types'
import { budgetLevel, effectiveBudgets, type BudgetLevel } from '../../domain/orcamento'
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

  const budgeted = rows.filter((r) => r.limit)
  const totalLimit = budgeted.reduce((sum, r) => sum + r.limit!, 0)
  const totalSpent = budgeted.reduce((sum, r) => sum + r.spent, 0)
  const unbudgetedSpent = rows.filter((r) => !r.limit).reduce((sum, r) => sum + r.spent, 0)

  return { rows, expenses, categories, totalLimit, totalSpent, unbudgetedSpent }
}
