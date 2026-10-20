import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Person } from '../db/types'
import { lancamentosLink, type Period } from '../domain/filtro'
import { FAMILY, type PeopleSummary } from '../domain/pessoas'
import { formatBRL } from '../lib/format'

interface Props {
  summary: PeopleSummary
  people: Map<string, Person>
  /** Período dos links para a lista (o mês ou o ano em exibição). */
  period: Period
  /** Relatórios: conta de cada adulto linha a linha. Início: só o saldo. */
  detailed?: boolean
  /** Ao abrir a lista: no relatório anual, leva o seletor para o ano em exibição. */
  onNavigate?: () => void
  /** Botão "Ajustar proporção" (só no mês). */
  onAdjust?: () => void
}

export const sharePercent = (proportion: number) =>
  `${(proportion * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

const SOURCE_TEXT: Record<PeopleSummary['source'], string> = {
  receitas: 'na proporção das receitas',
  ajuste: 'pela proporção ajustada',
  iguais: 'em partes iguais (sem receita)',
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'border-t border-slate-100 pt-1 font-semibold' : 'text-slate-600'}`}>
      <span className="min-w-0 truncate">{label}</span>
      <span className={`shrink-0 whitespace-nowrap tabular-nums ${strong ? (value < 0 ? 'text-rose-600' : 'text-emerald-600') : ''}`}>
        {formatBRL(value || 0)}
      </span>
    </div>
  )
}

/**
 * Saldo parcial de cada adulto (o que é dele menos a sua parte nas despesas da família) e o que é de cada
 * dependente. Cada nome abre a lista de lançamentos daquela pessoa.
 */
export function PeopleBreakdown({ summary, people, period, detailed = false, onNavigate, onAdjust }: Props) {
  const name = (id: string) => people.get(id)?.name ?? '—'
  const { family } = summary
  const byName = (a: { personId: string }, b: { personId: string }) => name(a.personId).localeCompare(name(b.personId), 'pt-BR')
  const adults = [...summary.adults].sort(byName)
  const dependents = [...summary.dependents].sort(byName)
  if (adults.length === 0 && dependents.length === 0) return null

  return (
    <section className="card overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-4">
        <h2 className="font-semibold">Por pessoa</h2>
        {onAdjust && (
          <button className="shrink-0 text-xs font-semibold text-slate-500 hover:underline" onClick={onAdjust}>
            Ajustar proporção
          </button>
        )}
      </div>
      <p className="px-4 text-xs text-slate-500">
        Despesas da família ({formatBRL(family.net)}) divididas {SOURCE_TEXT[summary.source]}.
      </p>

      <div className="mt-2 divide-y divide-slate-100">
        {adults.map((a) =>
          detailed ? (
            <div key={a.personId} className="space-y-1 px-4 py-3 text-sm">
              <Link to={lancamentosLink({ pessoa: a.personId }, period)} onClick={onNavigate} className="flex items-center gap-1 font-semibold hover:underline">
                {name(a.personId)} <ChevronRight size={14} className="text-slate-400" />
              </Link>
              <Line label="Receitas" value={a.receitas} />
              <Line label="Gastos próprios" value={-a.despesas} />
              {a.investimentos !== 0 && <Line label="Investimentos" value={-a.investimentos} />}
              <Line label={`Parte na família (${sharePercent(a.proportion)})`} value={-a.familyPart} />
              <Line label="Saldo" value={a.saldo} strong />
            </div>
          ) : (
            <Link
              key={a.personId}
              to={lancamentosLink({ pessoa: a.personId }, period)}
              onClick={onNavigate}
              className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{name(a.personId)}</span>
                <span className="block truncate text-xs text-slate-500">
                  recebeu {formatBRL(a.receitas)} · {sharePercent(a.proportion)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[11px] text-slate-500">saldo</span>
                <span className={`block whitespace-nowrap font-semibold tabular-nums ${a.saldo < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatBRL(a.saldo)}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" />
            </Link>
          ),
        )}

        {dependents.map((d) => (
          <Link
            key={d.personId}
            to={lancamentosLink({ pessoa: d.personId }, period)}
            onClick={onNavigate}
            className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{name(d.personId)}</span>
              <span className="block truncate text-xs text-slate-500">
                dependente · gastos{d.investimentos !== 0 && ` · investido ${formatBRL(d.investimentos)}`}
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-slate-900">{formatBRL(d.despesas)}</span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </Link>
        ))}

        {detailed && (
          <div className="space-y-1 px-4 py-3 text-sm">
            <Link to={lancamentosLink({ pessoa: FAMILY }, period)} onClick={onNavigate} className="flex items-center gap-1 font-semibold hover:underline">
              Família <ChevronRight size={14} className="text-slate-400" />
            </Link>
            <Line label="Despesas (inclui dependentes)" value={family.despesas} />
            {family.investimentos !== 0 && <Line label="Investimentos" value={family.investimentos} />}
            {family.receitas !== 0 && <Line label="Receitas da família" value={-family.receitas} />}
            <Line label="A dividir entre os adultos" value={family.net} />
          </div>
        )}
      </div>
    </section>
  )
}
