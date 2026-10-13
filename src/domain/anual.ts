import type { Transaction } from '../db/types'
import { invested } from './resumo'

export interface AnnualRow {
  month: string
  /** Saldo no começo do mês: saldo inicial informado + resultado de todos os meses anteriores. */
  saldoInicial: number
  receitas: number
  despesas: number
  investimentos: number
  /** Lucro (+) ou prejuízo (−) do mês: receitas − despesas − investimentos. */
  resultado: number
  /** Soma dos resultados de janeiro até o mês. */
  acumuladoAno: number
  /** Soma dos aportes de janeiro até o mês. Zera a cada ano e não considera rentabilidade. */
  aportadoAno: number
  /** Quanto da receita de janeiro até o mês foi investido, em % (null enquanto não há receita). */
  percentualInvestido: number | null
}

type Tx = Pick<Transaction, 'month' | 'type' | 'amount' | 'resgate'>

/** Resumo mês a mês do ano. `openingBalance` é o saldo antes do primeiro lançamento do app. */
export function annualSummary(transactions: Tx[], year: number, openingBalance: number): AnnualRow[] {
  const first = `${year}-01`
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const rows = new Map<string, AnnualRow>(
    months.map((month) => [
      month,
      { month, saldoInicial: 0, receitas: 0, despesas: 0, investimentos: 0, resultado: 0, acumuladoAno: 0, aportadoAno: 0, percentualInvestido: null },
    ]),
  )

  let saldo = openingBalance
  let aportado = 0
  for (const t of transactions) {
    const row = rows.get(t.month)
    if (row) {
      if (t.type === 'receita') row.receitas += t.amount
      else if (t.type === 'despesa') row.despesas += t.amount
      else row.investimentos += invested(t)
    } else if (t.month < first) {
      // Anos anteriores entram só no saldo de partida.
      saldo += t.type === 'receita' ? t.amount : t.type === 'despesa' ? -t.amount : -invested(t)
    }
  }

  let acumulado = 0
  let receitas = 0
  for (const row of rows.values()) {
    row.saldoInicial = saldo
    row.resultado = row.receitas - row.despesas - row.investimentos
    acumulado += row.resultado
    saldo += row.resultado
    aportado += row.investimentos
    receitas += row.receitas
    row.acumuladoAno = acumulado
    row.aportadoAno = aportado
    row.percentualInvestido = receitas > 0 ? (aportado / receitas) * 100 : null
  }
  return [...rows.values()]
}
