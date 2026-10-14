// Uma compra dividida em categorias: vira várias despesas ligadas por `splitGroupId`, com a mesma data,
// forma e situação de pagamento. Cada parte conta na sua categoria; juntas, somam a compra.

export interface SplitPart {
  /** Id do lançamento, quando a parte já existe (editar a divisão mantém os registros). */
  id?: string
  categoryId: string
  subcategoryId: string | null
  amount: number
}

/** Quanto falta distribuir (negativo quando as partes passam do total). */
export const remaining = (total: number, parts: Pick<SplitPart, 'amount'>[]) =>
  total - parts.reduce((sum, p) => sum + p.amount, 0)

/** O que impede salvar a divisão, ou null quando ela está pronta. */
export function splitError(total: number, parts: SplitPart[]): string | null {
  if (parts.length < 2) return 'Divida em pelo menos duas categorias.'
  if (parts.some((p) => !p.categoryId)) return 'Escolha a categoria de cada parte.'
  if (parts.some((p) => p.amount <= 0)) return 'Informe o valor de cada parte.'
  const left = remaining(total, parts)
  if (left > 0) return 'Ainda falta distribuir parte do valor.'
  if (left < 0) return 'As partes somam mais que o valor da compra.'
  return null
}
