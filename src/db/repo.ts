// Camada única de acesso a dados: as telas nunca gravam no banco diretamente.
// Trocar o armazenamento local por nuvem no futuro significa reescrever só este arquivo.
import { BACKUP_TABLES, buildBackup, type Backup, type BackupTable } from '../domain/backup'
import type { Installment } from '../domain/parcelas'
import { monthOf, todayISO } from '../lib/format'
import { db } from './db'
import type { Category, PaymentMethod, Transaction } from './types'

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
  Omit<Transaction, 'month' | 'installmentGroupId' | 'installmentNumber' | 'installmentTotal'>
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

export const deleteInstallmentGroup = async (groupId: string) =>
  remove('transactions', await db.transactions.where('installmentGroupId').equals(groupId).primaryKeys())
