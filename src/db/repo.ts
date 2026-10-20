// Camada única de acesso a dados: as telas nunca gravam no banco diretamente.
// Trocar o armazenamento local por nuvem no futuro significa reescrever só este arquivo.
import { BACKUP_TABLES, buildBackup, type Backup, type BackupTable } from '../domain/backup'
import { dueDateFor, isCredit } from '../domain/fatura'
import type { SplitPart } from '../domain/divisao'
import type { Installment } from '../domain/parcelas'
import { missingOccurrences, occurrenceDate } from '../domain/recorrencia'
import { addMonthsToDate, monthOf, todayISO } from '../lib/format'
import { db } from './db'
import type { Category, PaymentMethod, Person, Recurrence, Transaction } from './types'

const now = () => new Date().toISOString()

type Input<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

/**
 * Exclui registros deixando o registro de exclusão, para que a sincronização leve a exclusão aos outros
 * aparelhos. Toda exclusão de dado sincronizado passa por aqui.
 */
async function remove(table: BackupTable, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const deletedAt = now()
  await db.transaction('rw', db.table(table), db.deletions, async () => {
    await db.table(table).bulkDelete(ids)
    await db.deletions.bulkPut(ids.map((id) => ({ table, id, deletedAt })))
  })
}

export async function saveCategory(input: Input<Category>): Promise<string> {
  if (input.id) {
    const { id, ...changes } = input
    await db.categories.update(id, { ...changes, updatedAt: now() })
    return id
  }
  const id = crypto.randomUUID()
  await db.categories.add({ ...input, id, createdAt: now(), updatedAt: now() })
  return id
}

/**
 * Altera nome, cor e ícone. Subcategorias que ainda usam a cor da categoria-mãe acompanham a
 * mudança de cor; as que já tiveram cor própria escolhida ficam como estão.
 */
export async function updateCategoryLook(
  category: Category,
  look: Pick<Category, 'name' | 'color' | 'icon'>,
): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    await db.categories.update(category.id, { ...look, updatedAt: now() })
    if (!category.parentId && look.color !== category.color) {
      await db.categories
        .where('parentId')
        .equals(category.id)
        .filter((sub) => sub.color === category.color)
        .modify({ color: look.color, updatedAt: now() })
    }
  })
}

/** Exclui a categoria; se já houver lançamentos nela (ou nas subcategorias), apenas arquiva. */
export async function removeCategory(id: string): Promise<'excluida' | 'arquivada'> {
  return db.transaction('rw', [db.categories, db.transactions, db.budgets, db.deletions], async () => {
    const subIds = (await db.categories.where('parentId').equals(id).toArray()).map((c) => c.id)
    const used =
      (await db.transactions.where('categoryId').equals(id).count()) +
      (await db.transactions.where('subcategoryId').equals(id).count())
    if (used > 0) {
      await db.categories.update(id, { archived: true, updatedAt: now() })
      return 'arquivada'
    }
    await remove('categories', [id, ...subIds])
    await remove('budgets', await db.budgets.where('categoryId').equals(id).primaryKeys())
    return 'excluida'
  })
}

/** Desarquiva a categoria; uma subcategoria traz a categoria-mãe junto, senão continuaria escondida. */
export async function restoreCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const category = await db.categories.get(id)
    if (!category) return
    const ids = category.parentId ? [id, category.parentId] : [id]
    await db.categories.where('id').anyOf(ids).modify({ archived: false, updatedAt: now() })
  })
}

export async function saveMethod(input: Input<PaymentMethod>): Promise<string> {
  if (input.id) {
    const { id, ...changes } = input
    await db.paymentMethods.update(id, { ...changes, updatedAt: now() })
    return id
  }
  const id = crypto.randomUUID()
  await db.paymentMethods.add({ ...input, id, createdAt: now(), updatedAt: now() })
  return id
}

