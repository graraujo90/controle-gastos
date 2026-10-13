import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useApp } from '../../app/AppContext'
import { Modal } from '../../components/Modal'
import { MoneyInput } from '../../components/MoneyInput'
import { TYPE_STYLE } from '../../components/typeStyle'
import { db } from '../../db/db'
import { deleteInstallmentGroup, deleteTransaction, saveInstallments, saveTransaction } from '../../db/repo'
import { TX_LABEL, TX_TYPES, type PaymentMethod, type Transaction, type TxType } from '../../db/types'
import { dueDateFor, isCredit } from '../../domain/fatura'
import { planInstallments, type InstallmentMode } from '../../domain/parcelas'
import { confirmWords } from '../../lib/confirmacao'
import { addMonthsToDate, formatBRL, monthLabel, monthOf, shortDate, todayISO } from '../../lib/format'

interface Props {
  tx?: Transaction
  onClose: () => void
}

const MAX_INSTALLMENTS = 72

// Receita e resgate são dinheiro entrando; cartão de crédito só em despesas (é o único tipo que entra em fatura).
const usable = (m: PaymentMethod, type: TxType, inflow: boolean) =>
  inflow ? m.use !== 'pagamento' : m.use !== 'recebimento' && (type === 'despesa' || m.kind !== 'credito')

