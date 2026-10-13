import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db/db'

/** 'vencimento': mês em que o dinheiro sai (regra dos totais). 'compra': mês em que a compra foi feita. */
export type ViewBy = 'vencimento' | 'compra'

/** Lançamentos do mês, mais os cadastros indexados por id. Os totais do app usam sempre 'vencimento'. */
export function useMonthData(month: string, by: ViewBy = 'vencimento') {
  const transactions = useLiveQuery(
    () =>
      by === 'vencimento'
        ? db.transactions.where('month').equals(month).toArray()
        : db.transactions.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray(),
    [month, by],
  )
  const categoryList = useLiveQuery(() => db.categories.toArray(), [])
  const methodList = useLiveQuery(() => db.paymentMethods.toArray(), [])

  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList])
  const methods = useMemo(() => new Map((methodList ?? []).map((m) => [m.id, m])), [methodList])

  return { transactions: transactions ?? [], categories, methods, loading: !transactions }
}
