import { CircleAlert, CircleCheck, Circle } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { TYPE_STYLE } from '../../components/typeStyle'
import { setPaid } from '../../db/repo'
import type { Category, PaymentMethod, Transaction } from '../../db/types'
import { confirmWords } from '../../lib/confirmacao'
import { formatBRL, shortDate, todayISO } from '../../lib/format'

interface Props {
  tx: Transaction
  categories: Map<string, Category>
  methods: Map<string, PaymentMethod>
}

export function TransactionRow({ tx, categories, methods }: Props) {
  const { openForm } = useApp()
  const category = categories.get(tx.categoryId)
  const sub = tx.subcategoryId ? categories.get(tx.subcategoryId) : undefined
  const method = methods.get(tx.paymentMethodId)
  const style = TYPE_STYLE[tx.type]
  const name = tx.description || sub?.name || category?.name || '—'
  const title = tx.installmentTotal ? `${name} (${tx.installmentNumber}/${tx.installmentTotal})` : name

  const words = confirmWords(tx)
  const overdue = !tx.paid && tx.dueDate < todayISO()
  const status = tx.paid ? undefined : `${overdue ? words.overdue : words.upcoming} ${shortDate(tx.dueDate)}`
  const detail = [tx.resgate ? 'Resgate' : undefined, category?.name, sub?.name, method?.name]
    .filter((part) => part && part !== name)
    .join(' · ')
  // No cartão de crédito a confirmação vale para a fatura inteira.
  const credit = method?.kind === 'credito'
  const action = credit ? (tx.paid ? 'Marcar fatura como não paga' : 'Marcar fatura como paga') : tx.paid ? words.undo : words.confirm

  return (
    <div className="flex items-center hover:bg-slate-50">
      <button className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left" onClick={() => openForm(tx)}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: category?.color ?? '#94a3b8' }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs text-slate-500">
            {detail}
            {status && (
              <span className={overdue ? 'font-semibold text-rose-600' : 'text-amber-600'}>
                {detail && ' · '}
                {status}
              </span>
            )}
          </span>
        </span>
        <span className={`shrink-0 font-semibold tabular-nums ${style.text}`}>
          {tx.resgate ? '+' : style.sign}
          {formatBRL(tx.amount)}
        </span>
      </button>
      <button className="shrink-0 p-3" onClick={() => setPaid(tx, !tx.paid)} title={action} aria-label={action}>
        {tx.paid ? (
          <CircleCheck size={22} className="text-emerald-600" />
        ) : overdue ? (
          <CircleAlert size={22} className="text-rose-600" />
        ) : (
          <Circle size={22} className="text-slate-300" />
        )}
      </button>
    </div>
  )
}