/** Exclui a forma; se já houver lançamentos com ela, apenas arquiva. */
export async function removeMethod(id: string): Promise<'excluida' | 'arquivada'> {
  const used = await db.transactions.where('paymentMethodId').equals(id).count()
  if (used > 0) {
    await db.paymentMethods.update(id, { archived: true, updatedAt: now() })
    return 'arquivada'
  }
  await remove('paymentMethods', [id])
  return 'excluida'
}

export const restoreMethod = (id: string) =>
  db.paymentMethods.update(id, { archived: false, updatedAt: now() })

// ---------- pessoas ----------

export async function savePerson(input: Input<Person>): Promise<string> {
  if (input.id) {
    const { id, ...changes } = input
    await db.people.update(id, { ...changes, updatedAt: now() })
    return id
  }
  const id = crypto.randomUUID()
  await db.people.add({ ...input, id, createdAt: now(), updatedAt: now() })
  return id
}

/** Pessoa com lançamentos ou recorrências é só arquivada, para não perder o histórico. */
export async function removePerson(id: string): Promise<'excluida' | 'arquivada'> {
  const used =
    (await db.transactions.where('personId').equals(id).count()) +
    (await db.recurrences.filter((r) => r.personId === id).count())
  if (used > 0) {
    await db.people.update(id, { archived: true, updatedAt: now() })
    return 'arquivada'
  }
  await remove('people', [id])
  return 'excluida'
}

export const restorePerson = (id: string) => db.people.update(id, { archived: false, updatedAt: now() })

/** Troca de quem são vários lançamentos (null = família). */
export const setPersonMany = (ids: string[], personId: string | null) =>
  db.transactions.bulkUpdate(ids.map((key) => ({ key, changes: { personId: personId ?? undefined, updatedAt: now() } })))

export const LAST_BACKUP = 'ultimoBackup'

/** Tudo que está guardado no aparelho, pronto para virar arquivo de backup. */
export async function exportAll(): Promise<Backup> {
  const exportedAt = now()
  await db.local.put({ key: LAST_BACKUP, value: exportedAt })
  const data = {} as Record<BackupTable, unknown[]>
  for (const table of BACKUP_TABLES) data[table] = await db.table(table).toArray()
  return buildBackup(data, exportedAt)
}

/** Substitui todos os dados do aparelho pelos do backup. Tudo ou nada: se algo falhar, nada muda. */
export async function importAll(backup: Backup): Promise<void> {
  await db.transaction('rw', BACKUP_TABLES.map((table) => db.table(table)), async () => {
    for (const table of BACKUP_TABLES) {
      await db.table(table).clear()
      await db.table(table).bulkAdd(backup.data[table])
    }
  })
}

/** Apaga tudo e recria o banco só com os cadastros iniciais. */
export async function resetAll(): Promise<void> {
  await db.delete()
  await db.open()
}

export const OPENING_BALANCE = 'saldoInicial'

export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value, updatedAt: now() })

/** Define o limite da categoria a partir do mês informado (0 = sem limite dali em diante). */
export async function setBudget(month: string, categoryId: string, limit: number): Promise<void> {
  await db.transaction('rw', db.budgets, async () => {
    const existing = await db.budgets.where('month').equals(month).filter((b) => b.categoryId === categoryId).first()
    if (existing) await db.budgets.update(existing.id, { limit, updatedAt: now() })
    // Id previsível: dois aparelhos que definam o limite do mesmo mês geram o mesmo registro, não dois.
    else await db.budgets.put({ id: `${month}:${categoryId}`, month, categoryId, limit, createdAt: now(), updatedAt: now() })
  })
}

export type TransactionInput = Input<
  Omit<
    Transaction,
    'month' | 'installmentGroupId' | 'installmentNumber' | 'installmentTotal' | 'recurrenceId' | 'recurrenceNumber'
  >
>

