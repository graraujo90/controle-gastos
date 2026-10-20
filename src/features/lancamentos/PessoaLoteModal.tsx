import { useState } from 'react'
import { Modal } from '../../components/Modal'
import type { Person } from '../../db/types'

interface Props {
  count: number
  people: Map<string, Person>
  onClose: () => void
  /** null = da família. */
  onApply: (personId: string | null) => void
}

/** Escolha de quem são vários lançamentos de uma vez (inclusive para tornar da família). */
export function PessoaLoteModal({ count, people, onClose, onApply }: Props) {
  const [personId, setPersonId] = useState('')
  const active = [...people.values()].filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <Modal title="Mudar pessoa" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {count} {count === 1 ? 'lançamento' : 'lançamentos'}.
        </p>
        <div>
          <label className="label" htmlFor="lote-pessoa">De quem é</label>
          <select id="lote-pessoa" className="field" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Família</option>
            {active.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary ml-auto flex-1 sm:flex-none" onClick={() => onApply(personId || null)}>
            Aplicar
          </button>
        </div>
      </div>
    </Modal>
  )
}
