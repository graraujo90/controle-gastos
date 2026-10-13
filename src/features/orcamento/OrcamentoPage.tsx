import { ChevronRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useApp } from '../../app/AppContext'
import { Modal } from '../../components/Modal'
import { MoneyInput } from '../../components/MoneyInput'
import { MonthPicker } from '../../components/MonthPicker'
import { setBudget } from '../../db/repo'
import type { Category, Transaction } from '../../db/types'
import { budgetLevel } from '../../domain/orcamento'
import { formatBRL, monthLabel } from '../../lib/format'
import { LEVEL_BAR, useBudget, type BudgetRow } from './useBudget'

function ProgressBar({ spent, limit }: { spent: number; limit: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${LEVEL_BAR[budgetLevel(spent, limit)]}`}
        style={{ width: `${Math.min(100, (spent / limit) * 100)}%` }}
      />
    </div>
  )
}

/** "Restam R$ X" ou "Passou R$ X". */
function Remaining({ spent, limit }: { spent: number; limit: number }) {
  return spent > limit ? (
    <span className="font-semibold text-rose-600">Passou {formatBRL(spent - limit)}</span>
  ) : (
    <span>Restam {formatBRL(limit - spent)}</span>
  )
}

interface FormProps {
  row: BudgetRow
  month: string
  expenses: Transaction[]
  categories: Map<string, Category>
  onClose: () => void
}

function BudgetForm({ row, month, expenses, categories, onClose }: FormProps) {
  const [limit, setLimit] = useState(row.limit ?? 0)

  // Detalhe do gasto por subcategoria; o limite continua valendo para a categoria inteira.
  const bySub = new Map<string, number>()
  for (const t of expenses) {
    if (t.categoryId !== row.category.id) continue
    const key = t.subcategoryId ?? ''
    bySub.set(key, (bySub.get(key) ?? 0) + t.amount)
  }
  const subs = [...bySub].sort((a, b) => b[1] - a[1])

  async function save(e: FormEvent) {
    e.preventDefault()
    await setBudget(month, row.category.id, limit)
    onClose()
  }

  async function clear() {
    await setBudget(month, row.category.id, 0)
    onClose()
  }

  return (
    <Modal title={row.category.name} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="bd-limite">Limite mensal</label>
          <MoneyInput id="bd-limite" value={limit} onChange={setLimit} autoFocus className="field text-2xl font-semibold" />
          <p className="mt-1 text-xs text-slate-500">
            Vale a partir de {monthLabel(month).toLowerCase()} e segue nos meses seguintes até você alterar.
          </p>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium text-slate-600">Gasto em {monthLabel(month).toLowerCase()}</span>
            <span className="font-semibold tabular-nums">{formatBRL(row.spent)}</span>
          </div>
          {subs.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg bg-slate-50 px-3 text-sm">
              {subs.map(([id, total]) => (
                <li key={id} className="flex justify-between py-2">
                  <span className="text-slate-600">{id ? (categories.get(id)?.name ?? '—') : 'Sem subcategoria'}</span>
                  <span className="tabular-nums">{formatBRL(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {row.limit && (
            <button type="button" className="btn btn-danger" onClick={clear}>Remover limite</button>
          )}
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

export function OrcamentoPage() {
  const { month } = useApp()
  const { rows, expenses, categories, totalLimit, totalSpent, unbudgetedSpent } = useBudget(month)
  const [editing, setEditing] = useState<BudgetRow | null>(null)

  return (
    <div className="space-y-4">
      <MonthPicker />

      <div className="card p-5">
        {totalLimit > 0 ? (
          <>
            <div className="text-sm text-slate-500">Orçamento do mês</div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold tabular-nums">{formatBRL(totalSpent)}</span>
              <span className="text-sm text-slate-500">de {formatBRL(totalLimit)}</span>
            </div>
            <ProgressBar spent={totalSpent} limit={totalLimit} />
            <div className="mt-2 text-sm text-slate-600">
              <Remaining spent={totalSpent} limit={totalLimit} />
            </div>
            {unbudgetedSpent > 0 && (
              <div className="mt-1 text-xs text-slate-500">
                Mais {formatBRL(unbudgetedSpent)} gastos em categorias sem limite.
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Nenhum limite definido ainda. Toque em uma categoria para definir quanto pretende gastar por mês.
          </p>
        )}
      </div>

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {rows.map((row) => (
          <button
            key={row.category.id}
            className="block w-full px-4 py-3 text-left hover:bg-slate-50"
            onClick={() => setEditing(row)}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.category.color }} />
              <span className="min-w-0 flex-1 truncate font-medium">{row.category.name}</span>
              <span className="shrink-0 text-sm tabular-nums">
                <span className="font-semibold">{formatBRL(row.spent)}</span>
                {row.limit && <span className="text-slate-500"> / {formatBRL(row.limit)}</span>}
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </div>
            {row.limit ? (
              <>
                <ProgressBar spent={row.spent} limit={row.limit} />
                <div className="mt-1 text-xs text-slate-500">
                  <Remaining spent={row.spent} limit={row.limit} />
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400">Sem limite — toque para definir</div>
            )}
          </button>
        ))}
      </div>

      {editing && (
        <BudgetForm
          row={editing}
          month={month}
          expenses={expenses}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
