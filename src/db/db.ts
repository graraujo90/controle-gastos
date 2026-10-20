import Dexie, { type EntityTable, type Table } from 'dexie'
import { dueDateFor } from '../domain/fatura'
import type { Deletion } from '../domain/sync'
import { monthOf, todayISO } from '../lib/format'
import { seedCategories, seedMethods } from './seed'
import type {
  Budget, Category, LocalValue, PaymentMethod, Person, Recurrence, Setting, Transaction,
} from './types'

export const db = new Dexie('controle-gastos') as Dexie & {
  categories: EntityTable<Category, 'id'>
  paymentMethods: EntityTable<PaymentMethod, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  budgets: EntityTable<Budget, 'id'>
  recurrences: EntityTable<Recurrence, 'id'>
  people: EntityTable<Person, 'id'>
  settings: EntityTable<Setting, 'key'>
  deletions: Table<Deletion, [string, string]>
  local: EntityTable<LocalValue, 'key'>
}

db.version(1).stores({
  categories: 'id, type, parentId',
  paymentMethods: 'id, kind',
  transactions: 'id, month, date, categoryId, subcategoryId, paymentMethodId, installmentGroupId',
  budgets: 'id, month, categoryId',
  goals: 'id',
  goalContributions: 'id, goalId',
  settings: 'key',
})

// v2: vencimento e situação de pagamento. Lançamentos antigos entram como pagos,
// exceto os de crédito cuja fatura ainda não venceu.
db.version(2)
  .stores({
    transactions: 'id, month, date, dueDate, categoryId, subcategoryId, paymentMethodId, installmentGroupId',
  })
  .upgrade(async (tx) => {
    const methods = new Map<string, PaymentMethod>(
      (await tx.table('paymentMethods').toArray()).map((m: PaymentMethod) => [m.id, m]),
    )
    const today = todayISO()
    await tx.table('transactions').toCollection().modify((t: Transaction) => {
      t.dueDate = dueDateFor(t.date, methods.get(t.paymentMethodId))
      t.month = monthOf(t.dueDate)
      t.paid = t.type !== 'despesa' || t.dueDate <= today
    })
  })

// v3: saldos informados dos investimentos. As tabelas de metas saem: a ideia foi
// substituída por categorias de despesa (ex.: viagens) e pela aba de investimentos.
db.version(3).stores({
  balances: 'id, categoryId, date',
  goals: null,
  goalContributions: null,
})

// v4: preparação para sincronizar entre aparelhos. `deletions` guarda o que foi excluído, para não
// voltar vindo de outro aparelho; `local` guarda o que é só deste aparelho (não sincroniza nem entra no backup).
db.version(4)
  .stores({
    deletions: '[table+id]',
    local: 'key',
  })
  .upgrade(async (tx) => {
    const now = new Date().toISOString()
    await tx.table('settings').toCollection().modify((s: Setting) => {
      s.updatedAt = now
    })
    // A data do último backup é de cada aparelho.
    const last = await tx.table('settings').get('ultimoBackup')
    if (last) {
      await tx.table('local').put({ key: 'ultimoBackup', value: last.value })
      await tx.table('settings').delete('ultimoBackup')
    }
  })

// v5: o app deixa de acompanhar saldo e rendimento de investimentos; ficam só os lançamentos.
db.version(5).stores({ balances: null })

// v6: lançamentos recorrentes.
db.version(6).stores({
  recurrences: 'id',
  transactions: 'id, month, date, dueDate, categoryId, subcategoryId, paymentMethodId, installmentGroupId, recurrenceId',
})

// v7: compra dividida em categorias (partes ligadas por splitGroupId).
db.version(7).stores({
  transactions:
    'id, month, date, dueDate, categoryId, subcategoryId, paymentMethodId, installmentGroupId, recurrenceId, splitGroupId',
})

// v8: pessoas do orçamento familiar; cada lançamento pode ser de uma pessoa (personId).
db.version(8).stores({
  people: 'id',
  transactions:
    'id, month, date, dueDate, categoryId, subcategoryId, paymentMethodId, installmentGroupId, recurrenceId, splitGroupId, personId',
})

// Roda uma única vez, quando o banco é criado no aparelho.
db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(seedCategories())
  tx.table('paymentMethods').bulkAdd(seedMethods())
})
