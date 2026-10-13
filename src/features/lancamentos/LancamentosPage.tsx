import { useState } from 'react'
import { useApp } from '../../app/AppContext'
import { MonthPicker } from '../../components/MonthPicker'
import { TX_LABEL_PLURAL, TX_TYPES, type Transaction, type TxType } from '../../db/types'
import { pendingKind, type PendingKind } from '../../domain/contas'
import { groupPurchases, type Purchase } from '../../domain/parcelas'
import { dayLabel } from '../../lib/format'
import { TransactionRow } from './TransactionRow'
import { useMonthData, type ViewBy } from './useMonthData'

type Filter = 'todos' | TxType | PendingKind

const PENDING_LABEL: Record<PendingKind, string> = {
  pagar: 'A pagar',
  receber: 'A receber',
  investir: 'A investir',
}

const VIEW_KEY = 'lancamentos.verPor'

// A forma de listar é preferência de cada aparelho; se o navegador não deixar guardar, vale só nesta sessão.
function storedView(): ViewBy {
  try {
    return localStorage.getItem(VIEW_KEY) === 'compra' ? 'compra' : 'vencimento'
  } catch {
    return 'vencimento'
  }
}

export function LancamentosPage() {
  const { month, openForm } = useApp()
  const [view, setView] = useState<ViewBy>(storedView)
  const { transactions, categories, methods, loading } = useMonthData(month, view)
  const [filter, setFilter] = useState<Filter>('todos')

  function changeView(next: ViewBy) {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // sem armazenamento: a escolha vale só enquanto a tela estiver aberta
    }
  }

  const dateOf = (t: Transaction) => (view === 'compra' ? t.date : t.dueDate)
  const sorted = [...transactions].sort(
    (a, b) => dateOf(b).localeCompare(dateOf(a)) || b.createdAt.localeCompare(a.createdAt),
  )
  // Por data da compra, as parcelas de uma mesma compra viram uma linha só, com o total.
  const purchases: Purchase<Transaction>[] =
    view === 'compra'
      ? groupPurchases(sorted)
      : sorted.map((tx) => ({ tx, total: tx.amount, count: 1, paidCount: tx.paid ? 1 : 0 }))

  const visible = purchases.filter(({ tx, count, paidCount }) =>
    filter === 'todos' ? true : filter in PENDING_LABEL ? paidCount < count && pendingKind(tx) === filter : tx.type === filter,
  )
  const byDay = new Map<string, Purchase<Transaction>[]>()
  for (const p of visible) byDay.set(dateOf(p.tx), [...(byDay.get(dateOf(p.tx)) ?? []), p])

  return (
    <div className="space-y-4">
      <MonthPicker />

      <div>
        <div className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-slate-500">Ver por</span>
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-lg bg-slate-200/60 p-1">
            {(['vencimento', 'compra'] as const).map((v) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                aria-pressed={view === v}
                className={`rounded-md py-1.5 font-semibold ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                {v === 'vencimento' ? 'Vencimento' : 'Data da compra'}
              </button>
            ))}
          </div>
        </div>
        {view === 'compra' && (
          <p className="mt-1 text-xs text-slate-500">
            Mostra o que foi comprado neste mês. Os totais do Início, do orçamento e dos relatórios seguem o vencimento.
          </p>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {(['todos', ...TX_TYPES, 'pagar', 'receber', 'investir'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {f === 'todos' ? 'Todos' : f in PENDING_LABEL ? PENDING_LABEL[f as PendingKind] : TX_LABEL_PLURAL[f as TxType]}
          </button>
        ))}
      </div>

      {!loading && visible.length === 0 && (
        <div className="card p-8 text-center text-slate-500">
          <p>
            {filter in PENDING_LABEL
              ? `Nada ${PENDING_LABEL[filter as PendingKind].toLowerCase()} neste mês.`
              : 'Nenhum lançamento neste mês.'}
          </p>
          <button className="btn btn-primary mt-4" onClick={() => openForm()}>Fazer um lançamento</button>
        </div>
      )}

      {[...byDay].map(([date, list]) => (
        <section key={date}>
          <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(date)}</h3>
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {list.map((p) => (
              <TransactionRow key={p.tx.id} tx={p.tx} categories={categories} methods={methods} view={view} purchase={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
