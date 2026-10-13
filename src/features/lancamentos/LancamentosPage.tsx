import { useState } from 'react'
import { useApp } from '../../app/AppContext'
import { MonthPicker } from '../../components/MonthPicker'
import { TX_LABEL_PLURAL, TX_TYPES, type Transaction, type TxType } from '../../db/types'
import { dayLabel } from '../../lib/format'
import { TransactionRow } from './TransactionRow'
import { useMonthData } from './useMonthData'

export function LancamentosPage() {
  const { month, openForm } = useApp()
  const { transactions, categories, methods, loading } = useMonthData(month)
  const [filter, setFilter] = useState<TxType | 'todos' | 'apagar'>('todos')

  const visible = transactions.filter((t) =>
    filter === 'todos' ? true : filter === 'apagar' ? t.type === 'despesa' && !t.paid : t.type === filter,
  )
  // Agrupa pelo vencimento, que é o que define o mês do lançamento (parcelas, faturas).
  const byDay = new Map<string, Transaction[]>()
  for (const t of [...visible].sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.createdAt.localeCompare(a.createdAt))) {
    byDay.set(t.dueDate, [...(byDay.get(t.dueDate) ?? []), t])
  }

  return (
    <div className="space-y-4">
      <MonthPicker />

      <div className="flex gap-2 overflow-x-auto">
        {(['todos', ...TX_TYPES, 'apagar'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'apagar' ? 'A pagar' : TX_LABEL_PLURAL[f]}
          </button>
        ))}
      </div>

      {!loading && visible.length === 0 && (
        <div className="card p-8 text-center text-slate-500">
          <p>{filter === 'apagar' ? 'Nada a pagar neste mês.' : 'Nenhum lançamento neste mês.'}</p>
          <button className="btn btn-primary mt-4" onClick={() => openForm()}>Fazer um lançamento</button>
        </div>
      )}

      {[...byDay].map(([date, list]) => (
        <section key={date}>
          <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(date)}</h3>
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {list.map((t) => (
              <TransactionRow key={t.id} tx={t} categories={categories} methods={methods} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