export async function saveTransaction(input: TransactionInput): Promise<string> {
  const month = monthOf(input.dueDate)
  if (input.id) {
    const { id, ...changes } = input
    await db.transactions.update(id, { ...changes, month, updatedAt: now() })
    return id
  }
  const id = crypto.randomUUID()
  await db.transactions.add({ ...input, id, month, createdAt: now(), updatedAt: now() })
  return id
}

/**
 * Compra parcelada: grava um lançamento por parcela, ligados pelo mesmo grupo.
 * `input.paid` vale para a 1ª parcela; as demais entram como pagas só se já venceram
 * (compra antiga lançada depois).
 */
export async function saveInstallments(
  input: Omit<TransactionInput, 'id' | 'amount' | 'dueDate'>,
  plan: Installment[],
): Promise<void> {
  const installmentGroupId = crypto.randomUUID()
  await db.transactions.bulkAdd(
    plan.map((p) => ({
      ...input,
      id: crypto.randomUUID(),
      amount: p.amount,
      myShare: p.myShare, // a minha parte de cada parcela, não a do total
      dueDate: p.dueDate,
      month: monthOf(p.dueDate),
      paid: p.number === 1 ? input.paid : p.dueDate < todayISO(),
      installmentGroupId,
      installmentNumber: p.number,
      installmentTotal: plan.length,
      createdAt: now(),
      updatedAt: now(),
    })),
  )
}

// ---------- recorrência ----------

/** Id previsível: dois aparelhos que criem a mesma ocorrência geram o mesmo registro, não dois. */
const occurrenceId = (recurrenceId: string, n: number) => `${recurrenceId}:${n}`

/** Um lançamento para cada ocorrência pedida, a partir do modelo da regra. */
function buildOccurrences(rule: Recurrence, numbers: number[], method: PaymentMethod | undefined, firstPaid?: boolean) {
  const today = todayISO()
  return numbers.map((n): Transaction => {
    const date = occurrenceDate(rule.startDate, rule.frequency, n)
    // No crédito o vencimento é o da fatura daquela data; fora dele, o vencimento informado anda junto.
    const dueDate = isCredit(method)
      ? dueDateFor(date, method, rule.invoiceShift)
      : rule.startDueDate
        ? occurrenceDate(rule.startDueDate, rule.frequency, n)
        : date
    return {
      id: occurrenceId(rule.id, n),
      recurrenceId: rule.id,
      recurrenceNumber: n,
      type: rule.type,
      amount: rule.amount,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      paymentMethodId: rule.paymentMethodId,
      description: rule.description,
      resgate: rule.resgate,
      ...(rule.myShare !== undefined && { myShare: rule.myShare }),
      ...(rule.invoiceShift && isCredit(method) && { invoiceShift: rule.invoiceShift }),
      ...(rule.personId && { personId: rule.personId }),
      date,
      dueDate,
      month: monthOf(dueDate),
      // A 1ª segue o que foi marcado no formulário; as demais só entram confirmadas se já passaram.
      paid: n === 1 && firstPaid !== undefined ? firstPaid : dueDate < today,
      // Carimbo da regra, não o de agora: qualquer edição feita à mão é mais recente e vence na
      // sincronização, e dois aparelhos criando a mesma ocorrência produzem registros idênticos.
      createdAt: rule.updatedAt,
      updatedAt: rule.updatedAt,
    }
  })
}

/** Cria o que falta de uma regra e avança o contador dela. */
async function materialize(rule: Recurrence, firstPaid?: boolean): Promise<void> {
  const numbers = missingOccurrences(rule, todayISO())
  if (numbers.length === 0) return
  const method = await db.paymentMethods.get(rule.paymentMethodId)
  await db.transaction('rw', db.transactions, db.recurrences, async () => {
    await db.transactions.bulkPut(buildOccurrences(rule, numbers, method, firstPaid))
    // O contador avança sem mexer em updatedAt: completar o horizonte não é uma alteração da regra.
    await db.recurrences.update(rule.id, { generated: numbers[numbers.length - 1] })
  })
}

