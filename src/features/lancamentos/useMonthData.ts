import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db/db'
import { todayISO } from '../../lib/format'

/** 'vencimento': mês em que o dinheiro sai (regra dos totais). 'compra': mês em que a compra foi feita. */
export type ViewBy = 'vencimento' | 'compra'

/**
 * O que carregar: o mês, o ano inteiro desse mês, ou tudo que está vencido e não confirmado
 * (de qualquer período — é a lista de "em atraso").
 */
export type Scope = 'mes' | 'ano' | 'atrasados'

/** Lançamentos do período, mais os cadastros indexados por id. Os totais do app usam sempre 'vencimento'. */
export function useMonthData(month: string, by: ViewBy = 'vencimento', scope: Scope = 'mes') {
  const transactions = useLiveQuery(() => {
    if (scope === 'atrasados') {
      return db.transactions.where('dueDate').below(todayISO()).filter((t) => !t.paid).toArray()
    }
    const year = month.slice(0, 4)
    if (by === 'vencimento') {
      return scope === 'mes'
        ? db.transactions.where('month').equals(month).toArray()
        : db.transactions.where('month').between(`${year}-01`, `${year}-12`, true, true).toArray()
    }
    const [from, to] = scope === 'mes' ? [`${month}-01`, `${month}-31`] : [`${year}-01-01`, `${year}-12-31`]
    return db.transactions.where('date').between(from, to, true, true).toArray()
  }, [month, by, scope])
  const categoryList = useLiveQuery(() => db.categories.toArray(), [])
  const methodList = useLiveQuery(() => db.paymentMethods.toArray(), [])

  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList])
  const methods = useMemo(() => new Map((methodList ?? []).map((m) => [m.id, m])), [methodList])

  return { transactions: transactions ?? [], categories, methods, loading: !transactions }
}
