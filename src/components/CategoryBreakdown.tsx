import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Category } from '../db/types'
import { lancamentosLink, NO_SUB } from '../domain/filtro'
import type { ExpenseBreakdown } from '../domain/resumo'
import { formatBRL } from '../lib/format'
import { CategoryIcon } from './CategoryIcon'

interface Props {
  breakdown: ExpenseBreakdown
  categories: Map<string, Category>
  /** Com subcategorias que abrem pela seta (Relatórios) ou só as categorias (Início). */
  expandable?: boolean
}

export const percent = (share: number) => `${Math.round(share * 100)}%`

/**
 * Despesas por categoria: peso de cada uma no total e quanto já foi pago. Tocar em uma categoria
 * ou subcategoria abre os lançamentos dela.
 */
export function CategoryBreakdown({ breakdown, categories, expandable = false }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const { total, paid, categories: rows } = breakdown
  const max = rows[0]?.total ?? 0

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Despesas por categoria</h2>
        {total > 0 && (
          <span className="shrink-0 text-xs text-slate-500">
            {formatBRL(paid)} pagos ({percent(paid / total)})
          </span>
        )}
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-500">Nenhuma despesa neste mês.</p>}
      <ul className="space-y-3">
        {rows.map((row) => {
          const category = categories.get(row.id)
          const hasSubs = expandable && row.subs.some((s) => s.id)
          const expanded = open === row.id
          return (
            <li key={row.id}>
              <div className="flex items-center gap-1">
                {expandable &&
                  (hasSubs ? (
                    <button
                      className="-ml-1 rounded p-1 text-slate-400 hover:bg-slate-100"
                      onClick={() => setOpen(expanded ? null : row.id)}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Fechar' : 'Abrir'} subcategorias de ${category?.name ?? ''}`}
                    >
                      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  ) : (
                    <span className="w-5 shrink-0" />
                  ))}
                <Link
                  to={lancamentosLink({ tipo: 'despesa', categoria: row.id })}
                  className="-my-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-sm hover:bg-slate-50"
                >
                  <CategoryIcon category={category} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{category?.name ?? '—'}</span>
                  <span className="text-xs text-slate-500">{percent(row.share)}</span>
                  <span className="w-24 text-right font-medium tabular-nums">{formatBRL(row.total)}</span>
                </Link>
              </div>
              <div className={`mt-1 h-2 overflow-hidden rounded-full bg-slate-100 ${expandable ? 'ml-5' : ''}`}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${max > 0 ? (row.total / max) * 100 : 0}%`, background: category?.color ?? '#94a3b8' }}
                />
              </div>
              {expanded && (
                <ul className="ml-5 mt-2 divide-y divide-slate-100 rounded-lg bg-slate-50 px-3 text-sm">
                  {row.subs.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        to={lancamentosLink({ tipo: 'despesa', categoria: row.id, subcategoria: sub.id || NO_SUB })}
                        className="flex items-center gap-2 py-2 hover:underline"
                      >
                        <span className="min-w-0 flex-1 truncate text-slate-600">
                          {sub.id ? (categories.get(sub.id)?.name ?? '—') : 'Sem subcategoria'}
                        </span>
                        <span className="text-xs text-slate-500">{percent(sub.share)}</span>
                        <span className="w-24 text-right tabular-nums">{formatBRL(sub.total)}</span>
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
  )
}
