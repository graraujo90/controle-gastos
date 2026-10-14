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

/**
 * Quantas faturas uma compra pode ser movida (para trás ou para frente). O banco às vezes fecha a
 * fatura alguns dias antes ou depois do dia cadastrado; basta uma fatura para acertar.
 */
export const MAX_INVOICE_SHIFT = 1

export const clampShift = (shift: number) => Math.max(-MAX_INVOICE_SHIFT, Math.min(MAX_INVOICE_SHIFT, Math.trunc(shift) || 0))

/**
 * Vencimento padrão do lançamento: a própria data, ou o vencimento da fatura quando é crédito.
 * `shift` move a compra para a fatura anterior (−1) ou seguinte (+1); fica guardado no lançamento,
 * então mudar a data da compra depois mantém o ajuste.
 */
export function dueDateFor(dateISO: string, method?: PaymentMethod, shift = 0): string {
  if (!isCredit(method)) return dateISO
  const month = addMonths(invoiceMonth(dateISO, method!.closingDay!, method!.dueDay!), clampShift(shift))
  return withDay(month, method!.dueDay!)
}
