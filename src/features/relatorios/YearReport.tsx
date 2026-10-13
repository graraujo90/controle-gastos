import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { MoneyInput } from '../../components/MoneyInput'
import { YearPicker } from '../../components/YearPicker'
import { CHART_THEME } from '../../components/typeStyle'
import { db } from '../../db/db'
import { OPENING_BALANCE, setSetting } from '../../db/repo'
import type { Transaction } from '../../db/types'
import { annualSummary } from '../../domain/anual'
import { lancamentosLink } from '../../domain/filtro'
import { currentMonth, formatBRL, formatCompact, formatPercent, monthShort } from '../../lib/format'
import { useTheme } from '../../lib/theme'

interface Props {
  transactions: Transaction[]
  year: number
  setYear: (year: number) => void
}


const legendText = (value: string) => <span className="text-xs text-slate-600">{value}</span>
const money = (value: unknown) => formatBRL(Number(value))

export function YearReport({ transactions, year, setYear }: Props) {
  const { month, setMonth } = useApp()
  const chart = CHART_THEME[useTheme()]
  const AXIS = { fontSize: 11, fill: chart.tick }
  const tooltip = { contentStyle: { ...chart.tooltip, border: `1px solid ${chart.tooltip.border}`, borderRadius: 8 }, itemStyle: { color: chart.tooltip.color } }
  const opening = useLiveQuery(() => db.settings.get(OPENING_BALANCE), [])
  const openingBalance = typeof opening?.value === 'number' ? opening.value : 0

  const rows = annualSummary(transactions, year, openingBalance)
  const thisMonth = currentMonth()
  // As linhas de acumulado param no mês atual ou no último mês com lançamentos, o que vier depois;
  // sem isso seguiriam retas pelos meses futuros, parecendo um valor real.
  const lastWithData = [...rows].reverse().find((r) => r.receitas || r.despesas || r.investimentos)?.month ?? ''
  const cutoff = lastWithData > thisMonth ? lastWithData : thisMonth
  const data = rows.map((r) => ({
    ...r,
    label: monthShort(r.month),
    acumuladoAno: r.month <= cutoff ? r.acumuladoAno : null,
    aportadoAno: r.month <= cutoff ? r.aportadoAno : null,
  }))
  const total = rows.reduce(
    (sum, r) => ({
      receitas: sum.receitas + r.receitas,
      despesas: sum.despesas + r.despesas,
      investimentos: sum.investimentos + r.investimentos,
    }),
    { receitas: 0, despesas: 0, investimentos: 0 },
  )
  const last = rows[rows.length - 1]
  const invested =
    last.percentualInvestido === null ? 'sem receita no ano' : `${formatPercent(last.percentualInvestido)} da receita`

  return (
    <div className="space-y-4">
      <YearPicker year={year} onChange={setYear} />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {(
          [
            ['Resultado do ano', last.acumuladoAno, last.acumuladoAno < 0 ? 'text-rose-600' : 'text-slate-900', '', undefined],
            ['Receitas', total.receitas, 'text-emerald-600', '', 'receita'],
            ['Despesas', total.despesas, 'text-rose-600', '', 'despesa'],
            ['Investimentos no ano', total.investimentos, 'text-indigo-600', invested, 'investimento'],
          ] as const
        ).map(([label, value, color, hint, type]) => {
          const content = (
            <>
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className={`truncate text-xl font-bold tabular-nums ${color}`}>{formatBRL(value)}</div>
              {hint && <div className="text-xs text-slate-500">{hint}</div>}
            </>
          )
          // Os indicadores por tipo abrem os lançamentos do ano inteiro; a lista usa o ano do mês em exibição.
          return type ? (
            <Link
              key={label}
              to={lancamentosLink({ tipo: type }, 'ano')}
              onClick={() => setMonth(`${year}-${month.slice(5, 7)}`)}
              className="card block p-4 hover:bg-slate-50"
            >
              {content}
            </Link>
          ) : (
            <div key={label} className="card p-4">{content}</div>
          )
        })}
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Receitas, despesas e investimentos por mês</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="20%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: chart.axis }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={52} />
              <Tooltip formatter={money} cursor={{ fill: chart.cursor }} {...tooltip} />
              <Legend iconType="circle" iconSize={8} formatter={legendText} itemSorter={null} />
              <Bar dataKey="receitas" name="Receitas" fill={chart.series.receita} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
              <Bar dataKey="despesas" name="Despesas" fill={chart.series.despesa} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
              <Bar dataKey="investimentos" name="Investimentos" fill={chart.series.investimento} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Acumulado no ano</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: chart.axis }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={52} />
              <ReferenceLine y={0} stroke={chart.axis} />
              <Tooltip formatter={money} {...tooltip} />
              <Legend iconType="circle" iconSize={8} formatter={legendText} itemSorter={null} />
              <Line dataKey="acumuladoAno" name="Resultado acumulado" stroke={chart.result} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              <Line dataKey="aportadoAno" name="Aportado no ano" stroke={chart.series.investimento} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, strokeDasharray: '0' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 p-4">
          <h2 className="font-semibold">Resumo mês a mês</h2>
          <div className="w-44">
            <label className="label !text-xs" htmlFor="saldo-inicial">Saldo antes do 1º lançamento</label>
            <MoneyInput
              id="saldo-inicial"
              className="field !py-1 text-sm"
              value={openingBalance}
              onChange={(cents) => setSetting(OPENING_BALANCE, cents)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-right text-sm tabular-nums">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-3 py-2 text-left">Mês</th>
                <th className="px-3 py-2">Saldo inicial</th>
                <th className="px-3 py-2">Receitas</th>
                <th className="px-3 py-2">Despesas</th>
                <th className="px-3 py-2">Investimentos</th>
                <th className="px-3 py-2">Resultado</th>
                <th className="px-3 py-2">Acumulado no ano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.month} className={r.month === thisMonth ? 'bg-slate-50 font-medium' : r.month > thisMonth ? 'text-slate-400' : ''}>
                  <td className="px-3 py-2 text-left capitalize">{monthShort(r.month)}</td>
                  <td className="px-3 py-2">{formatBRL(r.saldoInicial)}</td>
                  <td className="px-3 py-2">{formatBRL(r.receitas)}</td>
                  <td className="px-3 py-2">{formatBRL(r.despesas)}</td>
                  <td className="px-3 py-2">{formatBRL(r.investimentos)}</td>
                  <td className={`px-3 py-2 font-semibold ${r.resultado < 0 ? 'text-rose-600' : ''}`}>{formatBRL(r.resultado)}</td>
                  <td className={`px-3 py-2 ${r.acumuladoAno < 0 ? 'text-rose-600' : ''}`}>{formatBRL(r.acumuladoAno)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-left">Total</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2">{formatBRL(total.receitas)}</td>
                <td className="px-3 py-2">{formatBRL(total.despesas)}</td>
                <td className="px-3 py-2">{formatBRL(total.investimentos)}</td>
                <td className={`px-3 py-2 ${last.acumuladoAno < 0 ? 'text-rose-600' : ''}`}>{formatBRL(last.acumuladoAno)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="p-4 text-xs text-slate-500">
          Meses futuros (em cinza) mostram o que já está lançado, como parcelas. O valor aportado em investimentos não
          inclui rentabilidade, então não representa o valor efetivamente guardado.
        </p>
      </section>
    </div>
  )
}
