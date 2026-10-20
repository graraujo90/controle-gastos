import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { sharePercent } from '../../components/PeopleBreakdown'
import { setShareOverride } from '../../db/repo'
import type { Person } from '../../db/types'
import type { AdultShare, ShareOverride } from '../../domain/pessoas'
import { monthLabel } from '../../lib/format'

interface Props {
  month: string
  adults: AdultShare[]
  people: Map<string, Person>
  /** Ajuste já gravado para o mês, se houver. */
  current?: ShareOverride
  onClose: () => void
}

/** Percentual de cada adulto nas despesas da família, só para este mês. */
export function ProporcaoModal({ month, adults: unsorted, people, current, onClose }: Props) {
  const name = (id: string) => people.get(id)?.name ?? '—'
  const adults = [...unsorted].sort((a, b) => name(a.personId).localeCompare(name(b.personId), 'pt-BR'))
  // Começa pelo ajuste do mês ou pela proporção automática, arredondada.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(adults.map((a) => [a.personId, String(current?.[a.personId] ?? Math.round(a.proportion * 100))])),
  )
  const [error, setError] = useState('')
  const numbers = adults.map((a) => Number(values[a.personId].replace(',', '.')) || 0)
  const total = numbers.reduce((sum, n) => sum + n, 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (numbers.some((n) => n < 0)) return setError('Os percentuais não podem ser negativos.')
    if (Math.abs(total - 100) > 0.001) return setError('Os percentuais precisam somar 100%.')
    await setShareOverride(month, Object.fromEntries(adults.map((a, i) => [a.personId, numbers[i]])))
    onClose()
  }

  async function automatic() {
    await setShareOverride(month, null)
    onClose()
  }

  return (
    <Modal title="Ajustar proporção" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Quanto cada adulto assume das despesas da família em {monthLabel(month).toLowerCase()}. Vale só para este mês.
        </p>
        {adults.map((a) => (
          <div key={a.personId} className="flex items-center gap-3">
            <label htmlFor={`pp-${a.personId}`} className="min-w-0 flex-1 truncate font-medium">
              {name(a.personId)}
              <span className="block text-xs font-normal text-slate-500">agora: {sharePercent(a.proportion)}</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                id={`pp-${a.personId}`}
                className="field w-20 text-right"
                inputMode="decimal"
                value={values[a.personId]}
                onChange={(e) => setValues({ ...values, [a.personId]: e.target.value })}
              />
              <span className="text-slate-500">%</span>
            </div>
          </div>
        ))}
        <p className={`text-right text-sm font-semibold ${Math.abs(total - 100) > 0.001 ? 'text-amber-600' : 'text-emerald-600'}`}>
          Total: {total.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
        </p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          {current && (
            <button type="button" className="btn btn-ghost" onClick={automatic}>Voltar ao automático</button>
          )}
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
