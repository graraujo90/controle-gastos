import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { TX_LABEL_PLURAL, type Category, type TxType } from '../../db/types'

interface Props {
  type: TxType
  count: number
  categories: Map<string, Category>
  onClose: () => void
  onApply: (categoryId: string, subcategoryId: string | null) => void
}

/** Escolha da nova categoria (e subcategoria) para vários lançamentos do mesmo tipo. */
export function CategoriaLoteModal({ type, count, categories, onClose, onApply }: Props) {
  const all = [...categories.values()].filter((c) => c.type === type && !c.archived)
  const parents = all.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const subs = all.filter((c) => c.parentId === categoryId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <Modal title="Mudar categoria" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {count} {count === 1 ? 'lançamento' : 'lançamentos'} de {TX_LABEL_PLURAL[type].toLowerCase()}.
        </p>
        <div>
          <label className="label" htmlFor="lote-cat">Categoria</label>
          <select
            id="lote-cat"
            className="field"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setSubcategoryId('')
            }}
          >
            <option value="">Selecione…</option>
            {parents.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {subs.length > 0 && (
          <div>
            <label className="label" htmlFor="lote-sub">Subcategoria (opcional)</label>
            <select id="lote-sub" className="field" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
              <option value="">Nenhuma</option>
              {subs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary ml-auto flex-1 sm:flex-none"
            disabled={!categoryId}
            onClick={() => onApply(categoryId, subcategoryId || null)}
          >
            Aplicar
          </button>
        </div>
      </div>
    </Modal>
  )
}
