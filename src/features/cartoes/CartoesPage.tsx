import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronRight, CircleCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { MonthPicker } from '../../components/MonthPicker'
import { db } from '../../db/db'
import { setInvoicePaid } from '../../db/repo'
import type { Category, PaymentMethod, Transaction } from '../../db/types'
import { invoicesByMonth } from '../../domain/cartoes'
import { formatBRL, monthLabel, shortDate, todayISO, withDay } from '../../lib/format'
import { TransactionRow } from '../lancamentos/TransactionRow'

interface CardProps {
  card: PaymentMethod
  /** Todas as despesas do cartão, de qualquer mês. */
  transactions: Transaction[]
  month: string
  categories: Map<string, Category>
  methods: Map<string, PaymentMethod>
}

/** Linha compacta com a fatura do mês; o restante (limite, lançamentos, próximas faturas) abre ao tocar. */
function CardInvoice({ card, transactions, month, categories, methods }: CardProps) {
  const { setMonth } = useApp()
  const [open, setOpen] = useState(false)

  const invoices = invoicesByMonth(transactions)
  const invoice = invoices.find((i) => i.month === month)
  const items = transactions
    .filter((t) => t.month === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const upcoming = invoices.filter((i) => i.month > month).slice(0, 6)

  const dueDate = withDay(month, card.dueDay ?? 1)
  const overdue = !!invoice && !invoice.paid && dueDate < todayISO()
  // Limite comprometido: tudo que ainda não foi pago, incluindo parcelas de faturas futuras.
  const used = transactions.filter((t) => !t.paid).reduce((sum, t) => sum + t.amount, 0)

  return (
    <div>
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={18} className="shrink-0 text-slate-400" /> : <ChevronRight size={18} className="shrink-0 text-slate-400" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{card.name}</span>
          <span className="block truncate text-xs">
            {!invoice ? (
              <span className="text-slate-500">Sem compras nesta fatura</span>
            ) : invoice.paid ? (
              <span className="font-semibold text-emerald-600">Paga</span>
            ) : overdue ? (
              <span className="font-semibold text-rose-600">Atrasada desde {shortDate(dueDate)}</span>
            ) : (
              <span className="text-amber-600">Em aberto · vence {shortDate(dueDate)}</span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-lg font-bold tabular-nums">{formatBRL(invoice?.total ?? 0)}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Fecha dia {card.closingDay} · vence dia {card.dueDay}
            </span>
            {invoice && (
              <button
                className={`btn ${invoice.paid ? 'btn-ghost' : 'btn-primary'}`}
                onClick={() => setInvoicePaid(card.id, month, !invoice.paid)}
              >
                <CircleCheck size={16} /> {invoice.paid ? 'Desfazer pagamento' : 'Marcar fatura como paga'}
              </button>
            )}
          </div>

          {!!card.limit && (
            <div>
              <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-xs text-slate-500">
                <span>Limite usado: <span className="font-medium text-slate-700">{formatBRL(used)}</span> de {formatBRL(card.limit)}</span>
                <span>Disponível {formatBRL(Math.max(0, card.limit - used))}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${used > card.limit ? 'bg-rose-500' : 'bg-slate-500'}`}
                  style={{ width: `${Math.min(100, (used / card.limit) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lançamentos desta fatura ({items.length})
              </h3>
              <div className="card divide-y divide-slate-100 overflow-hidden">
                {items.map((t) => (
                  <TransactionRow key={t.id} tx={t} categories={categories} methods={methods} />
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Próximas faturas</h3>
              <ul className="space-y-1 text-sm">
                {upcoming.map((i) => (
                  <li key={i.month}>
                    <button className="flex w-full justify-between hover:underline" onClick={() => setMonth(i.month)}>
                      <span className="text-slate-600">{monthLabel(i.month)}</span>
                      <span className="tabular-nums">{formatBRL(i.total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CartoesPage() {
  const { month } = useApp()
  const methodList = useLiveQuery(() => db.paymentMethods.toArray(), [])
  const categoryList = useLiveQuery(() => db.categories.toArray(), [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? []
  const methods = useMemo(() => new Map((methodList ?? []).map((m) => [m.id, m])), [methodList])
  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList])

  const byCard = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.type !== 'despesa' || methods.get(t.paymentMethodId)?.kind !== 'credito') continue
    byCard.set(t.paymentMethodId, [...(byCard.get(t.paymentMethodId) ?? []), t])
  }
  // Cartão arquivado continua aparecendo enquanto tiver algo a pagar.
  const cards = [...methods.values()]
    .filter((m) => m.kind === 'credito' && (!m.archived || (byCard.get(m.id) ?? []).some((t) => !t.paid)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const total = cards.reduce(
    (sum, c) => sum + (byCard.get(c.id) ?? []).filter((t) => t.month === month).reduce((s, t) => s + t.amount, 0),
    0,
  )

  return (
    <div className="space-y-4">
      <MonthPicker />

      {methodList && cards.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          <p>Nenhum cartão de crédito cadastrado.</p>
          <Link to="/mais/formas" className="btn btn-primary mt-4">Cadastrar cartão</Link>
        </div>
      ) : (
        <>
          <div className="card flex items-baseline justify-between p-4">
            <span className="text-sm text-slate-500">Faturas de {monthLabel(month).toLowerCase()}</span>
            <span className="text-xl font-bold tabular-nums">{formatBRL(total)}</span>
          </div>
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {cards.map((card) => (
              <CardInvoice
                key={card.id}
                card={card}
                transactions={byCard.get(card.id) ?? []}
                month={month}
                categories={categories}
                methods={methods}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
