import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { addMonths, currentMonth, monthLabel } from '../lib/format'

export function MonthPicker() {
  const { month, setMonth } = useApp()
  return (
    <div className="flex items-center justify-between gap-2">
      <button className="btn btn-ghost !p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
        <ChevronLeft size={20} />
      </button>
      <button
        className="text-lg font-semibold"
        onClick={() => setMonth(currentMonth())}
        title="Voltar para o mês atual"
      >
        {monthLabel(month)}
      </button>
      <button className="btn btn-ghost !p-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
