import { useLiveQuery } from 'dexie-react-hooks'
import { Baby, Plus, Trash2, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import { removePerson, savePerson } from '../../db/repo'
import { PERSON_KIND_LABEL, type Person, type PersonKind } from '../../db/types'
import { BackLink } from './BackLink'

const KINDS = Object.keys(PERSON_KIND_LABEL) as PersonKind[]

const KIND_HINT: Record<PersonKind, string> = {
  adulto: 'Tem receitas e saldo próprio; divide as despesas da família na proporção da receita.',
  dependente: 'O que é dele é pago pela família, mas fica identificado para filtrar e destacar.',
}

function PersonForm({ person, onClose }: { person?: Person; onClose: () => void }) {
  const [name, setName] = useState(person?.name ?? '')
  const [kind, setKind] = useState<PersonKind>(person?.kind ?? 'adulto')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Informe um nome.')
    await savePerson({ id: person?.id, name: name.trim(), kind, archived: false })
    onClose()
  }

  async function remove() {
    if (!person || !confirm(`Excluir "${person.name}"?`)) return
    if ((await removePerson(person.id)) === 'arquivada') {
      alert('Esta pessoa já tem lançamentos, então foi arquivada: some das listas, mas o histórico é mantido.')
    }
    onClose()
  }

  return (
    <Modal title={person ? 'Editar pessoa' : 'Nova pessoa'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="ps-nome">Nome</label>
          <input
            id="ps-nome"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Ana, Pedro"
            maxLength={30}
            autoFocus={!person}
          />
        </div>
        <div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-md py-1.5 text-sm font-semibold ${kind === k ? 'seg-on' : 'text-slate-500'}`}
              >
                {PERSON_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">{KIND_HINT[kind]}</p>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {person && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

export function PessoasPage() {
  const [form, setForm] = useState<{ person?: Person } | null>(null)
  const people = (useLiveQuery(() => db.people.toArray(), []) ?? [])
    .filter((p) => !p.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const list = (kind: PersonKind, title: string, empty: string) => {
    const items = people.filter((p) => p.kind === kind)
    return (
      <section>
        <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {items.map((p) => (
            <button key={p.id} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setForm({ person: p })}>
              {kind === 'adulto' ? <User size={18} className="text-slate-400" /> : <Baby size={18} className="text-slate-400" />}
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            </button>
          ))}
          {items.length === 0 && <p className="p-4 text-center text-sm text-slate-500">{empty}</p>}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <BackLink title="Pessoas" />
      <p className="px-1 text-sm text-slate-600">
        Quem faz parte do orçamento. Despesas são da família por padrão; receitas e investimentos, de um adulto. Em
        cada lançamento dá para dizer de quem é.
      </p>
      {list('adulto', 'Adultos', 'Nenhum adulto cadastrado.')}
      {list('dependente', 'Dependentes', 'Nenhum dependente cadastrado.')}
      <button className="btn btn-primary w-full sm:w-auto" onClick={() => setForm({})}>
        <Plus size={18} /> Nova pessoa
      </button>
      {form && <PersonForm person={form.person} onClose={() => setForm(null)} />}
    </div>
  )
}
