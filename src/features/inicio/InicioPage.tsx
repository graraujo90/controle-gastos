import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { MonthPicker } from '../../components/MonthPicker'
import { TYPE_STYLE } from '../../components/typeStyle'
import { db } from '../../db/db'
import { pendingByKind } from '../../domain/contas'
import { budgetLevel } from '../../domain/orcamento'
import { summarize, totalsByCategory } from '../../domain/resumo'
import { formatBRL, todayISO } from '../../lib/format'
import { TransactionRow } from '../lancamentos/TransactionRow'
import { useMonthData } from '../lancamentos/useMonthData'
import { LEVEL_BAR, useBudget } from '../orcamento/useBudget'

export function InicioPage() {
  const { month, openForm } = useApp()
  const { transactions, categories, methods, loading } = useMonthData(month)
  const summary = summarize(transactions)
  const expenses = totalsByCategory(transactions.filter((t) => t.type === 'despesa'))
  const recent = [...transactions]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const budget = useBudget(month)
  const over = budget.rows.filter((r) => r.level === 'estourado').length

  // O resultado do mês conta tudo que foi lançado (previsto); o realizado considera só o já confirmado.
  const realized = summarize(transactions.filter((t) => t.paid)).resultado
  const hasPending = transactions.some((t) => !t.paid)

  // Atrasados e de hoje independem do mês em exibição; os totais "no mês" seguem o seletor.
  const today = todayISO()
  const unpaid = useLiveQuery(() => db.transactions.filter((t) => !t.paid).toArray(), []) ?? []
  const pending = pendingByKind(unpaid, today, month)
  const bills = pending.pagar
  const overdue = unpaid.filter((t) => t.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return (
    <div className="space-y-4">
      <MonthPicker />

      <div className="card p-5">
        <div className="text-sm text-slate-500">Resultado do mês</div>
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
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {(
          [
            ['Receitas', summary.receitas, 'receita'],
            ['Despesas', summary.despesas, 'despesa'],
            ['Investido', summary.investimentos, 'investimento'],
          ] as const
        ).map(([label, value, type]) => (
          <div key={type} className={`rounded-xl p-3 sm:p-4 ${TYPE_STYLE[type].bg}`}>
            <div className="text-xs font-medium text-slate-600">{label}</div>
            <div className={`truncate text-sm font-bold tabular-nums sm:text-xl ${TYPE_STYLE[type].text}`}>
              {formatBRL(value)}
            </div>
          </div>
        ))}
      </div>

      {budget.totalLimit > 0 && (
        <Link to="/orcamento" className="card block p-4 hover:bg-slate-50">
          <div className="mb-2 flex items-baseline justify-between gap-2">
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

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Pendências</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {(
            [
              ['Em atraso', bills.overdueTotal, bills.overdueCount, bills.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'],
              ['Vence hoje', bills.todayTotal, bills.todayCount, bills.todayCount > 0 ? 'text-amber-600' : 'text-slate-900'],
              ['A pagar no mês', bills.monthTotal, bills.monthCount, 'text-slate-900'],
            ] as const
          ).map(([label, total, count, color]) => (
            <div key={label}>
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className={`truncate text-sm font-bold tabular-nums sm:text-lg ${color}`}>{formatBRL(total)}</div>
              <div className="text-xs text-slate-500">
                {count} {count === 1 ? 'despesa' : 'despesas'}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:gap-4">
          {(
            [
              ['A receber no mês', pending.receber],
              ['A investir no mês', pending.investir],
            ] as const
          ).map(([label, p]) => (
            <div key={label}>
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className="truncate text-sm font-bold tabular-nums sm:text-lg">{formatBRL(p.monthTotal)}</div>
              <div className="text-xs text-slate-500">
                {p.monthCount} {p.monthCount === 1 ? 'lançamento' : 'lançamentos'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {overdue.length > 0 && (
        <section>
          <h2 className="mb-1 px-1 font-semibold text-rose-600">Em atraso</h2>
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {overdue.map((t) => (
              <TransactionRow key={t.id} tx={t} categories={categories} methods={methods} />
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

      {expenses.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Despesas por categoria</h2>
          <ul className="space-y-3">
            {expenses.map(({ categoryId, total }) => {
              const category = categories.get(categoryId)
              return (
                <li key={categoryId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{category?.name ?? '—'}</span>
                    <span className="font-medium tabular-nums">{formatBRL(total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(total / expenses[0].total) * 100}%`, background: category?.color ?? '#94a3b8' }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

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
