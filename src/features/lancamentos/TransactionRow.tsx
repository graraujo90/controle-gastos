import { CircleAlert, CircleCheck, Circle } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { CategoryIcon } from '../../components/CategoryIcon'
import { TYPE_STYLE } from '../../components/typeStyle'
import { setPaid } from '../../db/repo'
import type { Category, PaymentMethod, Transaction } from '../../db/types'
import { confirmWords } from '../../lib/confirmacao'
import { formatBRL, shortDate, todayISO } from '../../lib/format'
import type { ViewBy } from './useMonthData'

interface Props {
  tx: Transaction
  categories: Map<string, Category>
  methods: Map<string, PaymentMethod>
  /** Como a lista está organizada; a linha mostra a outra data quando compra e vencimento diferem. */
  view?: ViewBy
  /** Na visão por data da compra, uma compra parcelada aparece uma vez só, com o total. */
  purchase?: { total: number; count: number; paidCount: number }
}

export function TransactionRow({ tx, categories, methods, view, purchase }: Props) {
  const { openForm } = useApp()
  const category = categories.get(tx.categoryId)
  const sub = tx.subcategoryId ? categories.get(tx.subcategoryId) : undefined
  const method = methods.get(tx.paymentMethodId)
  const style = TYPE_STYLE[tx.type]
  const grouped = !!purchase && purchase.count > 1
  const name = tx.description || sub?.name || category?.name || '—'
  const title = tx.installmentTotal && !grouped ? `${name} (${tx.installmentNumber}/${tx.installmentTotal})` : name

  const words = confirmWords(tx)
  const overdue = !tx.paid && tx.dueDate < todayISO()
  const status = tx.paid || grouped ? undefined : `${overdue ? words.overdue : words.upcoming} ${shortDate(tx.dueDate)}`
  // No cartão de crédito a confirmação vale para a fatura inteira.
  const credit = method?.kind === 'credito'
  const action = credit ? (tx.paid ? 'Marcar fatura como não paga' : 'Marcar fatura como paga') : tx.paid ? words.undo : words.confirm

  // A outra data só interessa quando difere (cartão, boleto com vencimento, parcelas).
  const otherDate =
    tx.date === tx.dueDate || !view
      ? undefined
      : view === 'vencimento'
        ? `compra ${shortDate(tx.date)}`
        : grouped
          ? `1ª ${credit ? 'fatura' : 'parcela'} ${shortDate(tx.dueDate)}`
          : tx.paid
            ? `${credit ? 'fatura' : 'vencimento'} ${shortDate(tx.dueDate)}`
            : undefined // pendente: o status ao lado já mostra a data
  const detail = [
    tx.resgate ? 'Resgate' : undefined,
    grouped ? `em ${purchase.count}×` : undefined,
    category?.name,
    sub?.name,
    method?.name,
    otherDate,
  ]
    .filter((part) => part && part !== name)
    .join(' · ')

  return (
    <div className="flex items-center hover:bg-slate-50">
      <button className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left" onClick={() => openForm(tx)}>
        <CategoryIcon category={sub ?? category} parent={sub ? category : undefined} />
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
          {formatBRL(grouped ? purchase.total : tx.amount)}
        </span>
      </button>
      {grouped ? (
        // Cada parcela é confirmada na sua fatura ou vencimento; aqui só o andamento.
        <span
          className="w-[46px] shrink-0 text-center text-xs tabular-nums text-slate-500"
          title={`${purchase.paidCount} de ${purchase.count} parcelas pagas`}
        >
          {purchase.paidCount}/{purchase.count}
        </span>
      ) : (
        <button className="shrink-0 p-3" onClick={() => setPaid(tx, !tx.paid)} title={action} aria-label={action}>
          {tx.paid ? (
            <CircleCheck size={22} className="text-emerald-600" />
          ) : overdue ? (
            <CircleAlert size={22} className="text-rose-600" />
          ) : (
            <Circle size={22} className="text-slate-300" />
          )}
        </button>
      )}
    </div>
  )
}
