import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../../app/AppContext'
import { Modal } from '../../components/Modal'
import { MoneyInput } from '../../components/MoneyInput'
import { CHART_COLOR } from '../../components/typeStyle'
import { db } from '../../db/db'
import { deleteBalance, saveBalance } from '../../db/repo'
import type { BalanceSnapshot, Category } from '../../db/types'
import { position, type Position } from '../../domain/investimentos'
import { invested } from '../../domain/resumo'
import {
  currentMonth, formatBRL, formatCompact, formatPercent, MONTH_SHORT, shortDate, todayISO,
} from '../../lib/format'
import { TransactionRow } from '../lancamentos/TransactionRow'

const AXIS = { fontSize: 11, fill: '#64748b' }
const sum = (list: { amount: number }[]) => list.reduce((total, t) => total + t.amount, 0)
/** Aportes − resgates. */
const net = (list: { amount: number; resgate?: boolean }[]) => list.reduce((total, t) => total + invested(t), 0)
const fullDate = (iso: string) => `${shortDate(iso)}/${iso.slice(0, 4)}`

function Yield({ value, base }: { value: number; base: number }) {
  return (
    <span className={value < 0 ? 'font-medium text-rose-600' : 'font-medium text-emerald-600'}>
      {value >= 0 && '+'}
      {formatBRL(value)}
      {base > 0 && ` (${formatPercent((value / base) * 100)})`}
    </span>
  )
}

/** O que tem saldo próprio: uma subcategoria (ex.: o banco) ou a categoria inteira. */
interface Unit {
  key: string
  category: Category
  sub: Category | null
  history: BalanceSnapshot[]
  position: Position
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')

function BalanceForm({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const { category, sub, history } = unit
  const [amount, setAmount] = useState(Math.max(0, unit.position.saldo))
  const [date, setDate] = useState(todayISO())

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!date) return
    await saveBalance(category.id, sub?.id ?? null, date, amount)
    onClose()
  }

