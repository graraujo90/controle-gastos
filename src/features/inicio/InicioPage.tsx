import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { CategoryBreakdown } from '../../components/CategoryBreakdown'
import { MonthPicker } from '../../components/MonthPicker'
import { TYPE_STYLE } from '../../components/typeStyle'
import { db } from '../../db/db'
import { pendingByKind } from '../../domain/contas'
import { lancamentosLink, type TxFilter } from '../../domain/filtro'
import { budgetLevel } from '../../domain/orcamento'
import { expenseBreakdown, summarize } from '../../domain/resumo'
import { formatBRL, todayISO } from '../../lib/format'
import { TransactionRow } from '../lancamentos/TransactionRow'
import { useMonthData } from '../lancamentos/useMonthData'
import { LEVEL_BAR, useBudget } from '../orcamento/useBudget'

interface PendingRow {
  label: string
  total: number
  count: number
  hint?: string
  tone: string
  filter: TxFilter
}

export function InicioPage() {
  const { month, openForm } = useApp()
  const { transactions, categories, methods, loading } = useMonthData(month)
  const summary = summarize(transactions)
  const breakdown = expenseBreakdown(transactions.filter((t) => t.type === 'despesa'))
  const recent = [...transactions]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const budget = useBudget(month)
  const over = budget.rows.filter((r) => r.level === 'estourado').length

  // O resultado do mês conta tudo que foi lançado (previsto); o realizado considera só o já confirmado.
  const realized = summarize(transactions.filter((t) => t.paid)).resultado
  const hasPending = transactions.some((t) => !t.paid)

  // Atrasados independem do mês em exibição; os totais "no mês" seguem o seletor.
  const today = todayISO()
  const unpaid = useLiveQuery(() => db.transactions.filter((t) => !t.paid).toArray(), []) ?? []
  const pending = pendingByKind(unpaid, today, month)
  // Só entram as pendências que existem; cada uma leva à lista já filtrada.
  const allPending: PendingRow[] = [
    {
      label: 'Em atraso',
      total: pending.pagar.overdueTotal,
      count: pending.pagar.overdueCount,
      hint: 'de qualquer mês',
      tone: 'text-rose-600',
      filter: { pendencia: 'pagar', situacao: 'atrasado' },
    },
    {
      label: 'A pagar no mês',
      total: pending.pagar.monthTotal,
      count: pending.pagar.monthCount,
      hint: pending.pagar.todayCount > 0 ? `${formatBRL(pending.pagar.todayTotal)} vence hoje` : undefined,
      tone: 'text-slate-900',
      filter: { pendencia: 'pagar' },
    },
    {
      label: 'A receber no mês',
      total: pending.receber.monthTotal,
      count: pending.receber.monthCount,
      tone: 'text-slate-900',
      filter: { pendencia: 'receber' },
    },
    {
      label: 'A investir no mês',
      total: pending.investir.monthTotal,
      count: pending.investir.monthCount,
      tone: 'text-slate-900',
      filter: { pendencia: 'investir' },
    },
  ]
  const pendingRows = allPending.filter((row) => row.count > 0)

  return (
    <div className="space-y-4">
      <MonthPicker />

      <Link to="/relatorios" className="card block p-5 hover:bg-slate-50" aria-label="Resultado do mês: abrir relatórios">
        <div className="flex items-center justify-between text-sm text-slate-500">
          Resultado do mês
          <ChevronRight size={16} className="text-slate-400" />
        </div>
        <div className={`text-3xl font-bold tabular-nums ${summary.resultado < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
          {formatBRL(summary.resultado)}
        </div>
        <div className="mt-1 text-xs text-slate-500">Receitas − despesas − investimentos</div>
        {hasPending && (
          <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">Realizado até agora</span>
            <span className={`font-semibold tabular-nums ${realized < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatBRL(realized)}
            </span>
          </div>
        )}
      </Link>

      {/* No celular, uma linha por tipo (cabe qualquer valor); a partir do tablet, lado a lado. */}
      <div className="card divide-y divide-slate-100 overflow-hidden sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {(
          [
            ['Receitas', summary.receitas, 'receita'],
            ['Despesas', summary.despesas, 'despesa'],
            ['Investimentos', summary.investimentos, 'investimento'],
          ] as const
        ).map(([label, value, type]) => (
          <Link
            key={type}
            to={lancamentosLink({ tipo: type })}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:block sm:p-4"
          >
            <span className={`h-8 w-1 shrink-0 rounded-full sm:mb-2 sm:block sm:h-1 sm:w-8 ${TYPE_STYLE[type].solid}`} />
            <span className="flex-1 text-sm font-medium text-slate-600 sm:block sm:text-xs">{label}</span>
            <span className={`whitespace-nowrap font-bold tabular-nums sm:block sm:text-xl ${TYPE_STYLE[type].text}`}>
              {formatBRL(value)}
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400 sm:hidden" />
          </Link>
        ))}
      </div>

      {budget.totalLimit > 0 && (
        <Link to="/orcamento" className="card block p-4 hover:bg-slate-50">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
            <h2 className="font-semibold">Orçamento</h2>
            <span className="text-sm tabular-nums text-slate-600">
              <span className="font-semibold text-slate-900">{formatBRL(budget.totalSpent)}</span> de{' '}
              {formatBRL(budget.totalLimit)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${LEVEL_BAR[budgetLevel(budget.totalSpent, budget.totalLimit)]}`}
              style={{ width: `${Math.min(100, (budget.totalSpent / budget.totalLimit) * 100)}%` }}
            />
          </div>
          {over > 0 && (
            <div className="mt-2 text-xs font-semibold text-rose-600">
              {over} {over === 1 ? 'categoria passou' : 'categorias passaram'} do limite
            </div>
          )}
        </Link>
      )}

      {pendingRows.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 font-semibold">Pendências</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {pendingRows.map((row) => (
              <Link key={row.label} to={lancamentosLink(row.filter)} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{row.label}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {row.count} {row.count === 1 ? 'lançamento' : 'lançamentos'}
                    {row.hint && ` · ${row.hint}`}
                  </span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${row.tone}`}>{formatBRL(row.total)}</span>
                <ChevronRight size={16} className="shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loading && transactions.length === 0 && (
        <div className="card p-8 text-center text-slate-500">
          <p>Nenhum lançamento neste mês ainda.</p>
          <button className="btn btn-primary mt-4" onClick={() => openForm()}>Fazer o primeiro lançamento</button>
        </div>
      )}

      {breakdown.categories.length > 0 && <CategoryBreakdown breakdown={breakdown} categories={categories} />}

      {recent.length > 0 && (
        <section>
          <div className="mb-1 flex items-center justify-between px-1">
            <h2 className="font-semibold">Últimos lançamentos</h2>
            <Link to="/lancamentos" className="text-sm font-medium text-slate-500 hover:text-slate-900">Ver todos</Link>
          </div>
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {recent.map((t) => (
              <TransactionRow key={t.id} tx={t} categories={categories} methods={methods} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
