import { useLiveQuery } from 'dexie-react-hooks'
import { CreditCard, Plus, Trash2, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { MoneyInput } from '../../components/MoneyInput'
import { db } from '../../db/db'
import { removeMethod, saveMethod } from '../../db/repo'
import {
  METHOD_KIND_LABEL, METHOD_USE_LABEL, type MethodKind, type MethodUse, type PaymentMethod,
} from '../../db/types'
import { formatBRL } from '../../lib/format'
import { BackLink } from './BackLink'

const KINDS = Object.keys(METHOD_KIND_LABEL) as MethodKind[]
const USES = Object.keys(METHOD_USE_LABEL) as MethodUse[]
const validDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31

function MethodForm({ method, onClose }: { method?: PaymentMethod; onClose: () => void }) {
  const [name, setName] = useState(method?.name ?? '')
  const [kind, setKind] = useState<MethodKind>(method?.kind ?? 'credito')
  const [use, setUse] = useState<MethodUse>(method?.use ?? 'ambos')
  const [limit, setLimit] = useState(method?.limit ?? 0)
  const [closingDay, setClosingDay] = useState(String(method?.closingDay ?? ''))
  const [dueDay, setDueDay] = useState(String(method?.dueDay ?? ''))
  const [error, setError] = useState('')
  const credit = kind === 'credito'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Informe um nome.')
    if (credit && !(validDay(Number(closingDay)) && validDay(Number(dueDay)))) {
      return setError('Informe os dias de fechamento e vencimento (1 a 31).')
    }
    await saveMethod({
      id: method?.id,
      name: name.trim(),
      kind,
      use: credit ? 'pagamento' : use,
      archived: false,
      limit: credit ? limit : undefined,
      closingDay: credit ? Number(closingDay) : undefined,
      dueDay: credit ? Number(dueDay) : undefined,
    })
    onClose()
  }

  async function remove() {
    if (!method || !confirm(`Excluir "${method.name}"?`)) return
    if ((await removeMethod(method.id)) === 'arquivada') {
      alert('Esta forma já tem lançamentos, então foi arquivada: some das listas, mas o histórico é mantido.')
    }
    onClose()
  }

  return (
    <Modal title={method ? 'Editar forma' : 'Nova forma'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="fm-nome">Nome</label>
          <input
            id="fm-nome"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={credit ? 'Ex.: Nubank, Itaú Visa' : 'Ex.: Conta Banco do Brasil'}
            maxLength={40}
            autoFocus={!method}
          />
        </div>
        <div>
          <label className="label" htmlFor="fm-especie">Espécie</label>
          <select id="fm-especie" className="field" value={kind} onChange={(e) => setKind(e.target.value as MethodKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{METHOD_KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>

        {credit ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="fm-fech">Dia de fechamento</label>
                <input id="fm-fech" className="field" type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="fm-venc">Dia de vencimento</label>
                <input id="fm-venc" className="field" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="fm-limite">Limite (opcional)</label>
              <MoneyInput id="fm-limite" value={limit} onChange={setLimit} />
            </div>
          </>
        ) : (
          <div>
            <label className="label" htmlFor="fm-uso">Usada para</label>
            <select id="fm-uso" className="field" value={use} onChange={(e) => setUse(e.target.value as MethodUse)}>
              {USES.map((u) => (
                <option key={u} value={u}>{METHOD_USE_LABEL[u]}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {method && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

export function FormasPage() {
  const [form, setForm] = useState<{ method?: PaymentMethod } | null>(null)
  const methods = (useLiveQuery(() => db.paymentMethods.toArray(), []) ?? [])
    .filter((m) => !m.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const cards = methods.filter((m) => m.kind === 'credito')
  const others = methods.filter((m) => m.kind !== 'credito')

  const list = (title: string, items: PaymentMethod[], empty: string) => (
    <section>
      <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {items.map((m) => (
          <button key={m.id} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setForm({ method: m })}>
            {m.kind === 'credito' ? <CreditCard size={18} className="text-slate-400" /> : <Wallet size={18} className="text-slate-400" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.name}</span>
              <span className="block truncate text-xs text-slate-500">
                {m.kind === 'credito'
                  ? `Fecha dia ${m.closingDay} · vence dia ${m.dueDay}${m.limit ? ` · limite ${formatBRL(m.limit)}` : ''}`
                  : `${METHOD_KIND_LABEL[m.kind]} · ${METHOD_USE_LABEL[m.use]}`}
              </span>
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="p-4 text-center text-sm text-slate-500">{empty}</p>}
      </div>
    </section>
  )

  return (
    <div className="space-y-4">
      <BackLink title="Formas de recebimento e pagamento" />
      {list('Cartões de crédito', cards, 'Nenhum cartão cadastrado.')}
      {list('Outras formas', others, 'Nenhuma forma cadastrada.')}
      <button className="btn btn-primary w-full sm:w-auto" onClick={() => setForm({})}>
        <Plus size={18} /> Nova forma ou cartão
      </button>
      {form && <MethodForm method={form.method} onClose={() => setForm(null)} />}
    </div>
  )
}
