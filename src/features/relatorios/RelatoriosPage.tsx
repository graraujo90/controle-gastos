import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { db } from '../../db/db'
import { shareOverrideKey, type ShareOverride } from '../../domain/pessoas'
import { MonthReport } from './MonthReport'
import { YearReport } from './YearReport'

type View = 'mes' | 'ano'

const SHARE_PREFIX = shareOverrideKey('')

export function RelatoriosPage() {
  const { month } = useApp()
  const [view, setView] = useState<View>('mes')
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))

  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? []
  const categoryList = useLiveQuery(() => db.categories.toArray(), [])
  const methodList = useLiveQuery(() => db.paymentMethods.toArray(), [])
  const peopleList = useLiveQuery(() => db.people.toArray(), [])
  // Ajustes manuais da proporção, por mês (chaves "proporcao:AAAA-MM" em settings).
  const overrideRows = useLiveQuery(() => db.settings.where('key').startsWith(SHARE_PREFIX).toArray(), [])
  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList])
  const methods = useMemo(() => new Map((methodList ?? []).map((m) => [m.id, m])), [methodList])
  const people = useMemo(() => new Map((peopleList ?? []).map((p) => [p.id, p])), [peopleList])
  const overrides = useMemo(
    () => Object.fromEntries((overrideRows ?? []).map((r) => [r.key.slice(SHARE_PREFIX.length), r.value as ShareOverride])),
    [overrideRows],
  )

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
        <MonthReport transactions={transactions} categories={categories} methods={methods} people={people} overrides={overrides} />
      ) : (
        <YearReport transactions={transactions} year={year} setYear={setYear} people={people} overrides={overrides} />
      )}
    </div>
  )
}
