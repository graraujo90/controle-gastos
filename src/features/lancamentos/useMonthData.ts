import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db/db'

/** Lançamentos do mês de competência, mais os cadastros indexados por id. */
export function useMonthData(month: string) {
  const transactions = useLiveQuery(() => db.transactions.where('month').equals(month).toArray(), [month])
  const categoryList = useLiveQuery(() => db.categories.toArray(), [])
  const methodList = useLiveQuery(() => db.paymentMethods.toArray(), [])

  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList])
  const methods = useMemo(() => new Map((methodList ?? []).map((m) => [m.id, m])), [methodList])

  return { transactions: transactions ?? [], categories, methods, loading: !transactions }
}
