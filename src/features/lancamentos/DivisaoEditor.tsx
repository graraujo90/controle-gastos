import { Plus, X } from 'lucide-react'
import { MoneyInput } from '../../components/MoneyInput'
import type { Category } from '../../db/types'
import { remaining, type SplitPart } from '../../domain/divisao'
import { formatBRL } from '../../lib/format'

/** Uma linha da divisão; `key` só identifica a linha na tela enquanto ela é editada. */
export type SplitRow = SplitPart & { key: string }

export const newRow = (part: Partial<SplitPart> = {}): SplitRow => ({
  key: crypto.randomUUID(),
  categoryId: '',
  subcategoryId: null,
  amount: 0,
  ...part,
})

interface Props {
  total: number
  rows: SplitRow[]
  /** Categorias de despesa (inclui subcategorias). */
  categories: Category[]
  onChange: (rows: SplitRow[]) => void
  /** Volta a ser uma compra de uma categoria só (apenas antes de a divisão ser salva). */
  onCancel?: () => void
}

/** Linhas de categoria, subcategoria e valor de uma compra dividida, com o quanto falta distribuir. */
export function DivisaoEditor({ total, rows, categories, onChange, onCancel }: Props) {
  const left = remaining(total, rows)
  const update = (key: string, changes: Partial<SplitPart>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...changes } : row)))
  const usable = (c: Category, selected: string | null) => !c.archived || c.id === selected
  const parents = categories.filter((c) => !c.parentId)

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Dividida em categorias</span>
        {onCancel && (
          <button type="button" className="text-xs font-semibold text-slate-500 hover:underline" onClick={onCancel}>
            Desfazer divisão
          </button>
        )}
      </div>

      {rows.map((row, i) => {
        const subs = categories.filter((c) => c.parentId === row.categoryId && row.categoryId && usable(c, row.subcategoryId))
        return (
          <div key={row.key} className="space-y-1.5 rounded-md bg-slate-50 p-2">
            <div className="flex gap-2">
              <select
                className="field"
                aria-label={`Categoria da parte ${i + 1}`}
                value={row.categoryId}
                onChange={(e) => update(row.key, { categoryId: e.target.value, subcategoryId: null })}
              >
                <option value="">Categoria…</option>
                {parents
                  .filter((c) => usable(c, row.categoryId))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              {rows.length > 2 && (
                <button
                  type="button"
                  className="btn btn-ghost shrink-0 !px-2"
                  onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                  aria-label={`Remover a parte ${i + 1}`}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {subs.length > 0 ? (
                <select
                  className="field"
                  aria-label={`Subcategoria da parte ${i + 1}`}
                  value={row.subcategoryId ?? ''}
                  onChange={(e) => update(row.key, { subcategoryId: e.target.value || null })}
                >
                  <option value="">Sem subcategoria</option>
                  {subs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <span className="flex-1" />
              )}
              <MoneyInput
                value={row.amount}
                onChange={(amount) => update(row.key, { amount })}
                className="field w-36 shrink-0 text-right font-semibold"
              />
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="flex items-center gap-1 font-semibold text-slate-600 hover:underline"
          onClick={() => onChange([...rows, newRow()])}
        >
          <Plus size={14} /> Adicionar categoria
        </button>
        <span className={left === 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
          {left === 0 ? 'Tudo distribuído' : left > 0 ? `Falta ${formatBRL(left)}` : `Passou ${formatBRL(-left)}`}
        </span>
      </div>
      {left > 0 && rows.length > 0 && (
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 hover:underline"
          onClick={() => update(rows[rows.length - 1].key, { amount: rows[rows.length - 1].amount + left })}
        >
          Pôr o que falta na última parte
        </button>
      )}
    </div>
  )
}
