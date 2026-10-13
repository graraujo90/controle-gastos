import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { MoneyInput } from '../../components/MoneyInput'
import { TX_LABEL, TX_LABEL_PLURAL, TX_TYPES, type Category, type PaymentMethod, type TxType } from '../../db/types'
import { ALL_CREDIT, NO_SUB, type Situation, type TxFilter } from '../../domain/filtro'

interface Props {
  filter: TxFilter
  categories: Map<string, Category>
  methods: Map<string, PaymentMethod>
  onApply: (filter: TxFilter) => void
  onClose: () => void
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')

export const SITUATION_LABEL: Record<Situation, string> = {
  confirmado: 'Confirmados',
  pendente: 'Pendentes',
  atrasado: 'Em atraso',
}

/** Janela com todos os critérios de filtro. Só altera a lista ao tocar em "Aplicar". */
export function FiltroModal({ filter, categories, methods, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<TxFilter>(filter)
  const set = (changes: Partial<TxFilter>) => setDraft((d) => ({ ...d, ...changes }))

  const all = [...categories.values()]
  // Arquivados só entram se já estiverem escolhidos no filtro.
  const keep = (item: { id: string; archived: boolean }, chosen?: string) => !item.archived || item.id === chosen
  const tops = (type: TxType) => all.filter((c) => c.type === type && !c.parentId && keep(c, draft.categoria)).sort(byName)
  const subs = all.filter((c) => c.parentId === draft.categoria && draft.categoria && keep(c, draft.subcategoria)).sort(byName)
  const methodList = [...methods.values()].filter((m) => keep(m, draft.forma)).sort(byName)
  const hasCards = methodList.some((m) => m.kind === 'credito')
  const types = draft.tipo ? [draft.tipo] : TX_TYPES

  function changeType(tipo?: TxType) {
    // Escolher tipo ou situação aqui substitui o atalho "a pagar / a receber / a investir".
    const category = draft.categoria ? categories.get(draft.categoria) : undefined
    const stale = tipo && category && category.type !== tipo
    set({ tipo, pendencia: undefined, ...(stale ? { categoria: undefined, subcategoria: undefined } : {}) })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    onApply(draft)
  }

  return (
    <Modal title="Filtros" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ft-tipo">Tipo</label>
            <select id="ft-tipo" className="field" value={draft.tipo ?? ''} onChange={(e) => changeType((e.target.value || undefined) as TxType | undefined)}>
              <option value="">Todos</option>
              {TX_TYPES.map((t) => (
                <option key={t} value={t}>{TX_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ft-sit">Situação</label>
            <select
              id="ft-sit"
              className="field"
              value={draft.situacao ?? ''}
              onChange={(e) => set({ situacao: (e.target.value || undefined) as Situation | undefined, pendencia: undefined })}
            >
              <option value="">Todas</option>
              {(Object.keys(SITUATION_LABEL) as Situation[]).map((s) => (
                <option key={s} value={s}>{SITUATION_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ft-cat">Categoria</label>
          <select
            id="ft-cat"
            className="field"
            value={draft.categoria ?? ''}
            onChange={(e) => set({ categoria: e.target.value || undefined, subcategoria: undefined })}
          >
            <option value="">Todas</option>
            {types.map((t) => (
              <optgroup key={t} label={TX_LABEL_PLURAL[t]}>
                {tops(t).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {subs.length > 0 && (
          <div>
            <label className="label" htmlFor="ft-sub">Subcategoria</label>
            <select id="ft-sub" className="field" value={draft.subcategoria ?? ''} onChange={(e) => set({ subcategoria: e.target.value || undefined })}>
              <option value="">Todas</option>
              <option value={NO_SUB}>Sem subcategoria</option>
              {subs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="ft-forma">Forma de recebimento ou pagamento</label>
          <select id="ft-forma" className="field" value={draft.forma ?? ''} onChange={(e) => set({ forma: e.target.value || undefined })}>
            <option value="">Todas</option>
            {hasCards && <option value={ALL_CREDIT}>Todos os cartões de crédito</option>}
            {methodList.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ft-min">Valor mínimo</label>
            <MoneyInput id="ft-min" value={draft.min ?? 0} onChange={(v) => set({ min: v || undefined })} />
          </div>
          <div>
            <label className="label" htmlFor="ft-max">Valor máximo</label>
            <MoneyInput id="ft-max" value={draft.max ?? 0} onChange={(v) => set({ max: v || undefined })} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ft-texto">Texto</label>
          <input
            id="ft-texto"
            className="field"
            placeholder="Procura na descrição e na categoria"
            value={draft.texto ?? ''}
            onChange={(e) => set({ texto: e.target.value || undefined })}
            maxLength={60}
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-5 w-5 accent-emerald-600"
            checked={!!draft.parcelado}
            onChange={(e) => set({ parcelado: e.target.checked || undefined })}
          />
          Só compras parceladas
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-5 w-5 accent-emerald-600"
            checked={!!draft.recorrente}
            onChange={(e) => set({ recorrente: e.target.checked || undefined })}
          />
          Só lançamentos recorrentes
        </label>

        <div className="flex gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={() => onApply({})}>Limpar tudo</button>
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">Aplicar</button>
        </div>
      </form>
    </Modal>
  )
}
