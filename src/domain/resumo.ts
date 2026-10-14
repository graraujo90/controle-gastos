import type { Transaction } from '../db/types'

export interface MonthSummary {
  receitas: number
  despesas: number
  /** Aportes − resgates; fica negativo no mês em que se resgata mais do que se aporta. */
  investimentos: number
  /** receitas − despesas − investimentos */
  resultado: number
}

/**
 * Valor de um lançamento de investimento com sinal: aporte soma, resgate subtrai.
 * Assim um resgate devolve dinheiro ao resultado do mês sem inflar as receitas.
 */
export const invested = (t: Pick<Transaction, 'amount' | 'resgate'>) => (t.resgate ? -t.amount : t.amount)

/**
 * Quanto uma despesa pesa no orçamento: a minha parte, quando a conta foi dividida; o estorno abate.
 * Esta é a regra de resultado, orçamento, categorias, relatórios e pendências. A fatura e o limite do
 * cartão usam o valor cheio (`invoiceValue`).
 */
export const spent = (t: Pick<Transaction, 'amount' | 'myShare' | 'estorno'>) =>
  (t.estorno ? -1 : 1) * (t.myShare ?? t.amount)

/** Valor na fatura do cartão: sempre o cheio, como o banco cobra; o estorno abate. */
export const invoiceValue = (t: Pick<Transaction, 'amount' | 'estorno'>) => (t.estorno ? -t.amount : t.amount)

export type Counted = Pick<Transaction, 'type' | 'amount' | 'resgate' | 'myShare' | 'estorno'>

/** Quanto um lançamento conta dentro do seu tipo (receita, despesa ou investimento), com sinal. */
export const counted = (t: Counted) =>
  t.type === 'receita' ? t.amount : t.type === 'despesa' ? spent(t) : invested(t)

export function summarize(transactions: Counted[]): MonthSummary {
  const s = { receitas: 0, despesas: 0, investimentos: 0, resultado: 0 }
  for (const t of transactions) {
    if (t.type === 'receita') s.receitas += counted(t)
    else if (t.type === 'despesa') s.despesas += counted(t)
    else s.investimentos += counted(t)
  }
  s.resultado = s.receitas - s.despesas - s.investimentos
  return s
}

/** Uma fatia de um total: o valor e o peso (0 a 1) dentro do grupo a que pertence. */
export interface Share {
  id: string
  total: number
  share: number
}

export interface CategoryShare extends Share {
  /** Peso de cada subcategoria dentro da categoria. Id vazio = lançamentos sem subcategoria. */
  subs: Share[]
}

export interface ExpenseBreakdown {
  total: number
  /** Quanto do total já foi pago. */
  paid: number
  /** Do maior para o menor; `share` é o peso da categoria no total das despesas. */
  categories: CategoryShare[]
}

const shares = (totals: Map<string, number>, whole: number): Share[] =>
  [...totals]
    .map(([id, total]) => ({ id, total, share: whole > 0 ? total / whole : 0 }))
    .sort((a, b) => b.total - a.total)

const add = (map: Map<string, number>, key: string, amount: number) => map.set(key, (map.get(key) ?? 0) + amount)

/** Despesas por categoria e subcategoria, com o peso de cada uma e o total já pago. */
export function expenseBreakdown(
  expenses: Pick<Transaction, 'categoryId' | 'subcategoryId' | 'amount' | 'paid' | 'myShare' | 'estorno'>[],
): ExpenseBreakdown {
  const byCategory = new Map<string, number>()
  const bySub = new Map<string, Map<string, number>>()
  let total = 0
  let paid = 0
  for (const t of expenses) {
    const value = spent(t)
    total += value
    if (t.paid) paid += value
    add(byCategory, t.categoryId, value)
    if (!bySub.has(t.categoryId)) bySub.set(t.categoryId, new Map())
    add(bySub.get(t.categoryId)!, t.subcategoryId ?? '', value)
  }
  // Compra e estorno que se anulam (ou minha parte zero) não deixam linha com R$ 0,00.
  const categories = shares(byCategory, total)
    .filter((c) => c.total !== 0)
    .map((c) => ({ ...c, subs: shares(bySub.get(c.id)!, c.total).filter((s) => s.total !== 0) }))
  return { total, paid, categories }
}

/** Uma linha do resumo por forma de pagamento: uma forma avulsa, ou o grupo dos cartões de crédito. */
export type MethodRow = (Share & { kind: 'forma' }) | (Share & { kind: 'cartoes'; cards: Share[] })

/** Id usado para a linha que agrupa os cartões de crédito. */
export const CARDS_ROW = 'cartoes'

/**
 * Despesas por forma de pagamento. Os cartões de crédito ficam juntos em uma linha, com o peso de
 * cada cartão dentro do grupo; as demais formas vêm uma por linha. Do maior para o menor.
 */
export function methodBreakdown(
  expenses: Pick<Transaction, 'paymentMethodId' | 'amount' | 'myShare' | 'estorno'>[],
  creditIds: Set<string>,
): MethodRow[] {
  const others = new Map<string, number>()
  const cards = new Map<string, number>()
  let total = 0
  let cardTotal = 0
  for (const t of expenses) {
    const value = spent(t)
    total += value
    if (creditIds.has(t.paymentMethodId)) {
      cardTotal += value
      add(cards, t.paymentMethodId, value)
    } else add(others, t.paymentMethodId, value)
  }
  const rows: MethodRow[] = shares(others, total).map((s) => ({ ...s, kind: 'forma' }))
  if (cards.size > 0) {
    rows.push({ kind: 'cartoes', id: CARDS_ROW, total: cardTotal, share: total > 0 ? cardTotal / total : 0, cards: shares(cards, cardTotal) })
  }
  return rows.sort((a, b) => b.total - a.total)
}

/** Gasto por categoria de despesa (nível principal), do maior para o menor. */
export function totalsByCategory(
  expenses: Pick<Transaction, 'categoryId' | 'amount' | 'myShare' | 'estorno'>[],
): { categoryId: string; total: number }[] {
  const map = new Map<string, number>()
  for (const t of expenses) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + spent(t))
  return [...map].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total)
}