export function TransactionForm({ tx, onClose }: Props) {
  const [type, setType] = useState<TxType>(tx?.type ?? 'despesa')
  const [amount, setAmount] = useState(tx?.amount ?? 0)
  const [date, setDate] = useState(tx?.date ?? todayISO())
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '')
  const [subcategoryId, setSubcategoryId] = useState(tx?.subcategoryId ?? '')
  const [methodId, setMethodId] = useState(tx?.paymentMethodId ?? '')
  const [description, setDescription] = useState(tx?.description ?? '')
  const [resgateOn, setResgateOn] = useState(tx?.resgate ?? false)
  // null = segue o padrão (vencimento igual à data; paga se já venceu e não é crédito).
  const [dueManual, setDueManual] = useState<string | null>(tx && tx.dueDate !== tx.date ? tx.dueDate : null)
  const [paidManual, setPaidManual] = useState<boolean | null>(tx ? tx.paid : null)
  const [count, setCount] = useState('1')
  const [mode, setMode] = useState<InstallmentMode>('total')
  const [error, setError] = useState('')

  const { setMonth } = useApp()
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')
  const categories = (useLiveQuery(() => db.categories.toArray(), []) ?? []).sort(byName)
  const methods = (useLiveQuery(() => db.paymentMethods.toArray(), []) ?? []).sort(byName)

  // Itens arquivados só aparecem se já estiverem selecionados no lançamento em edição.
  const topCategories = categories.filter(
    (c) => c.type === type && !c.parentId && (!c.archived || c.id === categoryId),
  )
  const subcategories = categories.filter(
    (c) => c.parentId === categoryId && categoryId && (!c.archived || c.id === subcategoryId),
  )
  const resgate = type === 'investimento' && resgateOn
  const inflow = type === 'receita' || resgate
  const methodOptions = methods.filter((m) => usable(m, type, inflow) && (!m.archived || m.id === methodId))
  const method = methods.find((m) => m.id === methodId)

  const expense = type === 'despesa'
  const credit = expense && isCredit(method)
  // No crédito o vencimento é o da fatura; ao editar a parcela N, o da N-ésima fatura.
  const dueDate = !expense
    ? date
    : credit
      ? addMonthsToDate(dueDateFor(date, method), (tx?.installmentNumber ?? 1) - 1)
      : (dueManual ?? date)
  // Confirmado por padrão quando a data já chegou. Fatura de cartão é marcada como paga inteira,
  // pela lista; aqui só vale o padrão.
  const paid = credit ? (tx?.paid ?? dueDate < todayISO()) : (paidManual ?? dueDate <= todayISO())
  const installments = expense && !tx ? Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(Number(count)) || 1)) : 1
  const plan = installments > 1 && date ? planInstallments(amount, mode, installments, dueDate) : null

  function changeType(next: TxType) {
    setType(next)
    setCategoryId('')
    setSubcategoryId('')
    if (method && !usable(method, next, next === 'receita' || (next === 'investimento' && resgateOn))) setMethodId('')
  }

  function changeResgate(next: boolean) {
    setResgateOn(next)
    if (method && !usable(method, type, next)) setMethodId('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (amount <= 0) return setError('Informe um valor maior que zero.')
    if (!date || !dueDate) return setError('Informe a data e o vencimento.')
    if (!categoryId) return setError('Escolha uma categoria.')
    if (!methodId) return setError(`Escolha a forma de ${inflow ? 'recebimento' : 'pagamento'}.`)
    const base = {
      type,
      date,
      categoryId,
      subcategoryId: subcategoryId || null,
      paymentMethodId: methodId,
      description: description.trim(),
      paid,
      resgate,
    }
    if (plan) await saveInstallments(base, plan)
    else await saveTransaction({ ...base, id: tx?.id, amount, dueDate })
    // Leva a tela para o mês em que o lançamento entrou (o do vencimento).
    setMonth(monthOf(dueDate))
    onClose()
  }

  async function remove(all: boolean) {
    if (!tx) return
    if (all && tx.installmentGroupId) {
      if (!confirm(`Excluir todas as ${tx.installmentTotal} parcelas desta compra?`)) return
      await deleteInstallmentGroup(tx.installmentGroupId)
    } else {
      if (!confirm('Excluir este lançamento?')) return
      await deleteTransaction(tx.id)
    }
    onClose()
  }

  return (
    <Modal title={tx ? 'Editar lançamento' : 'Novo lançamento'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {TX_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={`rounded-md py-2 text-sm font-semibold ${
                type === t ? `${TYPE_STYLE[t].solid} text-white` : 'text-slate-600'
              }`}
            >
              {TX_LABEL[t]}
            </button>
          ))}
        </div>

        {type === 'investimento' && (
          <div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {([false, true] as const).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => changeResgate(value)}
                  className={`rounded-md py-1.5 text-sm font-semibold ${
                    resgateOn === value ? 'seg-on' : 'text-slate-500'
                  }`}
                >
                  {value ? 'Resgate' : 'Aporte'}
                </button>
              ))}
            </div>
            {resgate && (
              <p className="mt-1 text-xs text-slate-500">
                O valor resgatado volta para o resultado do mês e abate do total investido. Lance à parte a despesa
                que ele cobriu.
              </p>
            )}
          </div>
        )}

        {tx?.installmentTotal && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            Parcela {tx.installmentNumber} de {tx.installmentTotal}. As alterações valem só para esta parcela.
          </p>
        )}

        <div>
          <label className="label" htmlFor="tx-valor">
            {plan ? (mode === 'total' ? 'Valor total da compra' : 'Valor de cada parcela') : 'Valor'}
          </label>
          <MoneyInput
            id="tx-valor"
            value={amount}
            onChange={setAmount}
            autoFocus={!tx}
            className={`field text-2xl font-semibold ${TYPE_STYLE[type].text}`}
          />
        </div>

        <div>
          <label className="label" htmlFor="tx-data">{expense ? 'Data da compra' : 'Data'}</label>
          <input id="tx-data" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <label className="label" htmlFor="tx-categoria">Categoria</label>
          <select
            id="tx-categoria"
            className="field"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setSubcategoryId('')
            }}
          >
            <option value="">Selecione…</option>
            {topCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {subcategories.length > 0 && (
          <div>
            <label className="label" htmlFor="tx-sub">Subcategoria (opcional)</label>
            <select id="tx-sub" className="field" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
              <option value="">Nenhuma</option>
              {subcategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="tx-forma">
            Forma de {inflow ? 'recebimento' : 'pagamento'}
          </label>
          <select id="tx-forma" className="field" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            <option value="">Selecione…</option>
            {methodOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {credit && date && (
            <p className="mt-1 text-xs text-slate-500">
              Entra na fatura de {monthLabel(monthOf(dueDate)).toLowerCase()}, com vencimento em {shortDate(dueDate)}.
            </p>
          )}
        </div>

        {expense && !tx && (
          <div className="space-y-2">
            <div className="flex items-end gap-3">
              <div className="w-28 shrink-0">
                <label className="label" htmlFor="tx-parcelas">Parcelas</label>
                <input
                  id="tx-parcelas"
                  type="number"
                  min={1}
                  max={MAX_INSTALLMENTS}
                  className="field"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              {installments > 1 && (
                <div className="min-w-0 flex-1">
                  <span className="label">O valor informado é</span>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    {(['total', 'parcela'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`rounded-md py-1.5 text-sm font-semibold ${
                          mode === m ? 'seg-on' : 'text-slate-500'
                        }`}
                      >
                        {m === 'total' ? 'O total' : 'Da parcela'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {plan && amount > 0 && (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
                {installments}x de <strong>{formatBRL(plan[1].amount)}</strong>
                {plan[0].amount !== plan[1].amount && <> (1ª de {formatBRL(plan[0].amount)})</>}
                {' · '}total <strong>{formatBRL(plan.reduce((sum, p) => sum + p.amount, 0))}</strong>
                {' · '}de {shortDate(plan[0].dueDate)}/{plan[0].dueDate.slice(0, 4)} a{' '}
                {shortDate(plan[plan.length - 1].dueDate)}/{plan[plan.length - 1].dueDate.slice(0, 4)}
              </p>
            )}
          </div>
        )}

        {expense && !credit && (
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="tx-venc">{plan ? 'Vencimento da 1ª parcela' : 'Vencimento'}</label>
              <input
                id="tx-venc"
                type="date"
                className="field"
                value={dueDate}
                onChange={(e) => setDueManual(e.target.value)}
              />
            </div>
            <label className="flex h-[42px] shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-5 w-5 accent-emerald-600"
                checked={paid}
                onChange={(e) => setPaidManual(e.target.checked)}
              />
              {plan ? '1ª parcela já paga' : 'Já paga'}
            </label>
          </div>
        )}

        {!expense && (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-5 w-5 accent-emerald-600"
              checked={paid}
              onChange={(e) => setPaidManual(e.target.checked)}
            />
            {confirmWords({ type, resgate }).checkbox}
          </label>
        )}

        <div>
          <label className="label" htmlFor="tx-desc">Descrição (opcional)</label>
          <input
            id="tx-desc"
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={80}
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-2">
          {tx && (
            <button type="button" className="btn btn-danger" onClick={() => remove(false)}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          {tx?.installmentGroupId && (
            <button type="button" className="btn btn-danger" onClick={() => remove(true)}>
              Excluir todas as parcelas
            </button>
          )}
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
