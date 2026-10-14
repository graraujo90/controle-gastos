import { addMonthsToDate } from '../lib/format'

/** 'total': o valor informado é o da compra inteira; 'parcela': é o de cada parcela. */
export type InstallmentMode = 'total' | 'parcela'

export interface Installment {
  number: number
  amount: number
  dueDate: string
  /** Conta dividida: a minha parte nesta parcela. */
  myShare?: number
}

/** Uma compra como ela foi feita: parcelada ou não, aparece uma vez, com o valor total. */
export interface Purchase<T> {
  /** O lançamento que representa a compra (a 1ª parcela disponível, ou o próprio lançamento). */
  tx: T
  total: number
  /** Quantas parcelas a compra tem na lista; 1 para compra à vista. */
  count: number
  paidCount: number
}

/** Junta as parcelas de cada compra em um item só, mantendo a ordem em que as compras aparecem. */
export function groupPurchases<
  T extends { amount: number; paid: boolean; installmentGroupId?: string; installmentNumber?: number },
>(transactions: T[]): Purchase<T>[] {
  const groups = new Map<string, Purchase<T>>()
  const out: Purchase<T>[] = []
  for (const tx of transactions) {
    const existing = tx.installmentGroupId ? groups.get(tx.installmentGroupId) : undefined
    if (!existing) {
      const purchase = { tx, total: tx.amount, count: 1, paidCount: tx.paid ? 1 : 0 }
      if (tx.installmentGroupId) groups.set(tx.installmentGroupId, purchase)
      out.push(purchase)
      continue
    }
    existing.total += tx.amount
    existing.count++
    if (tx.paid) existing.paidCount++
    if ((tx.installmentNumber ?? 0) < (existing.tx.installmentNumber ?? 0)) existing.tx = tx
  }
  return out
}

/** Divide o total em N parcelas (centavos); o que sobra da divisão vai na 1ª. */
export function splitInstallments(total: number, count: number): number[] {
  const base = Math.floor(total / count)
  const parts = Array<number>(count).fill(base)
  parts[0] += total - base * count
  return parts
}

/**
 * Parcelas mensais a partir do primeiro vencimento. A minha parte (conta dividida) é informada do
 * mesmo jeito que o valor, total ou por parcela, e é dividida pela mesma regra.
 */
export function planInstallments(
  amount: number,
  mode: InstallmentMode,
  count: number,
  firstDueDate: string,
  myShare?: number,
): Installment[] {
  const split = (value: number) => (mode === 'total' ? splitInstallments(value, count) : Array<number>(count).fill(value))
  const amounts = split(amount)
  const shares = myShare === undefined ? undefined : split(myShare)
  return amounts.map((value, i) => ({
    number: i + 1,
    amount: value,
    dueDate: addMonthsToDate(firstDueDate, i),
    ...(shares && { myShare: shares[i] }),
  }))
}