  return (
    <Modal title={`Saldo de ${sub ? `${category.name} · ${sub.name}` : category.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="sd-valor">Saldo atual</label>
          <MoneyInput id="sd-valor" value={amount} onChange={setAmount} autoFocus className="field text-2xl font-semibold" />
          <p className="mt-1 text-xs text-slate-500">
            Informe o valor que aparece hoje no banco ou na corretora. A diferença para o que você aportou é
            mostrada como rendimento.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="sd-data">Data do saldo</label>
          <input id="sd-data" type="date" className="field" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </div>

        {history.length > 0 && (
          <div>
            <span className="label">Saldos já informados</span>
            <ul className="divide-y divide-slate-100 rounded-lg bg-slate-50 px-3 text-sm">
              {history.map((b) => (
                <li key={b.id} className="flex items-center gap-2 py-1">
                  <span className="flex-1 text-slate-600">{fullDate(b.date)}</span>
                  <span className="tabular-nums">{formatBRL(b.amount)}</span>
                  <button
                    type="button"
                    className="btn btn-danger !p-2"
                    onClick={() => deleteBalance(b.id)}
                    aria-label={`Excluir saldo de ${fullDate(b.date)}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex pt-2">
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">Salvar saldo</button>
        </div>
      </form>
    </Modal>
  )
}

export function InvestimentosPage() {
  const { month, openForm } = useApp()
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))
  const [editing, setEditing] = useState<string | null>(null) // chave da unidade em edição

  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? []
  const balances = useLiveQuery(() => db.balances.toArray(), []) ?? []
  const categoryList = useLiveQuery(() => db.categories.toArray(), [])
  const methodList = useLiveQuery(() => db.paymentMethods.toArray(), [])
  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList])
  const methods = useMemo(() => new Map((methodList ?? []).map((m) => [m.id, m])), [methodList])

  const all = transactions.filter((t) => t.type === 'investimento')

  // Cada "unidade" tem saldo próprio: a subcategoria (ex.: o banco) quando a categoria tem subcategorias,
  // senão a categoria inteira. Lançamentos sem subcategoria numa categoria que as tem ficam numa unidade à parte.
  const unitOf = (category: Category, sub: Category | null): Unit => {
    const key = sub?.id ?? null
    const history = balances
      .filter((b) => b.categoryId === category.id && (b.subcategoryId ?? null) === key)
      .sort((a, b) => b.date.localeCompare(a.date))
    const movements = all.filter((t) => t.categoryId === category.id && (t.subcategoryId ?? null) === key)
    return { key: `${category.id}/${key ?? ''}`, category, sub, history, position: position(movements, history) }
  }
  const hasValue = (u: Unit) => u.position.saldo !== 0 || u.history.length > 0 || u.position.aportado !== 0

  const groups = (categoryList ?? [])
    .filter((c) => c.type === 'investimento' && !c.parentId)
    .map((category) => {
      const subs = (categoryList ?? []).filter((c) => c.parentId === category.id).sort(byName)
      const loose = unitOf(category, null)
      const units =
        subs.length === 0
          ? [loose]
          : [...subs.map((s) => unitOf(category, s)).filter((u) => !u.sub!.archived || hasValue(u)), ...(hasValue(loose) ? [loose] : [])]
      return { category, hasSubs: subs.length > 0, units, saldo: units.reduce((total, u) => total + u.position.saldo, 0) }
    })
    // Arquivadas continuam aparecendo enquanto tiverem valor.
    .filter((g) => !g.category.archived || g.units.some(hasValue))
    .sort((a, b) => b.saldo - a.saldo || byName(a.category, b.category))

  const units = groups.flatMap((g) => g.units)
  const totalBalance = units.reduce((total, u) => total + u.position.saldo, 0)
  const known = units.filter((u) => u.position.rendimento !== null)
  const totalYield = known.reduce((total, u) => total + u.position.rendimento!, 0)
  const yieldBase = known.reduce((total, u) => total + (u.position.lastBalance! - u.position.rendimento!), 0)
  const maxBalance = Math.max(1, ...groups.map((g) => g.saldo))
  const editingUnit = units.find((u) => u.key === editing)

  // Aportes do ano selecionado.
  const inYear = (t: { month: string }) => t.month.startsWith(`${year}-`)
  const ofYear = all.filter(inYear)
  const totalYear = net(ofYear)
  const incomeYear = sum(transactions.filter((t) => t.type === 'receita' && inYear(t)))
  // Média sobre os meses já decorridos: o ano inteiro se já passou, até o mês atual se é o corrente.
  const today = currentMonth()
  const thisYear = Number(today.slice(0, 4))
  const elapsed = year < thisYear ? 12 : year > thisYear ? 0 : Number(today.slice(5, 7))
  const byMonth = MONTH_SHORT.map((label, i) => ({
    label,
    aportes: net(ofYear.filter((t) => Number(t.month.slice(5, 7)) === i + 1)),
  }))
  const list = [...ofYear].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Investimentos</h1>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-slate-500">Saldo investido</div>
          <div className="truncate text-xl font-bold tabular-nums text-indigo-600">{formatBRL(totalBalance)}</div>
          <div className="text-xs text-slate-500">soma de todas as categorias</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-slate-500">Rendimento</div>
          <div className="truncate text-xl font-bold tabular-nums">
            {known.length > 0 ? <Yield value={totalYield} base={0} /> : '—'}
          </div>
          <div className="text-xs text-slate-500">
            {known.length > 0 && yieldBase > 0
              ? `${formatPercent((totalYield / yieldBase) * 100)} sobre o aportado`
              : known.length > 0
                ? 'sobre os saldos informados'
                : 'informe um saldo para calcular'}
          </div>
        </div>
      </div>

      <section className="card divide-y divide-slate-100 overflow-hidden">
        <h2 className="px-4 py-3 font-semibold">Saldo por investimento</h2>
        {groups.map(({ category, hasSubs, units: rows, saldo }) => (
          <div key={category.id} className="px-4 py-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: category.color }} />
              <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatBRL(saldo)}</span>
            </div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, (saldo / maxBalance) * 100)}%`, background: category.color }}
              />
            </div>
            <ul className={hasSubs ? 'divide-y divide-slate-100 rounded-lg bg-slate-50 px-3' : ''}>
              {rows.map(({ key, sub, position: p }) => (
                <li key={key} className={hasSubs ? 'py-2' : ''}>
                  {hasSubs && (
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{sub?.name ?? 'Sem subcategoria'}</span>
                      <span className="shrink-0 font-medium tabular-nums">{formatBRL(p.saldo)}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>
                      Aportado {formatBRL(p.aportado)}
                      {p.rendimento !== null ? (
                        <>
                          {' · '}rendimento <Yield value={p.rendimento} base={p.lastBalance! - p.rendimento} />
                          {' · '}saldo de {fullDate(p.lastDate!)}
                        </>
                      ) : (
                        ' · saldo ainda não informado'
                      )}
                    </span>
                    <button className="font-semibold text-indigo-600 hover:underline" onClick={() => setEditing(key)}>
                      Atualizar saldo
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {categoryList && groups.length === 0 && (
          <p className="p-4 text-center text-sm text-slate-500">Nenhuma categoria de investimento cadastrada.</p>
        )}
        <p className="px-4 py-3 text-xs text-slate-500">
          O saldo é o último valor que você informou, mais os aportes e menos os resgates lançados depois dele. Sem
          saldo informado, vale o aportado. "Aportado" é o que você colocou menos o que resgatou. Para separar por
          banco, crie subcategorias em Mais → Categorias.
        </p>
      </section>

      <div className="flex items-center justify-between gap-2 pt-2">
        <button className="btn btn-ghost !p-2" onClick={() => setYear(year - 1)} aria-label="Ano anterior">
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-semibold">Movimentação de {year}</span>
        <button className="btn btn-ghost !p-2" onClick={() => setYear(year + 1)} aria-label="Próximo ano">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {(
          [
            ['Aportes − resgates no ano', formatBRL(totalYear)],
            ['% da receita do ano', incomeYear > 0 ? formatPercent((totalYear / incomeYear) * 100) : '—'],
            ['Média por mês', elapsed > 0 ? formatBRL(Math.round(totalYear / elapsed)) : '—'],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="card p-3 sm:p-4">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="truncate text-sm font-bold tabular-nums sm:text-xl">{value}</div>
          </div>
        ))}
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Aportes menos resgates por mês</h2>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={52} />
              <Tooltip formatter={(value) => formatBRL(Number(value))} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="aportes" name="Aportes − resgates" fill={CHART_COLOR.investimento} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between px-1">
          <h2 className="font-semibold">Lançamentos de {year}</h2>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900" onClick={() => openForm()}>
            Novo lançamento
          </button>
        </div>
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {list.map((t) => (
            <TransactionRow key={t.id} tx={t} categories={categories} methods={methods} />
          ))}
          {list.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Nenhum aporte ou resgate em {year}.</p>}
        </div>
      </section>

      {editingUnit && <BalanceForm unit={editingUnit} onClose={() => setEditing(null)} />}
    </div>
  )
}
