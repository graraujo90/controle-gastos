import { useLiveQuery } from 'dexie-react-hooks'
import { Repeat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryIcon } from '../../components/CategoryIcon'
import { TYPE_STYLE } from '../../components/typeStyle'
import { db } from '../../db/db'
import { endRecurrence } from '../../db/repo'
import type { Recurrence } from '../../db/types'
import { lancamentosLink } from '../../domain/filtro'
import { FREQUENCY_LABEL } from '../../domain/recorrencia'
import { formatBRL, shortDate, todayISO } from '../../lib/format'
import { BackLink } from './BackLink'

const fullDate = (iso: string) => `${shortDate(iso)}/${iso.slice(0, 4)}`

export function RecorrenciasPage() {
  const rules = useLiveQuery(() => db.recurrences.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const methods = useLiveQuery(() => db.paymentMethods.toArray(), []) ?? []
  // Só as ocorrências de recorrências, para achar a próxima data e quantas já passaram.
  const occurrences = useLiveQuery(() => db.transactions.where('recurrenceId').above('').toArray(), []) ?? []

  const today = todayISO()
  const category = (id: string | null) => categories.find((c) => c.id === id)
  const active = (rules ?? []).filter((r) => !r.ended).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const endedCount = (rules ?? []).length - active.length

  async function end(rule: Recurrence, name: string) {
    if (!confirm(`Encerrar a repetição de "${name}"?\n\nOs próximos lançamentos ainda não confirmados são apagados. O que já passou continua.`)) return
    await endRecurrence(rule.id)
  }

  return (
    <div className="space-y-4">
      <BackLink title="Recorrências" />
      <p className="text-sm text-slate-500">
        Lançamentos que se repetem. Para criar um, escolha "Repetir" ao fazer um lançamento. Para mudar o valor daqui
        em diante, abra um dos lançamentos e salve com "Este e os próximos".
      </p>

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {active.map((rule) => {
          const mine = occurrences.filter((t) => t.recurrenceId === rule.id)
          const next = mine.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
          const sub = category(rule.subcategoryId)
          const top = category(rule.categoryId)
          const name = rule.description || sub?.name || top?.name || '—'
          const done = mine.filter((t) => t.date < today).length
          return (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
              <CategoryIcon category={sub ?? top} parent={sub ? top : undefined} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{name}</div>
                <div className="truncate text-xs text-slate-500">
                  {FREQUENCY_LABEL[rule.frequency]} · {methods.find((m) => m.id === rule.paymentMethodId)?.name ?? '—'}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {rule.count ? `${Math.min(done, rule.count)} de ${rule.count} já passaram` : 'Sem data para acabar'}
                  {next ? ` · próximo em ${fullDate(next.date)}` : ' · sem próximos lançamentos'}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`font-semibold tabular-nums ${TYPE_STYLE[rule.type].text}`}>{formatBRL(rule.amount)}</div>
                <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => end(rule, name)}>
                  Encerrar
                </button>
              </div>
            </div>
          )
        })}
        {rules && active.length === 0 && (
          <p className="flex flex-col items-center gap-2 p-8 text-center text-sm text-slate-500">
            <Repeat size={24} className="text-slate-300" />
            Nenhuma recorrência ativa.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to={lancamentosLink({ recorrente: true }, 'ano')} className="font-medium text-slate-600 hover:underline">
          Ver os lançamentos recorrentes do ano
        </Link>
        {endedCount > 0 && (
          <span className="text-xs text-slate-500">
            {endedCount} {endedCount === 1 ? 'recorrência encerrada' : 'recorrências encerradas'}
          </span>
        )}
      </div>
    </div>
  )
}
