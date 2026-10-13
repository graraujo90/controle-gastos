import type { Transaction } from '../db/types'

export interface MonthSummary {
  receitas: number
  despesas: number
  /** Aportes − resgates; fica negativo no mês em que se resgata mais do que se aporta. */
  investimentos: number
  /** receitas − despesas − investimentos */
  resultado: number
}

/**
 * Valor de um lançamento de investimento com sinal: aporte soma, resgate subtrai.
 * Assim um resgate devolve dinheiro ao resultado do mês sem inflar as receitas.
 */
export const invested = (t: Pick<Transaction, 'amount' | 'resgate'>) => (t.resgate ? -t.amount : t.amount)

export function summarize(transactions: Pick<Transaction, 'type' | 'amount' | 'resgate'>[]): MonthSummary {
  const s = { receitas: 0, despesas: 0, investimentos: 0, resultado: 0 }
  for (const t of transactions) {
    if (t.type === 'receita') s.receitas += t.amount
    else if (t.type === 'despesa') s.despesas += t.amount
    else s.investimentos += invested(t)
  }
  s.resultado = s.receitas - s.despesas - s.investimentos
  return s
}

/** Total por categoria (nível principal), do maior para o menor. */
export function totalsByCategory(
  transactions: Pick<Transaction, 'categoryId' | 'amount'>[],
): { categoryId: string; total: number }[] {
  const map = new Map<string, number>()
  for (const t of transactions) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
  return [...map].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total)
}