/** Lançamento que se repete: grava a regra e cria as ocorrências (todas, ou até o horizonte se não tem fim). */
export async function saveRecurring(
  input: Omit<TransactionInput, 'id'>,
  repeat: Pick<Recurrence, 'frequency' | 'count'>,
): Promise<void> {
  const stamp = now()
  const rule: Recurrence = {
    id: crypto.randomUUID(),
    frequency: repeat.frequency,
    count: repeat.count,
    startDate: input.date,
    startDueDate: input.dueDate !== input.date ? input.dueDate : undefined,
    generated: 0,
    ended: false,
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    paymentMethodId: input.paymentMethodId,
    description: input.description,
    resgate: input.resgate,
    myShare: input.myShare,
    invoiceShift: input.invoiceShift,
    personId: input.personId,
    createdAt: stamp,
    updatedAt: stamp,
  }
  await db.recurrences.add(rule)
  await materialize(rule, input.paid)
}

/** Completa as recorrências sem data para acabar até o horizonte. Roda ao abrir o app e depois de sincronizar. */
export async function extendRecurrences(): Promise<void> {
  const open = await db.recurrences.filter((r) => !r.ended && r.count === undefined).toArray()
  for (const rule of open) await materialize(rule)
}

type RecurringChanges = Pick<
  Transaction,
  | 'type' | 'amount' | 'categoryId' | 'subcategoryId' | 'paymentMethodId' | 'description' | 'resgate' | 'myShare'
  | 'invoiceShift' | 'personId'
>

/**
 * "Este e os próximos": aplica valor, categoria, forma, descrição e o ajuste de fatura às ocorrências seguintes
 * ainda não confirmadas e ao modelo da regra (o que for criado depois já nasce assim). As datas de compra não mudam.
 */
export async function updateFollowing(tx: Transaction, changes: RecurringChanges): Promise<void> {
  if (!tx.recurrenceId) return
  const method = await db.paymentMethods.get(changes.paymentMethodId)
  const wasCredit = isCredit(await db.paymentMethods.get(tx.paymentMethodId))
  const stamp = now()
  await db.transaction('rw', db.transactions, db.recurrences, async () => {
    await db.recurrences.update(tx.recurrenceId!, { ...changes, updatedAt: stamp })
    await db.transactions
      .where('recurrenceId')
      .equals(tx.recurrenceId!)
      .filter((t) => (t.recurrenceNumber ?? 0) > (tx.recurrenceNumber ?? 0) && !t.paid)
      .modify((t) => {
        Object.assign(t, changes, { updatedAt: stamp })
        // Trocar para ou de cartão de crédito, ou mover de fatura, muda em que fatura cada ocorrência cai.
        if (isCredit(method)) t.dueDate = dueDateFor(t.date, method, t.invoiceShift)
        else if (wasCredit) {
          t.dueDate = t.date
          delete t.invoiceShift
        }
        t.month = monthOf(t.dueDate)
      })
  })
}

/**
 * Encerra a recorrência: nada mais é criado. Com `fromNumber`, apaga aquela ocorrência e as seguintes
 * (é o "excluir este e os próximos"); sem ele, apaga só as futuras ainda não confirmadas.
 */
export async function endRecurrence(recurrenceId: string, fromNumber?: number): Promise<void> {
  const today = todayISO()
  const ids = await db.transactions
    .where('recurrenceId')
    .equals(recurrenceId)
    .filter((t) => (fromNumber !== undefined ? (t.recurrenceNumber ?? 0) >= fromNumber : !t.paid && t.date > today))
    .primaryKeys()
  await remove('transactions', ids)
  await db.recurrences.update(recurrenceId, { ended: true, updatedAt: now() })
}

/**
 * Marca como paga / não paga. No cartão de crédito a fatura é paga inteira,
 * então vale para todos os lançamentos do mesmo cartão naquele mês.
 */
