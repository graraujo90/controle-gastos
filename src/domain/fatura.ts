import type { PaymentMethod } from '../db/types'
import { addMonths, monthOf, withDay } from '../lib/format'

/**
 * Mês em que a fatura que contém a compra é paga.
 * Compra até o dia de fechamento entra na fatura que fecha naquele mês;
 * depois disso, na seguinte. Se o vencimento cai antes (ou no mesmo dia)
 * do fechamento, a fatura só vence no mês seguinte ao fechamento.
 */
export function invoiceMonth(dateISO: string, closingDay: number, dueDay: number): string {
  const day = Number(dateISO.slice(8, 10))
  let month = monthOf(dateISO)
  if (day > closingDay) month = addMonths(month, 1)
  if (dueDay <= closingDay) month = addMonths(month, 1)
  return month
}

export const isCredit = (method?: PaymentMethod) =>
  method?.kind === 'credito' && !!method.closingDay && !!method.dueDay

/** Vencimento padrão do lançamento: a própria data, ou o vencimento da fatura quando é crédito. */
export function dueDateFor(dateISO: string, method?: PaymentMethod): string {
  if (!isCredit(method)) return dateISO
  return withDay(invoiceMonth(dateISO, method!.closingDay!, method!.dueDay!), method!.dueDay!)
}
