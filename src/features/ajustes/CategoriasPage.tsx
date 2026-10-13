import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { TYPE_STYLE } from '../../components/typeStyle'
import { db } from '../../db/db'
import { removeCategory, saveCategory } from '../../db/repo'
import { PALETTE } from '../../db/seed'
import { TX_LABEL_PLURAL, TX_TYPES, type Category, type TxType } from '../../db/types'
import { BackLink } from './BackLink'

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name.trim())
    setName('')
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input className="field" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      <button className="btn btn-primary shrink-0" aria-label="Adicionar">
        <Plus size={18} />
      </button>
    </form>
  )
}

function CategoryRow({ category, children }: { category: Category; children?: ReactNode }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  async function rename(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) await saveCategory({ ...category, name: name.trim() })
    setEditing(false)
  }

  async function remove() {
    if (!confirm(`Excluir "${category.name}"?`)) return
    if ((await removeCategory(category.id)) === 'arquivada') {
      alert('Esta categoria já tem lançamentos, então foi arquivada: some das listas, mas o histórico é mantido.')
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {children}
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: category.color }} />
      {editing ? (
        <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
          <input className="field !py-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={40} />
          <button className="btn btn-ghost !p-2" aria-label="Salvar nome">
            <Check size={16} />
          </button>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{category.name}</span>
          <button className="btn btn-ghost !p-2" onClick={() => setEditing(true)} aria-label={`Renomear ${category.name}`}>
            <Pencil size={16} />
          </button>
          <button className="btn btn-danger !p-2" onClick={remove} aria-label={`Excluir ${category.name}`}>
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  )
}

export function CategoriasPage() {
  const [type, setType] = useState<TxType>('despesa')
  const [open, setOpen] = useState<string | null>(null)
  const all = (useLiveQuery(() => db.categories.toArray(), []) ?? []).filter((c) => !c.archived)
  const top = all.filter((c) => c.type === type && !c.parentId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const subsOf = (id: string) =>
    all.filter((c) => c.parentId === id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="space-y-4">
      <BackLink title="Categorias" />

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200/60 p-1">
        {TX_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-md py-2 text-sm font-semibold ${type === t ? `${TYPE_STYLE[t].solid} text-white` : 'text-slate-600'}`}
          >
            {TX_LABEL_PLURAL[t]}
          </button>
        ))}
      </div>

      {type !== 'receita' && (
        <p className="text-sm text-slate-500">
          Toque na seta para ver e cadastrar subcategorias.{' '}
          {type === 'despesa'
            ? 'O limite mensal do orçamento vale para a categoria inteira.'
            : 'Use-as, se quiser, para separar o mesmo tipo de investimento por banco ou corretora.'}
        </p>
      )}

      <div className="card divide-y divide-slate-100">
        {top.map((c) => {
          const subs = subsOf(c.id)
          const expanded = open === c.id
          return (
            <div key={c.id}>
              <CategoryRow category={c}>
                {type !== 'receita' && (
                  <button
                    className="btn btn-ghost !p-1"
                    onClick={() => setOpen(expanded ? null : c.id)}
                    aria-label={`Subcategorias de ${c.name}`}
                  >
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    <span className="text-xs text-slate-400">{subs.length}</span>
                  </button>
                )}
              </CategoryRow>
              {expanded && (
                <div className="space-y-1 border-t border-slate-100 bg-slate-50 py-2 pl-8 pr-3">
                  {subs.map((s) => (
                    <CategoryRow key={s.id} category={s} />
                  ))}
                  <div className="px-3 py-1">
                    <AddInput
                      placeholder={`Nova subcategoria de ${c.name}`}
                      onAdd={(name) =>
                        saveCategory({ name, type: c.type, parentId: c.id, color: c.color, archived: false })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {top.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Nenhuma categoria cadastrada.</p>}
      </div>

      <AddInput
        placeholder={`Nova categoria de ${TX_LABEL_PLURAL[type].toLowerCase()}`}
        onAdd={(name) =>
          saveCategory({ name, type, parentId: null, color: PALETTE[all.length % PALETTE.length], archived: false })
        }
      />
    </div>
  )
}
