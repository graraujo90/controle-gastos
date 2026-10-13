import type { Transaction } from '../db/types'
import { monthOf } from '../lib/format'

export interface Payables {
  overdueCount: number
  overdueTotal: number
  todayCount: number
  todayTotal: number
  /** Tudo que ainda falta pagar com vencimento no mês informado (inclui atrasadas e de hoje desse mês). */
  monthCount: number
  monthTotal: number
}

/** Resumo das despesas ainda não pagas. `unpaid` deve conter só despesas com paid = false. */
export function payables(
  unpaid: Pick<Transaction, 'amount' | 'dueDate'>[],
  today: string,
  month: string,
): Payables {
  const p: Payables = { overdueCount: 0, overdueTotal: 0, todayCount: 0, todayTotal: 0, monthCount: 0, monthTotal: 0 }
  for (const t of unpaid) {
    if (t.dueDate < today) {
      p.overdueCount++
      p.overdueTotal += t.amount
    } else if (t.dueDate === today) {
      p.todayCount++
      p.todayTotal += t.amount
    }
    if (monthOf(t.dueDate) === month) {
      p.monthCount++
      p.monthTotal += t.amount
    }
  }
  return p
}
