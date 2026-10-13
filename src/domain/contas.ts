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

/** Para onde vai o dinheiro de um lançamento ainda não confirmado. */
export type PendingKind = 'pagar' | 'receber' | 'investir'

/** Resgate é dinheiro voltando do investimento, então pendente ele entra em "a receber". */
export const pendingKind = (t: Pick<Transaction, 'type' | 'resgate'>): PendingKind =>
  t.type === 'despesa' ? 'pagar' : t.type === 'receita' || t.resgate ? 'receber' : 'investir'

/** Pendências separadas por direção do dinheiro. `pending` deve conter só lançamentos com paid = false. */
export function pendingByKind(
  pending: Pick<Transaction, 'type' | 'resgate' | 'amount' | 'dueDate'>[],
  today: string,
  month: string,
): Record<PendingKind, Payables> {
  const of = (kind: PendingKind) => payables(pending.filter((t) => pendingKind(t) === kind), today, month)
  return { pagar: of('pagar'), receber: of('receber'), investir: of('investir') }
}

/** Resumo de lançamentos ainda não confirmados. `unpaid` deve conter só lançamentos com paid = false. */
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
