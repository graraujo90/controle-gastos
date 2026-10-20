import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, ChevronRight, Plus, Split, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApp } from '../../app/AppContext'
import { ConfirmDialog, type ConfirmOption } from '../../components/ConfirmDialog'
import { Modal } from '../../components/Modal'
import { MoneyInput } from '../../components/MoneyInput'
import { TYPE_STYLE } from '../../components/typeStyle'
import { db } from '../../db/db'
import {
  deleteInstallments, deleteSplit, deleteTransaction, endRecurrence, saveCategory, saveInstallments, saveRecurring,
  saveSplit, saveTransaction, shiftInstallments, updateFollowing, updateInstallmentGroup,
} from '../../db/repo'
import { TX_LABEL, TX_TYPES, type PaymentMethod, type Transaction, type TxType } from '../../db/types'
import { splitError } from '../../domain/divisao'
import { dueDateFor, isCredit, MAX_INVOICE_SHIFT } from '../../domain/fatura'
import { planInstallments, type InstallmentMode } from '../../domain/parcelas'
import {
  FREQUENCIES, FREQUENCY_LABEL, MAX_COUNT, missingOccurrences, occurrenceDate, type Frequency,
} from '../../domain/recorrencia'
import { confirmWords } from '../../lib/confirmacao'
import { addMonthsToDate, formatBRL, monthLabel, monthOf, shortDate, todayISO } from '../../lib/format'
import { DivisaoEditor, newRow, type SplitRow } from './DivisaoEditor'

interface Props {
  tx?: Transaction
  onClose: () => void
}

const MAX_INSTALLMENTS = 72

type Scope = 'este' | 'proximos' | 'todas'

