import { SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { MonthPicker } from '../../components/MonthPicker'
import { YearPicker } from '../../components/YearPicker'
import { TX_LABEL_PLURAL, TX_TYPES, type Transaction, type TxType } from '../../db/types'
import type { PendingKind } from '../../domain/contas'
import {
  ALL_CREDIT, filterToParams, matchesFilter, NO_SUB, parseFilter, parsePeriod, type FilterContext, type Period,
  type TxFilter,
} from '../../domain/filtro'
import { groupPurchases, type Purchase } from '../../domain/parcelas'
import { summarize } from '../../domain/resumo'
import { dayLabel, formatBRL, monthLabel, monthOf, todayISO } from '../../lib/format'
import { FiltroModal, SITUATION_LABEL } from './FiltroModal'
import { TransactionRow } from './TransactionRow'
import { useMonthData, type ViewBy } from './useMonthData'

const PENDING_LABEL: Record<PendingKind, string> = {
  pagar: 'A pagar',
  receber: 'A receber',
  investir: 'A investir',
}
const PENDING_KINDS = Object.keys(PENDING_LABEL) as PendingKind[]

const VIEW_KEY = 'lancamentos.verPor'

// A forma de listar é preferência de cada aparelho; se o navegador não deixar guardar, vale só nesta sessão.
function storedView(): ViewBy {
  try {
    return localStorage.getItem(VIEW_KEY) === 'compra' ? 'compra' : 'vencimento'
  } catch {
    return 'vencimento'
  }
}

type Item = Purchase<Transaction>

export function LancamentosPage() {
  const { month, setMonth, openForm } = useApp()
  // O filtro e o período ficam no endereço, para as outras telas abrirem a lista já filtrada.
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const filter = useMemo(() => parseFilter(new URLSearchParams(query)), [query])
  const period = parsePeriod(params)
  const [view, setView] = useState<ViewBy>(storedView)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // "Em atraso" olha tudo que está vencido, de qualquer mês; aí período e data da compra não se aplicam.
  const overdue = filter.situacao === 'atrasado'
  const listBy: ViewBy = overdue ? 'vencimento' : view
  const { transactions, categories, methods, loading } = useMonthData(month, listBy, overdue ? 'atrasados' : period)

  const apply = (next: TxFilter, nextPeriod: Period = period) =>
    setParams(filterToParams(next, nextPeriod), { replace: true })

  function changeView(next: ViewBy) {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // sem armazenamento: a escolha vale só enquanto a tela estiver aberta
    }
  }

  const ctx: FilterContext = useMemo(
    () => ({
      today: todayISO(),
      creditIds: new Set([...methods.values()].filter((m) => m.kind === 'credito').map((m) => m.id)),
      categoryNames: new Map([...categories.values()].map((c) => [c.id, c.name])),
    }),
    [categories, methods],
  )

  const dateOf = (t: Transaction) => (listBy === 'compra' ? t.date : t.dueDate)
  const sorted = [...transactions].sort(
    (a, b) => dateOf(b).localeCompare(dateOf(a)) || b.createdAt.localeCompare(a.createdAt),
  )
  // Por data da compra, as parcelas de uma mesma compra viram uma linha só, com o total.
  const items: Item[] =
    listBy === 'compra'
      ? groupPurchases(sorted)
      : sorted.map((tx) => ({ tx, total: tx.amount, count: 1, paidCount: tx.paid ? 1 : 0 }))
  const visible = items.filter((p) =>
    matchesFilter(p.tx, filter, ctx, { amount: p.total, paid: p.paidCount === p.count }),
  )
  const totalsOf = (list: Item[]) => summarize(list.map((p) => ({ type: p.tx.type, amount: p.total, resgate: p.tx.resgate })))
  const totals = totalsOf(visible)

  // Mês: agrupa por dia. Ano e "em atraso": por mês e, dentro dele, por dia.
  const byMonth = period === 'ano' || overdue
  const groups = new Map<string, Map<string, Item[]>>()
  for (const p of visible) {
    const date = dateOf(p.tx)
    const key = byMonth ? monthOf(date) : ''
    const days = groups.get(key) ?? new Map<string, Item[]>()
    days.set(date, [...(days.get(date) ?? []), p])
    groups.set(key, days)
  }

  // Tipo e pendência aparecem nos botões rápidos; os demais critérios viram etiquetas removíveis.
  const name = (id?: string) => (id ? categories.get(id)?.name : undefined) ?? '—'
  const tags: { label: string; without: TxFilter }[] = []
  const tag = (active: unknown, label: string, without: TxFilter) => {
    if (active) tags.push({ label, without })
  }
  tag(filter.situacao, filter.situacao ? SITUATION_LABEL[filter.situacao] : '', { ...filter, situacao: undefined })
  tag(filter.categoria, name(filter.categoria), { ...filter, categoria: undefined, subcategoria: undefined })
  tag(filter.subcategoria, filter.subcategoria === NO_SUB ? 'Sem subcategoria' : name(filter.subcategoria), {
    ...filter,
    subcategoria: undefined,
  })
  tag(filter.forma, filter.forma === ALL_CREDIT ? 'Cartões de crédito' : (methods.get(filter.forma ?? '')?.name ?? '—'), {
    ...filter,
    forma: undefined,
  })
  tag(filter.min !== undefined, `A partir de ${formatBRL(filter.min ?? 0)}`, { ...filter, min: undefined })
  tag(filter.max !== undefined, `Até ${formatBRL(filter.max ?? 0)}`, { ...filter, max: undefined })
  tag(filter.texto, `"${filter.texto}"`, { ...filter, texto: undefined })
  tag(filter.parcelado, 'Parceladas', { ...filter, parcelado: undefined })

  const quick = (changes: Pick<TxFilter, 'tipo' | 'pendencia'>) =>
    // Trocar o botão rápido descarta a situação, que poderia contradizê-lo (ex.: "confirmados" com "a pagar").
    apply({ ...filter, tipo: undefined, pendencia: undefined, situacao: undefined, ...changes })
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
      active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
    }`

  return (
    <div className="space-y-4">
      {overdue ? (
        <div className="card flex items-start gap-3 p-4">
          <p className="flex-1 text-sm text-slate-600">
            <span className="font-semibold text-rose-600">Em atraso.</span> Tudo que está vencido e ainda não foi
            confirmado, de qualquer mês.
          </p>
          <button className="btn btn-ghost !p-2" onClick={() => apply({ ...filter, situacao: undefined })} aria-label="Sair de em atraso">
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/60 p-1">
            {(['mes', 'ano'] as const).map((p) => (
              <button
                key={p}
                onClick={() => apply(filter, p)}
                aria-pressed={period === p}
                className={`rounded-md py-1.5 text-sm font-semibold ${period === p ? 'seg-on' : 'text-slate-600'}`}
              >
                {p === 'mes' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>

          {period === 'mes' ? (
            <MonthPicker />
          ) : (
            <YearPicker year={Number(month.slice(0, 4))} onChange={(y) => setMonth(`${y}-${month.slice(5, 7)}`)} />
          )}

          <div>
            <div className="flex items-center gap-2 text-sm">
              <span className="shrink-0 text-slate-500">Ver por</span>
              <div className="grid flex-1 grid-cols-2 gap-1 rounded-lg bg-slate-200/60 p-1">
                {(['vencimento', 'compra'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => changeView(v)}
                    aria-pressed={view === v}
                    className={`rounded-md py-1.5 font-semibold ${view === v ? 'seg-on' : 'text-slate-600'}`}
                  >
                    {v === 'vencimento' ? 'Vencimento' : 'Data da compra'}
                  </button>
                ))}
              </div>
            </div>
            {view === 'compra' && (
              <p className="mt-1 text-xs text-slate-500">
                Mostra o que foi comprado no período. Os totais do Início, do orçamento e dos relatórios seguem o vencimento.
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className={`${chip(tags.length > 0)} flex items-center gap-1.5`} onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={14} /> Filtros{tags.length > 0 && ` (${tags.length})`}
        </button>
        <button className={chip(!filter.tipo && !filter.pendencia)} onClick={() => quick({})}>Todos</button>
        {TX_TYPES.map((t: TxType) => (
          <button key={t} className={chip(filter.tipo === t && !filter.pendencia)} onClick={() => quick({ tipo: t })}>
            {TX_LABEL_PLURAL[t]}
          </button>
        ))}
        {PENDING_KINDS.map((k) => (
          <button key={k} className={chip(filter.pendencia === k)} onClick={() => apply({ ...filter, tipo: undefined, pendencia: k, situacao: overdue ? 'atrasado' : undefined })}>
            {PENDING_LABEL[k]}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <button
              key={tag.label}
              className="flex items-center gap-1 rounded-full bg-slate-200/70 py-1 pl-3 pr-2 text-xs font-medium text-slate-700"
              onClick={() => apply(tag.without)}
              aria-label={`Remover filtro ${tag.label}`}
            >
              {tag.label} <X size={12} />
            </button>
          ))}
          <button className="text-xs font-semibold text-slate-500 hover:underline" onClick={() => apply({})}>
            Limpar filtros
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <p className="px-1 text-xs text-slate-500">
          {visible.length} {visible.length === 1 ? 'lançamento' : 'lançamentos'}
          {totals.receitas !== 0 && <> · Receitas <span className="font-semibold text-emerald-600">{formatBRL(totals.receitas)}</span></>}
          {totals.despesas !== 0 && <> · Despesas <span className="font-semibold text-rose-600">{formatBRL(totals.despesas)}</span></>}
          {totals.investimentos !== 0 && <> · Investimentos <span className="font-semibold text-indigo-600">{formatBRL(totals.investimentos)}</span></>}
        </p>
      )}

      {!loading && visible.length === 0 && (
        <div className="card p-8 text-center text-slate-500">
          <p>
            {overdue
              ? 'Nada em atraso.'
              : transactions.length > 0
                ? 'Nenhum lançamento com esses filtros.'
                : `Nenhum lançamento neste ${period === 'ano' ? 'ano' : 'mês'}.`}
          </p>
          {transactions.length > 0 && !overdue ? (
            <button className="btn btn-ghost mt-4 ring-1 ring-slate-300" onClick={() => apply({})}>Limpar filtros</button>
          ) : (
            !overdue && <button className="btn btn-primary mt-4" onClick={() => openForm()}>Fazer um lançamento</button>
          )}
        </div>
      )}

      {[...groups].map(([groupMonth, days]) => {
        const list = [...days.values()].flat()
        const result = totalsOf(list).resultado
        return (
          <div key={groupMonth} className="space-y-4">
            {byMonth && (
              <div className="flex items-baseline justify-between border-b border-slate-200 px-1 pb-1">
                <h2 className="font-semibold">{monthLabel(groupMonth)}</h2>
                <span className="text-sm text-slate-500">
                  {list.length} · <span className={`font-semibold tabular-nums ${result < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatBRL(result)}</span>
                </span>
              </div>
            )}
            {[...days].map(([date, dayItems]) => (
              <section key={date}>
                <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(date)}</h3>
                <div className="card divide-y divide-slate-100 overflow-hidden">
                  {dayItems.map((p) => (
                    <TransactionRow key={p.tx.id} tx={p.tx} categories={categories} methods={methods} view={listBy} purchase={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      })}

      {filtersOpen && (
        <FiltroModal
          filter={filter}
          categories={categories}
          methods={methods}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            apply(next)
            setFiltersOpen(false)
          }}
        />
      )}
    </div>
  )
}
