import { ChevronDown, ChevronRight, CreditCard } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { CategoryBreakdown, percent as percentOf } from '../../components/CategoryBreakdown'
import { MonthPicker } from '../../components/MonthPicker'
import { TYPE_STYLE } from '../../components/typeStyle'
import type { Category, PaymentMethod, Transaction } from '../../db/types'
import { ALL_CREDIT, lancamentosLink } from '../../domain/filtro'
import { expenseBreakdown, methodBreakdown, summarize } from '../../domain/resumo'
import { addMonths, formatBRL, monthLabel } from '../../lib/format'

interface Props {
  transactions: Transaction[]
  categories: Map<string, Category>
  methods: Map<string, PaymentMethod>
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

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

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-slate-500" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

export function MonthReport({ transactions, categories, methods }: Props) {
  const { month } = useApp()
  const [cardsOpen, setCardsOpen] = useState(false)

  const current = transactions.filter((t) => t.month === month)
  const summary = summarize(current)
  const previous = summarize(transactions.filter((t) => t.month === addMonths(month, -1)))

  // Em mês com mais resgate que aporte o investido fica negativo; na barra de destino da receita conta como zero.
  const netInvested = Math.max(0, summary.investimentos)

  const expenses = current.filter((t) => t.type === 'despesa')
  const breakdown = expenseBreakdown(expenses)
  const creditIds = new Set([...methods.values()].filter((m) => m.kind === 'credito').map((m) => m.id))
  const byMethod = methodBreakdown(expenses, creditIds)
  const maxMethod = byMethod[0]?.total ?? 0

  const tiles = [
    { label: 'Receitas', value: summary.receitas, prev: previous.receitas, type: 'receita' },
    { label: 'Despesas', value: summary.despesas, prev: previous.despesas, type: 'despesa' },
    { label: 'Investimentos', value: summary.investimentos, prev: previous.investimentos, type: 'investimento' },
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
          <Link key={tile.type} to={lancamentosLink({ tipo: tile.type })} className="card block p-4 hover:bg-slate-50">
            <div className="text-xs font-medium text-slate-500">{tile.label}</div>
            <div className={`truncate text-xl font-bold tabular-nums ${TYPE_STYLE[tile.type].text}`}>
              {formatBRL(tile.value)}
            </div>
            <Delta current={tile.value} previous={tile.prev} month={month} />
          </Link>
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

      <CategoryBreakdown breakdown={breakdown} categories={categories} expandable />

      {byMethod.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Despesas por forma de pagamento</h2>
          <ul className="space-y-3">
            {byMethod.map((row) => {
              const grouped = row.kind === 'cartoes'
              const name = grouped ? 'Cartões de crédito' : (methods.get(row.id)?.name ?? '—')
              return (
                <li key={row.id}>
                  <div className="flex items-center gap-1">
                    {grouped ? (
                      <button
                        className="-ml-1 rounded p-1 text-slate-400 hover:bg-slate-100"
                        onClick={() => setCardsOpen(!cardsOpen)}
                        aria-expanded={cardsOpen}
                        aria-label={`${cardsOpen ? 'Fechar' : 'Abrir'} os cartões`}
                      >
                        {cardsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                    <Link
                      to={lancamentosLink({ tipo: 'despesa', forma: grouped ? ALL_CREDIT : row.id })}
                      className="-my-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-sm hover:bg-slate-50"
                    >
                      {grouped && <CreditCard size={16} className="shrink-0 text-slate-400" />}
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="text-xs text-slate-500">{percentOf(row.share)}</span>
                      <span className="w-24 text-right font-medium tabular-nums">{formatBRL(row.total)}</span>
                    </Link>
                  </div>
                  <div className="ml-5 mt-1">
                    <Bar value={row.total} max={maxMethod} />
                  </div>
                  {grouped && cardsOpen && (
                    <ul className="ml-5 mt-2 divide-y divide-slate-100 rounded-lg bg-slate-50 px-3 text-sm">
                      {row.cards.map((card) => (
                        <li key={card.id}>
                          <Link
                            to={lancamentosLink({ tipo: 'despesa', forma: card.id })}
                            className="flex items-center gap-2 py-2 hover:underline"
                          >
                            <span className="min-w-0 flex-1 truncate text-slate-600">{methods.get(card.id)?.name ?? '—'}</span>
                            <span className="text-xs text-slate-500">{percentOf(card.share)}</span>
                            <span className="w-24 text-right tabular-nums">{formatBRL(card.total)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