const fullDate = (iso: string) => `${shortDate(iso)}/${iso.slice(0, 4)}`

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
  const [estornoOn, setEstornoOn] = useState(tx?.estorno ?? false)
  // Conta dividida: o valor é o cheio (fatura); a minha parte é o que conta no orçamento.
  const [splitOn, setSplitOn] = useState(tx?.myShare !== undefined)
  const [myShare, setMyShare] = useState(tx?.myShare ?? 0)
  // null = segue o padrão (vencimento igual à data; paga se já venceu e não é crédito).
  const [dueManual, setDueManual] = useState<string | null>(tx && tx.dueDate !== tx.date ? tx.dueDate : null)
  const [paidManual, setPaidManual] = useState<boolean | null>(tx ? tx.paid : null)
  // Cartão: compra movida para a fatura anterior ou seguinte (o banco fechou num dia diferente).
  const [shift, setShift] = useState(tx?.invoiceShift ?? 0)
  const [count, setCount] = useState('1')
  const [mode, setMode] = useState<InstallmentMode>('total')
  // Repetição: '' = não repete (padrão). Só ao criar; ao editar, vale a escolha de alcance abaixo.
  const [repeat, setRepeat] = useState<Frequency | ''>('')
  const [endless, setEndless] = useState(false)
  const [times, setTimes] = useState('12')
  // Ao editar um lançamento de uma compra parcelada ou de uma recorrência: só ele, ele e os próximos, ou todos.
  const [scope, setScope] = useState<Scope>('este')
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Criar subcategoria sem sair do lançamento.
  const [newSub, setNewSub] = useState<string | null>(null)
  // Compra dividida em categorias: null = uma categoria só.
  const [parts, setParts] = useState<SplitRow[] | null>(null)
  const [error, setError] = useState('')

  const { setMonth } = useApp()
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')
  const categories = (useLiveQuery(() => db.categories.toArray(), []) ?? []).sort(byName)
  const methods = (useLiveQuery(() => db.paymentMethods.toArray(), []) ?? []).sort(byName)

  // Abrir uma parte de uma compra dividida edita a divisão inteira: carrega as partes uma vez.
  const savedParts = useLiveQuery<Transaction[] | null>(
    () => (tx?.splitGroupId ? db.transactions.where('splitGroupId').equals(tx.splitGroupId).toArray() : null),
    [tx?.splitGroupId],
  )
  const partsLoaded = useRef(false)
  useEffect(() => {
    if (!savedParts || partsLoaded.current) return
    partsLoaded.current = true
    // Maior parte primeiro: as partes nascem juntas, então a data de criação não dá uma ordem estável.
    const ordered = [...savedParts].sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
    setParts(ordered.map((t) => newRow({ id: t.id, categoryId: t.categoryId, subcategoryId: t.subcategoryId, amount: t.amount })))
    setAmount(ordered.reduce((sum, t) => sum + t.amount, 0))
  }, [savedParts])

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
  const estorno = expense && estornoOn
  const splitting = parts !== null
  const repeating = !tx && !estorno && !splitting && repeat !== ''
  const share = expense && splitOn && !splitting ? myShare : undefined
  // Na recorrência o ajuste vai para a regra: todas as ocorrências caem na fatura movida.
  const invoiceShift = credit ? shift : 0
  // No crédito o vencimento é o da fatura; ao editar a parcela N, o da N-ésima fatura.
  const dueDate = !expense
    ? date
    : credit
      ? addMonthsToDate(dueDateFor(date, method, invoiceShift), (tx?.installmentNumber ?? 1) - 1)
      : (dueManual ?? date)
  // Confirmado por padrão quando a data já chegou. Fatura de cartão é marcada como paga inteira,
  // pela lista; aqui só vale o padrão.
  const paid = credit ? (tx?.paid ?? dueDate < todayISO()) : (paidManual ?? dueDate <= todayISO())
  // Repetição e parcelamento não se combinam: escolher um esconde o outro.
  const installments =
    expense && !tx && !repeating && !estorno && !splitting ? Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(Number(count)) || 1)) : 1
  const repeatCount = endless ? undefined : Math.max(2, Math.min(MAX_COUNT, Math.floor(Number(times)) || 2))
  // O que a repetição vai criar agora, para mostrar antes de salvar.
  const occurrences =
    repeating && date
      ? missingOccurrences({ frequency: repeat, startDate: date, count: repeatCount, generated: 0, ended: false }, todayISO())
      : []
  const plan = installments > 1 && date ? planInstallments(amount, mode, installments, dueDate, share) : null
  // A divisão vale para compra à vista: não se combina com parcelas, repetição nem estorno.
  const canSplit =
    expense && !estorno && !repeating && installments === 1 && !tx?.installmentGroupId && !tx?.recurrenceId && !splitting

  function startSplit() {
    setParts([
      newRow({ id: tx?.id, categoryId, subcategoryId: subcategoryId || null }),
      newRow(),
    ])
  }

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
    if (!parts && !categoryId) return setError('Escolha uma categoria.')
    if (!methodId) return setError(`Escolha a forma de ${inflow ? 'recebimento' : 'pagamento'}.`)
    if (parts) {
      const problem = splitError(amount, parts)
      if (problem) return setError(problem)
      await saveSplit(
        {
          type, date, dueDate, paymentMethodId: methodId, description: description.trim(), paid, resgate: false,
          invoiceShift: invoiceShift || undefined,
        },
        parts,
        tx?.splitGroupId,
      )
      setMonth(monthOf(dueDate))
      return onClose()
    }
    if (share !== undefined && share >= amount) return setError('A sua parte precisa ser menor que o valor da conta.')
    const base = {
      type,
      date,
      categoryId,
      subcategoryId: subcategoryId || null,
      paymentMethodId: methodId,
      description: description.trim(),
      paid,
      resgate,
      invoiceShift: invoiceShift || undefined,
      myShare: share,
      estorno: estorno || undefined,
    }
    if (repeating) await saveRecurring({ ...base, amount, dueDate }, { frequency: repeat, count: repeatCount })
    else if (plan) await saveInstallments(base, plan)
    else await saveTransaction({ ...base, id: tx?.id, amount, dueDate })
    if (tx?.installmentGroupId && scope !== 'este') {
      await updateInstallmentGroup(
        tx,
        {
          categoryId, subcategoryId: base.subcategoryId, paymentMethodId: methodId, description: base.description,
          // Valor e minha parte só vão para as outras parcelas quando foram mudados aqui.
          ...(amount !== tx.amount && { amount }),
          ...(share !== tx.myShare && { myShare: share }),
        },
        scope === 'todas' ? 'todas' : 'proximas',
      )
    }
    // Mover de fatura leva a compra parcelada inteira, qualquer que seja o alcance escolhido.
    if (tx?.installmentGroupId && credit && invoiceShift !== (tx.invoiceShift ?? 0)) {
      await shiftInstallments(tx, methodId, invoiceShift)
    }
    if (tx?.recurrenceId && scope === 'proximos') {
      await updateFollowing(tx, {
        type, amount, categoryId, subcategoryId: base.subcategoryId, paymentMethodId: methodId,
        description: base.description, resgate, myShare: share, invoiceShift: invoiceShift || undefined,
      })
    }
    // Leva a tela para o mês em que o lançamento entrou (o do vencimento).
    setMonth(monthOf(dueDate))
    onClose()
  }

  async function remove(choice: Scope | undefined) {
    if (!tx) return
    if (tx.splitGroupId) await deleteSplit(tx.splitGroupId)
    else if (tx.recurrenceId && choice === 'proximos') await endRecurrence(tx.recurrenceId, tx.recurrenceNumber)
    else if (tx.installmentGroupId && choice && choice !== 'este') {
      await deleteInstallments(tx, choice === 'todas' ? 'todas' : 'proximas')
    } else await deleteTransaction(tx.id)
    onClose()
  }

  async function addSubcategory() {
    const name = newSub?.trim()
    const parent = categories.find((c) => c.id === categoryId)
    if (!name || !parent) return
    const id = await saveCategory({ name, type: parent.type, parentId: parent.id, color: parent.color, archived: false })
    setSubcategoryId(id)
    setNewSub(null)
  }

  // Escolhas de alcance: parcelas têm "todas"; recorrência, só "este" ou "este e os próximos".
  const scopeOptions: ConfirmOption<Scope>[] = tx?.installmentGroupId
    ? [
        { value: 'este', label: 'Só esta parcela' },
        { value: 'proximos', label: 'Esta e as próximas' },
        { value: 'todas', label: `Todas as ${tx.installmentTotal} parcelas` },
      ]
    : tx?.recurrenceId
      ? [
          { value: 'este', label: 'Só este' },
          { value: 'proximos', label: 'Este e os próximos', hint: 'A repetição é encerrada.' },
        ]
      : []

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

        {expense && !splitting && (
          <div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {([false, true] as const).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setEstornoOn(value)}
                  aria-pressed={estornoOn === value}
                  className={`rounded-md py-1.5 text-sm font-semibold ${estornoOn === value ? 'seg-on' : 'text-slate-500'}`}
                >
                  {value ? 'Estorno' : 'Compra'}
                </button>
              ))}
            </div>
            {estorno && (
              <p className="mt-1 text-xs text-slate-500">
                Dinheiro devolvido. Lance na data e na fatura em que ele aparece, com a categoria da compra: abate da
                fatura e do gasto daquele mês.
              </p>
            )}
          </div>
        )}

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

        {scopeOptions.length > 0 && tx && (
          <div className="space-y-2 rounded-lg bg-slate-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-sm font-bold text-white">
                {tx.installmentGroupId
                  ? `Parcela ${tx.installmentNumber} de ${tx.installmentTotal}`
                  : `Recorrente · nº ${tx.recurrenceNumber}`}
              </span>
              <span className="text-sm text-slate-600">Salvar vale para:</span>
            </div>
            <div className={`grid gap-1 rounded-lg bg-slate-200/60 p-1 ${scopeOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {scopeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScope(option.value)}
                  aria-pressed={scope === option.value}
                  className={`rounded-md px-1 py-1.5 text-xs font-semibold sm:text-sm ${scope === option.value ? 'seg-on' : 'text-slate-500'}`}
                >
                  {option.value === 'este' ? (tx.installmentGroupId ? 'Só esta' : 'Só este') : option.value === 'todas' ? 'Todas' : tx.installmentGroupId ? 'Esta e as próximas' : 'Este e os próximos'}
                </button>
              ))}
            </div>
            {scope !== 'este' && (
              <p className="text-xs text-slate-500">
                {tx.installmentGroupId
                  ? amount !== tx.amount
                    ? `Categoria, subcategoria, forma, descrição e o valor de ${formatBRL(amount)} por parcela passam para as outras parcelas. O total da compra muda.`
                    : 'Categoria, subcategoria, forma e descrição passam para as outras parcelas. Se mudar o valor, ele vale para cada parcela.'
                  : 'Valor, categoria, forma e descrição passam a valer também para os próximos ainda não confirmados. As datas deles não mudam.'}
              </p>
            )}
          </div>
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
          {expense && !splitting && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-slate-900"
                checked={splitOn}
                onChange={(e) => setSplitOn(e.target.checked)}
              />
              Dividi a conta: só uma parte é minha
            </label>
          )}
        </div>

        {share !== undefined && (
          <div>
            <label className="label" htmlFor="tx-minha-parte">
              {plan && mode === 'parcela' ? 'Minha parte em cada parcela' : 'Minha parte'}
            </label>
            <MoneyInput id="tx-minha-parte" value={myShare} onChange={setMyShare} className="field font-semibold" />
            <p className="mt-1 text-xs text-slate-500">
              Conta no orçamento: <strong>{formatBRL(share)}</strong>.{credit && ' Na fatura e no limite do cartão vale o valor cheio.'} O
              que os outros te pagarem não precisa ser lançado.
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="tx-data">{estorno ? 'Data do estorno' : expense ? 'Data da compra' : 'Data'}</label>
          <input id="tx-data" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {splitting && parts && (
          <DivisaoEditor
            total={amount}
            rows={parts}
            categories={categories.filter((c) => c.type === 'despesa')}
            onChange={setParts}
            onCancel={tx?.splitGroupId ? undefined : () => setParts(null)}
          />
        )}

        <div className={splitting ? 'hidden' : undefined}>
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
          {canSplit && (
            <button
              type="button"
              className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:underline"
              onClick={startSplit}
            >
              <Split size={12} /> Dividir em categorias
            </button>
          )}
        </div>

        {categoryId && type !== 'receita' && !splitting && (
          <div>
            <label className="label" htmlFor="tx-sub">Subcategoria (opcional)</label>
            {newSub === null ? (
              <div className="flex gap-2">
                <select id="tx-sub" className="field" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {subcategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost shrink-0 ring-1 ring-slate-300 !px-3" onClick={() => setNewSub('')} aria-label="Nova subcategoria">
                  <Plus size={18} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  id="tx-sub"
                  className="field"
                  placeholder="Nome da nova subcategoria"
                  value={newSub}
                  maxLength={40}
                  autoFocus
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void addSubcategory()
                    }
                  }}
                />
                <button type="button" className="btn btn-primary shrink-0 !px-3" onClick={addSubcategory} aria-label="Criar subcategoria">
                  <Check size={18} />
                </button>
                <button type="button" className="btn btn-ghost shrink-0 !px-3" onClick={() => setNewSub(null)} aria-label="Cancelar">
                  <X size={18} />
                </button>
              </div>
            )}
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
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <button
                type="button"
                className="rounded-md p-1.5 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-30"
                onClick={() => setShift(shift - 1)}
                disabled={shift <= -MAX_INVOICE_SHIFT}
                aria-label="Mover para a fatura anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <p className="flex-1 text-center">
                Entra na fatura de <span className="font-semibold text-slate-700">{monthLabel(monthOf(dueDate)).toLowerCase()}</span>,
                com vencimento em {shortDate(dueDate)}.
                {invoiceShift !== 0 && (
                  <span className="block text-amber-600">
                    Movida para a fatura {invoiceShift < 0 ? 'anterior' : 'seguinte'}
                    {tx?.installmentGroupId ? ', com todas as parcelas' : repeating ? ', em todas as repetições' : ''}.
                  </span>
                )}
              </p>
              <button
                type="button"
                className="rounded-md p-1.5 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-30"
                onClick={() => setShift(shift + 1)}
                disabled={shift >= MAX_INVOICE_SHIFT}
                aria-label="Mover para a fatura seguinte"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {expense && !tx && !repeating && !estorno && !splitting && (
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

        {!tx && installments === 1 && !estorno && !splitting && (
          <div className="space-y-2">
            <div>
              <label className="label" htmlFor="tx-repetir">Repetir</label>
              <select id="tx-repetir" className="field" value={repeat} onChange={(e) => setRepeat(e.target.value as Frequency | '')}>
                <option value="">Não repete</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
                ))}
              </select>
            </div>
            {repeating && (
              <>
                <div className="flex items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="label">Termina</span>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                      {([false, true] as const).map((value) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => setEndless(value)}
                          aria-pressed={endless === value}
                          className={`rounded-md py-1.5 text-sm font-semibold ${endless === value ? 'seg-on' : 'text-slate-500'}`}
                        >
                          {value ? 'Sem data' : 'Após N vezes'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!endless && (
                    <div className="w-24 shrink-0">
                      <label className="label" htmlFor="tx-vezes">Vezes</label>
                      <input
                        id="tx-vezes"
                        type="number"
                        min={2}
                        max={MAX_COUNT}
                        className="field"
                        value={times}
                        onChange={(e) => setTimes(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                {occurrences.length > 0 && (
                  <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
                    {endless ? 'Sem data para acabar. Já ficam lançados ' : 'Serão criados '}
                    <strong>{occurrences.length} lançamentos</strong> de <strong>{formatBRL(amount)}</strong>, de{' '}
                    {fullDate(date)} a {fullDate(occurrenceDate(date, repeat, occurrences[occurrences.length - 1]))}
                    {endless && ', e o app completa os próximos sozinho'}. Os futuros entram como pendentes.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {expense && !credit && (
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="tx-venc">
                {plan ? 'Vencimento da 1ª parcela' : repeating ? 'Vencimento do 1º' : 'Vencimento'}
              </label>
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
              {plan ? '1ª parcela já paga' : repeating ? '1º já pago' : 'Já paga'}
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
            {repeating ? `1º: ${confirmWords({ type, resgate }).checkbox.toLowerCase()}` : confirmWords({ type, resgate }).checkbox}
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
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">Salvar</button>
        </div>
      </form>

      {confirmDelete && tx && (
        <ConfirmDialog<Scope>
          title={tx.installmentGroupId ? 'Excluir parcela' : tx.splitGroupId ? 'Excluir compra dividida' : 'Excluir lançamento'}
          message={
            scopeOptions.length > 0
              ? 'O que você quer excluir?'
              : tx.splitGroupId
                ? `A compra inteira será excluída, com as ${parts?.length ?? 0} partes.`
                : 'Este lançamento será excluído.'
          }
          options={scopeOptions.length > 0 ? scopeOptions : undefined}
          defaultValue="este"
          confirmLabel="Excluir"
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={(choice) => void remove(choice)}
        />
      )}
    </Modal>
  )
}
