import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../app/AppContext'
import { CategoryIcon } from '../../components/CategoryIcon'
import { MonthPicker } from '../../components/MonthPicker'
import { TYPE_STYLE } from '../../components/typeStyle'
import type { Category, PaymentMethod, Transaction } from '../../db/types'
import { summarize } from '../../domain/resumo'
import { addMonths, formatBRL, monthLabel } from '../../lib/format'

interface Props {
  transactions: Transaction[]
  categories: Map<string, Category>
  methods: Map<string, PaymentMethod>
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/** Soma os valores por chave e devolve do maior para o menor. */
function totalsBy(list: Transaction[], key: (t: Transaction) => string): [string, number][] {
  const map = new Map<string, number>()
  for (const t of list) map.set(key(t), (map.get(key(t)) ?? 0) + t.amount)
  return [...map].sort((a, b) => b[1] - a[1])
}

/** Variação em relação ao mês anterior, em texto neutro (subir é bom para receita e ruim para despesa). */
function Delta({ current, previous, month }: { current: number; previous: number; month: string }) {
  if (previous <= 0) return <span className="text-xs text-slate-400">sem mês anterior</span>
  const change = Math.round(((current - previous) / previous) * 100)
  const name = monthLabel(addMonths(month, -1)).split(' ')[0].toLowerCase()
  return (
    <span className="text-xs text-slate-500">
      {change > 0 ? '▲' : change < 0 ? '▼' : '='} {Math.abs(change)}% vs. {name}
    </span>
  )
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
    </div>
  )
}

export function MonthReport({ transactions, categories, methods }: Props) {
  const { month } = useApp()
  const [open, setOpen] = useState<string | null>(null)

  const current = transactions.filter((t) => t.month === month)
  const summary = summarize(current)
  const previous = summarize(transactions.filter((t) => t.month === addMonths(month, -1)))

  // Em mês com mais resgate que aporte o investido fica negativo; na barra de destino da receita conta como zero.
  const netInvested = Math.max(0, summary.investimentos)

  const expenses = current.filter((t) => t.type === 'despesa')
  const byCategory = totalsBy(expenses, (t) => t.categoryId)
  const byMethod = totalsBy(expenses, (t) => t.paymentMethodId)
  const paid = expenses.filter((t) => t.paid).reduce((sum, t) => sum + t.amount, 0)

  const tiles = [
    { label: 'Receitas', value: summary.receitas, prev: previous.receitas, type: 'receita' },
    { label: 'Despesas', value: summary.despesas, prev: previous.despesas, type: 'despesa' },
    { label: 'Investido', value: summary.investimentos, prev: previous.investimentos, type: 'investimento' },
  ] as const

  return (
    <div className="space-y-4">
      <MonthPicker />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-slate-500">Resultado</div>
          <div className={`truncate text-xl font-bold tabular-nums ${summary.resultado < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {formatBRL(summary.resultado)}
          </div>
          <span className="text-xs text-slate-500">{summary.resultado < 0 ? 'prejuízo no mês' : 'lucro no mês'}</span>
        </div>
        {tiles.map((tile) => (
          <div key={tile.type} className="card p-4">
            <div className="text-xs font-medium text-slate-500">{tile.label}</div>
            <div className={`truncate text-xl font-bold tabular-nums ${TYPE_STYLE[tile.type].text}`}>
              {formatBRL(tile.value)}
            </div>
            <Delta current={tile.value} previous={tile.prev} month={month} />
          </div>
        ))}
      </div>

      {summary.receitas > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Para onde foi a receita</h2>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-rose-400" style={{ width: `${Math.min(100, percent(summary.despesas, summary.receitas))}%` }} />
            <div className="bg-indigo-600" style={{ width: `${Math.min(100, percent(netInvested, summary.receitas))}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />Despesas {percent(summary.despesas, summary.receitas)}%</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-600" />Investimentos {percent(netInvested, summary.receitas)}%</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-200" />Sobra {Math.max(0, 100 - percent(summary.despesas + netInvested, summary.receitas))}%</span>
          </div>
        </section>
      )}

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Despesas por categoria</h2>
          {summary.despesas > 0 && (
            <span className="text-xs text-slate-500">{percent(paid, summary.despesas)}% já pago</span>
          )}
        </div>
        {byCategory.length === 0 && <p className="text-sm text-slate-500">Nenhuma despesa neste mês.</p>}
        <ul className="space-y-3">
          {byCategory.map(([id, total]) => {
            const category = categories.get(id)
            const subs = totalsBy(expenses.filter((t) => t.categoryId === id), (t) => t.subcategoryId ?? '')
            const hasSubs = subs.some(([subId]) => subId)
            const expanded = open === id
            return (
              <li key={id}>
                <button
                  className="block w-full text-left"
                  onClick={() => hasSubs && setOpen(expanded ? null : id)}
                  aria-expanded={hasSubs ? expanded : undefined}
                >
                  <div className="mb-1 flex items-center gap-1 text-sm">
                    {hasSubs ? (
                      expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                    ) : (
                      <span className="w-3.5" />
                    )}
                    <CategoryIcon category={category} size="sm" />
                    <span className="ml-1 min-w-0 flex-1 truncate">{category?.name ?? '—'}</span>
                    <span className="text-xs text-slate-500">{percent(total, summary.despesas)}%</span>
                    <span className="w-24 text-right font-medium tabular-nums">{formatBRL(total)}</span>
                  </div>
                  <Bar value={total} max={byCategory[0][1]} color={category?.color ?? '#94a3b8'} />
                </button>
                {expanded && (
                  <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    {subs.map(([subId, subTotal]) => (
                      <li key={subId} className="flex justify-between">
                        <span className="text-slate-600">{subId ? (categories.get(subId)?.name ?? '—') : 'Sem subcategoria'}</span>
                        <span className="tabular-nums">{formatBRL(subTotal)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {byMethod.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Despesas por forma de pagamento</h2>
          <ul className="space-y-3">
            {byMethod.map(([id, total]) => (
              <li key={id}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{methods.get(id)?.name ?? '—'}</span>
                  <span className="text-xs text-slate-500">{percent(total, summary.despesas)}%</span>
                  <span className="w-24 text-right font-medium tabular-nums">{formatBRL(total)}</span>
                </div>
                <Bar value={total} max={byMethod[0][1]} color="#64748b" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
