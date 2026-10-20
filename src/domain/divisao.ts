// Uma compra dividida: vira várias despesas ligadas por `splitGroupId`, com a mesma data, forma e situação de
// pagamento. Cada parte tem a sua categoria e a sua pessoa; juntas, somam a compra. Numa compra parcelada,
// cada parte é uma série de parcelas; numa recorrência, uma regra por parte.
import type { Transaction } from '../db/types'

export interface SplitPart {
  /** Id do lançamento, quando a parte já existe (editar a divisão mantém os registros). */
  id?: string
  categoryId: string
  subcategoryId: string | null
  /** De quem é a parte; vazio = da família. */
  personId?: string
  amount: number
}

/** Quanto falta distribuir (negativo quando as partes passam do total). */
export const remaining = (total: number, parts: Pick<SplitPart, 'amount'>[]) =>
  total - parts.reduce((sum, p) => sum + p.amount, 0)

/** O que impede salvar a divisão, ou null quando ela está pronta. */
export function splitError(total: number, parts: SplitPart[]): string | null {
  if (parts.length < 2) return 'Divida em pelo menos duas partes.'
  if (parts.some((p) => !p.categoryId)) return 'Escolha a categoria de cada parte.'
  if (parts.some((p) => p.amount <= 0)) return 'Informe o valor de cada parte.'
  const left = remaining(total, parts)
  if (left > 0) return 'Ainda falta distribuir parte do valor.'
  if (left < 0) return 'As partes somam mais que o valor da compra.'
  return null
}

/**
 * Em que "vez" da compra a parte está: a parcela, numa compra parcelada; senão, a data (compra à vista ou
 * ocorrência de uma recorrência). As partes da mesma vez são editadas e confirmadas juntas.
 */
export const splitSlot = (t: Pick<Transaction, 'installmentNumber' | 'date'>) =>
  t.installmentNumber ? `parcela ${t.installmentNumber}` : t.date

/**
 * Valor de cada parte em cada parcela. Com o valor por parcela, as partes já são por parcela e se repetem;
 * com o valor total, cada parcela é repartida por `splitAcrossInstallments`.
 */
export function partsByInstallment(parcels: number[], partAmounts: number[], mode: 'total' | 'parcela'): number[][] {
  return mode === 'parcela'
    ? partAmounts.map((amount) => parcels.map(() => amount))
    : splitAcrossInstallments(parcels, partAmounts)
}

/**
 * Reparte cada parcela entre as partes, na proporção do total de cada parte. Os centavos são distribuídos
 * parcela a parcela, de modo que **cada parcela fecha com a fatura** e **cada parte fecha com o seu total**.
 * Devolve, para cada parte, o valor em cada parcela.
 */
export function splitAcrossInstallments(parcels: number[], partTotals: number[]): number[][] {
  let left = parcels.reduce((sum, p) => sum + p, 0)
  if (left !== partTotals.reduce((sum, p) => sum + p, 0)) throw new Error('As partes não somam o total da compra.')
  const leftByPart = [...partTotals]
  const out = partTotals.map(() => [] as number[])
  for (const parcel of parcels) {
    // Proporção do que ainda falta de cada parte: na última parcela, cada uma recebe exatamente o seu resto.
    const ideal = leftByPart.map((p) => (left > 0 ? (p * parcel) / left : 0))
    const amounts = ideal.map(Math.floor)
    let cents = parcel - amounts.reduce((sum, a) => sum + a, 0)
    const byFraction = ideal.map((v, k) => ({ k, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.k - b.k)
    for (const { k } of byFraction) {
      if (cents === 0) break
      amounts[k]++
      cents--
    }
    amounts.forEach((a, k) => {
      out[k].push(a)
      leftByPart[k] -= a
    })
    left -= parcel
  }
  return out
}
