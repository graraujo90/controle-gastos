import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { db } from '../../db/db'
import { MonthReport } from './MonthReport'
import { YearReport } from './YearReport'

type View = 'mes' | 'ano'

export function RelatoriosPage() {
  const { month } = useApp()
  const [view, setView] = useState<View>('mes')
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))

  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? []
  const categoryList = useLiveQuery(() => db.categories.toArray(), [])
  const methodList = useLiveQuery(() => db.paymentMethods.toArray(), [])
  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList])
  const methods = useMemo(() => new Map((methodList ?? []).map((m) => [m.id, m])), [methodList])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/60 p-1">
        {(['mes', 'ano'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md py-2 text-sm font-semibold ${view === v ? 'seg-on' : 'text-slate-600'}`}
          >
            {v === 'mes' ? 'Mês' : 'Ano'}
          </button>
        ))}
      </div>

      {view === 'mes' ? (
        <MonthReport transactions={transactions} categories={categories} methods={methods} />
      ) : (
        <YearReport transactions={transactions} year={year} setYear={setYear} />
      )}
    </div>
  )
}