export async function setPaid(tx: Transaction, paid: boolean): Promise<void> {
  const method = await db.paymentMethods.get(tx.paymentMethodId)
  const changes = { paid, updatedAt: now() }
  if (method?.kind === 'credito') {
    await db.transactions
      .where('month')
      .equals(tx.month)
      .filter((t) => t.paymentMethodId === tx.paymentMethodId && t.type === 'despesa')
      .modify(changes)
  } else if (tx.splitGroupId) {
    // As partes de uma compra dividida foram pagas juntas.
    await db.transactions.where('splitGroupId').equals(tx.splitGroupId).modify(changes)
  } else {
    await db.transactions.update(tx.id, changes)
  }
}

/** Marca a fatura inteira do cartão naquele mês como paga / não paga. */
export const setInvoicePaid = (paymentMethodId: string, month: string, paid: boolean) =>
  db.transactions
    .where('month')
    .equals(month)
    .filter((t) => t.paymentMethodId === paymentMethodId && t.type === 'despesa')
    .modify({ paid, updatedAt: now() })

export const deleteTransaction = (id: string) => remove('transactions', [id])

// ---------- vários lançamentos de uma vez ----------

export const deleteTransactions = (ids: string[]) => remove('transactions', ids)

/** Confirma ou desfaz vários lançamentos. Despesa no cartão segue a regra de sempre: vale a fatura inteira. */
export async function setPaidMany(txs: Transaction[], paid: boolean): Promise<void> {
  const credit = new Set((await db.paymentMethods.toArray()).filter((m) => m.kind === 'credito').map((m) => m.id))
  const onInvoice = (t: Transaction) => credit.has(t.paymentMethodId) && t.type === 'despesa'
  const invoices = new Map(txs.filter(onInvoice).map((t) => [`${t.paymentMethodId}|${t.month}`, t]))
  const stamp = now()
  await db.transaction('rw', db.transactions, async () => {
    const plain = txs.filter((t) => !onInvoice(t))
    // As outras partes de uma compra dividida acompanham a parte escolhida.
    const groups = [...new Set(plain.map((t) => t.splitGroupId).filter((id): id is string => !!id))]
    const siblings = groups.length ? await db.transactions.where('splitGroupId').anyOf(groups).primaryKeys() : []
    const ids = [...new Set([...plain.map((t) => t.id), ...siblings])]
    await db.transactions.bulkUpdate(ids.map((key) => ({ key, changes: { paid, updatedAt: stamp } })))
    for (const t of invoices.values()) await setInvoicePaid(t.paymentMethodId, t.month, paid)
  })
}

/** Troca categoria e subcategoria de vários lançamentos (do mesmo tipo). */
export const setCategoryMany = (ids: string[], categoryId: string, subcategoryId: string | null) =>
  db.transactions.bulkUpdate(ids.map((key) => ({ key, changes: { categoryId, subcategoryId, updatedAt: now() } })))

// ---------- compra dividida em categorias ----------

/**
 * Grava a compra dividida: uma despesa por parte, com os mesmos dados da compra. Ao editar, as partes
 * que já existem são atualizadas e as retiradas da divisão são excluídas.
 */
export async function saveSplit(
  input: Omit<TransactionInput, 'id' | 'amount' | 'categoryId' | 'subcategoryId'>,
  parts: SplitPart[],
  splitGroupId: string = crypto.randomUUID(),
): Promise<void> {
  const stamp = now()
  const month = monthOf(input.dueDate)
  const keep = new Set(parts.map((p) => p.id))
  const stale = (await db.transactions.where('splitGroupId').equals(splitGroupId).primaryKeys()).filter((id) => !keep.has(id))
  await db.transaction('rw', db.transactions, db.deletions, async () => {
    await remove('transactions', stale)
    for (const p of parts) {
      const values = {
        ...input, amount: p.amount, categoryId: p.categoryId, subcategoryId: p.subcategoryId, month, splitGroupId,
        updatedAt: stamp,
      }
      if (p.id) await db.transactions.update(p.id, values)
      else await db.transactions.add({ ...values, id: crypto.randomUUID(), createdAt: stamp })
    }
  })
}

