import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { addMonths, currentMonth, MONTH_SHORT, monthLabel } from '../lib/format'
import { Modal } from './Modal'
import { useMonthsWithData } from './YearPicker'

/** Grade de meses de um ano, para pular direto a qualquer mês. */
function MonthGrid({ month, onPick, onClose }: { month: string; onPick: (month: string) => void; onClose: () => void }) {
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))
  const withData = useMonthsWithData()
  const today = currentMonth()

  return (
    <Modal title="Escolher o mês" onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <button className="btn btn-ghost !p-2" onClick={() => setYear(year - 1)} aria-label="Ano anterior">
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-semibold">{year}</span>
        <button className="btn btn-ghost !p-2" onClick={() => setYear(year + 1)} aria-label="Próximo ano">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MONTH_SHORT.map((label, i) => {
          const value = `${year}-${String(i + 1).padStart(2, '0')}`
          const selected = value === month
          return (
            <button
              key={value}
              onClick={() => onPick(value)}
              aria-pressed={selected}
              aria-label={monthLabel(value)}
              className={`relative rounded-lg py-3 text-sm font-semibold capitalize ${
                selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } ${value === today && !selected ? 'ring-2 ring-slate-400' : ''}`}
            >
              {label}
              {withData.has(value) && (
                <span className={`absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${selected ? 'bg-white' : 'bg-slate-400'}`} />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">O ponto marca os meses com lançamentos.</span>
        <button className="btn btn-ghost shrink-0" onClick={() => onPick(today)}>Ir para o mês atual</button>
      </div>
    </Modal>
  )
}

export function MonthPicker() {
  const { month, setMonth } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center justify-between gap-2">
      <button className="btn btn-ghost !p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
        <ChevronLeft size={20} />
      </button>
      <button className="rounded-lg px-3 py-1 text-lg font-semibold hover:bg-slate-100" onClick={() => setOpen(true)} title="Escolher o mês">
        {monthLabel(month)}
      </button>
      <button className="btn btn-ghost !p-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
        <ChevronRight size={20} />
      </button>

      {open && (
        <MonthGrid
          month={month}
          onClose={() => setOpen(false)}
          onPick={(next) => {
            setMonth(next)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}
