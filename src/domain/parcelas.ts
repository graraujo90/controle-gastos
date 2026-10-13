import { addMonthsToDate } from '../lib/format'

/** 'total': o valor informado é o da compra inteira; 'parcela': é o de cada parcela. */
export type InstallmentMode = 'total' | 'parcela'

export interface Installment {
  number: number
  amount: number
  dueDate: string
}

/** Divide o total em N parcelas (centavos); o que sobra da divisão vai na 1ª. */
export function splitInstallments(total: number, count: number): number[] {
  const base = Math.floor(total / count)
  const parts = Array<number>(count).fill(base)
  parts[0] += total - base * count
  return parts
}

/** Parcelas mensais a partir do primeiro vencimento. */
export function planInstallments(
  amount: number,
  mode: InstallmentMode,
  count: number,
  firstDueDate: string,
): Installment[] {
  const amounts = mode === 'total' ? splitInstallments(amount, count) : Array<number>(count).fill(amount)
  return amounts.map((value, i) => ({
    number: i + 1,
    amount: value,
    dueDate: addMonthsToDate(firstDueDate, i),
  }))
}
