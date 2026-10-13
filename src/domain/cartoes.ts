import type { Transaction } from '../db/types'

export interface Invoice {
  /** Mês em que a fatura vence, 'AAAA-MM'. */
  month: string
  total: number
  count: number
  /** Paga quando todos os lançamentos dela estão pagos. */
  paid: boolean
}

/** Agrupa os lançamentos de um cartão em faturas, da mais antiga para a mais nova. */
export function invoicesByMonth(transactions: Pick<Transaction, 'month' | 'amount' | 'paid'>[]): Invoice[] {
  const map = new Map<string, Invoice>()
  for (const t of transactions) {
    const invoice = map.get(t.month) ?? { month: t.month, total: 0, count: 0, paid: true }
    invoice.total += t.amount
    invoice.count++
    invoice.paid = invoice.paid && t.paid
    map.set(t.month, invoice)
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}
