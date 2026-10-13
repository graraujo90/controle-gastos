import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { db } from '../db/db'
import { currentMonth } from '../lib/format'
import { Modal } from './Modal'

/** Meses ('AAAA-MM') que têm algum lançamento, para os seletores marcarem onde há dados. */
export function useMonthsWithData(): Set<string> {
  const months = useLiveQuery(() => db.transactions.orderBy('month').uniqueKeys(), [])
  return new Set((months ?? []) as string[])
}

interface Props {
  year: number
  onChange: (year: number) => void
  /** Texto antes do ano, ex.: "Investimentos ·". */
  prefix?: string
}

/** Seletor de ano: setas para o vizinho e, tocando no ano, a lista de anos. */
export function YearPicker({ year, onChange, prefix }: Props) {
  const [open, setOpen] = useState(false)
  const withData = useMonthsWithData()
  const thisYear = Number(currentMonth().slice(0, 4))
  const dataYears = [...withData].map((m) => Number(m.slice(0, 4)))
  // Do primeiro ano com lançamentos (ou três anos atrás) até o ano que vem, sempre incluindo o selecionado.
  const first = Math.min(year, thisYear - 3, ...dataYears)
  const last = Math.max(year, thisYear + 1, ...dataYears)
  const years = Array.from({ length: last - first + 1 }, (_, i) => last - i)

  function pick(next: number) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <button className="btn btn-ghost !p-2" onClick={() => onChange(year - 1)} aria-label="Ano anterior">
        <ChevronLeft size={20} />
      </button>
      <button className="rounded-lg px-3 py-1 text-lg font-semibold hover:bg-slate-100" onClick={() => setOpen(true)} title="Escolher o ano">
        {prefix} {year}
      </button>
      <button className="btn btn-ghost !p-2" onClick={() => onChange(year + 1)} aria-label="Próximo ano">
        <ChevronRight size={20} />
      </button>

      {open && (
        <Modal title="Escolher o ano" onClose={() => setOpen(false)}>
          <div className="grid grid-cols-3 gap-2">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => pick(y)}
                aria-pressed={y === year}
                className={`relative rounded-lg py-3 text-sm font-semibold ${
                  y === year ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {y}
                {dataYears.includes(y) && (
                  <span className={`absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${y === year ? 'bg-white' : 'bg-slate-400'}`} />
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">O ponto marca os anos com lançamentos.</span>
            <button className="btn btn-ghost shrink-0" onClick={() => pick(thisYear)}>Ano atual</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
