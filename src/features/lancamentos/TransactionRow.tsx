import { CircleAlert, CircleCheck, Circle, Repeat } from 'lucide-react'
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
  const installment = tx.installmentTotal && !grouped ? `${tx.installmentNumber}/${tx.installmentTotal}` : undefined

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
  // Duas linhas curtas em vez de uma longa cortada: o quê (categoria) e como (forma, data, situação).
  const join = (parts: (string | undefined)[]) => parts.filter((part) => part && part !== name).join(' · ')
  const what = join([tx.resgate ? 'Resgate' : undefined, category?.name, sub?.name])
  const how = join([grouped ? `em ${purchase.count}×` : undefined, method?.name, otherDate])

  return (
    <div className="flex items-center hover:bg-slate-50">
      <button className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-1 text-left" onClick={() => openForm(tx)}>
        <CategoryIcon category={sub ?? category} parent={sub ? category : undefined} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5 font-medium leading-snug">
            <span className="line-clamp-2 break-words">{name}</span>
            {installment && (
              // Fora do nome, para não sumir quando ele é cortado.
              <span
                className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-600"
                aria-label={`Parcela ${installment.replace('/', ' de ')}`}
              >
                {installment}
              </span>
            )}
            {tx.recurrenceId && <Repeat size={12} className="mt-1 shrink-0 text-slate-400" aria-label="Recorrente" />}
          </span>
          {/* O nome usa a largura toda; o valor fica na linha de baixo, à direita, sempre inteiro. */}
          <span className="mt-0.5 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{what}</span>
            <span className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${style.text}`}>
              {tx.resgate ? '+' : style.sign}
              {formatBRL(grouped ? purchase.total : tx.amount)}
            </span>
          </span>
          {(how || status) && (
            <span className="block truncate text-xs text-slate-500">
              {how}
              {status && (
                <span className={overdue ? 'font-semibold text-rose-600' : 'text-amber-600'}>
                  {how && ' · '}
                  {status}
                </span>
              )}
            </span>
          )}
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