export const deleteSplit = async (splitGroupId: string) =>
  remove('transactions', await db.transactions.where('splitGroupId').equals(splitGroupId).primaryKeys())

/** Alcance de uma alteração numa compra parcelada, a partir da parcela aberta. */
export type InstallmentScope = 'proximas' | 'todas'

const inScope = (tx: Transaction, scope: InstallmentScope) => (t: Transaction) =>
  scope === 'todas' || (t.installmentNumber ?? 0) >= (tx.installmentNumber ?? 0)

/**
 * Aplica categoria, subcategoria, forma, descrição e pessoa às outras parcelas da mesma compra. Valor e minha parte
 * só vêm em `changes` quando a pessoa os mudou, e então valem por parcela (o total da compra muda junto);
 * sem mudança, cada parcela mantém o seu, inclusive os centavos da 1ª. Trocar de ou para cartão de
 * crédito recalcula a fatura de cada parcela.
 */
export async function updateInstallmentGroup(
  tx: Transaction,
  changes: Pick<Transaction, 'categoryId' | 'subcategoryId' | 'paymentMethodId' | 'description' | 'personId'> &
    Partial<Pick<Transaction, 'amount' | 'myShare'>>,
  scope: InstallmentScope,
): Promise<void> {
  if (!tx.installmentGroupId) return
  const method = await db.paymentMethods.get(changes.paymentMethodId)
  const wasCredit = isCredit(await db.paymentMethods.get(tx.paymentMethodId))
  const stamp = now()
  await db.transactions
    .where('installmentGroupId')
    .equals(tx.installmentGroupId)
    // A parcela aberta já foi gravada pelo formulário, com o vencimento que a pessoa escolheu.
    .filter((t) => t.id !== tx.id && inScope(tx, scope)(t))
    .modify((t) => {
      const methodChanged = t.paymentMethodId !== changes.paymentMethodId
      Object.assign(t, changes, { updatedAt: stamp })
      if (!methodChanged) return
      const offset = (t.installmentNumber ?? 1) - 1
      if (isCredit(method)) t.dueDate = addMonthsToDate(dueDateFor(t.date, method, t.invoiceShift), offset)
      else {
        delete t.invoiceShift // fora do cartão não há fatura para mover
        if (wasCredit) t.dueDate = addMonthsToDate(t.date, offset)
      }
      t.month = monthOf(t.dueDate)
    })
}

/** Move a compra parcelada inteira para a fatura anterior ou seguinte: todas as parcelas andam juntas. */
export async function shiftInstallments(tx: Transaction, paymentMethodId: string, shift: number): Promise<void> {
  if (!tx.installmentGroupId) return
  const method = await db.paymentMethods.get(paymentMethodId)
  if (!isCredit(method)) return
  const stamp = now()
  await db.transactions
    .where('installmentGroupId')
    .equals(tx.installmentGroupId)
    .filter((t) => t.id !== tx.id) // a parcela aberta já foi gravada pelo formulário
    .modify((t) => {
      t.invoiceShift = shift || undefined
      t.dueDate = addMonthsToDate(dueDateFor(t.date, method, shift), (t.installmentNumber ?? 1) - 1)
      t.month = monthOf(t.dueDate)
      t.updatedAt = stamp
    })
}

/** Exclui a parcela aberta e as seguintes, ou todas as parcelas da compra. */
export async function deleteInstallments(tx: Transaction, scope: InstallmentScope): Promise<void> {
  if (!tx.installmentGroupId) return
  const ids = await db.transactions
    .where('installmentGroupId')
    .equals(tx.installmentGroupId)
    .filter(inScope(tx, scope))
    .primaryKeys()
  await remove('transactions', ids)
}

