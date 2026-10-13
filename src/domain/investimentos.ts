import type { BalanceSnapshot, Transaction } from '../db/types'
import { invested } from './resumo'

export interface Position {
  /** Aportes − resgates: o dinheiro que você colocou e ainda não tirou. */
  aportado: number
  /** Último saldo informado e sua data; undefined se nunca foi informado. */
  lastBalance?: number
  lastDate?: string
  /** Último saldo informado + movimentações feitas depois dele (ou só o aportado, se não há saldo informado). */
  saldo: number
  /** Saldo informado − aportado até a data dele. null enquanto não há saldo informado. */
  rendimento: number | null
}

/**
 * Posição de um investimento. O saldo é o que o usuário informa (extrato do banco);
 * a diferença para o aportado líquido até aquela data é o rendimento.
 * Como o resgate abate do aportado, tirar dinheiro não aparece como rendimento ruim.
 */
export function position(
  movements: Pick<Transaction, 'date' | 'amount' | 'resgate'>[],
  snapshots: Pick<BalanceSnapshot, 'date' | 'amount'>[],
): Position {
  const aportado = movements.reduce((sum, t) => sum + invested(t), 0)
  const last = [...snapshots].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  if (!last) return { aportado, saldo: aportado, rendimento: null }

  const before = movements.filter((t) => t.date <= last.date).reduce((sum, t) => sum + invested(t), 0)
  return {
    aportado,
    lastBalance: last.amount,
    lastDate: last.date,
    saldo: last.amount + (aportado - before),
    rendimento: last.amount - before,
  }
}
