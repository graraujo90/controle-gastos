// Pessoas do orçamento familiar: de quem é cada lançamento e quanto cada adulto contribui.
import type { Person, TxType } from '../db/types'

/** Valor de `pessoa` no filtro para "lançamentos da família" (sem pessoa). */
export const FAMILY = 'familia'

/**
 * De quem é um lançamento novo, quando a pessoa ainda não escolheu: despesa é da família; receita e
 * investimento são de um adulto, o último escolhido neste aparelho (cada celular aprende o seu dono)
 * ou o primeiro adulto. Sem adultos cadastrados, tudo fica da família ('').
 */
export function defaultPersonId(type: TxType, adults: Pick<Person, 'id'>[], lastUsed?: string | null): string {
  if (type === 'despesa' || adults.length === 0) return ''
  return adults.some((p) => p.id === lastUsed) ? lastUsed! : adults[0].id
}
