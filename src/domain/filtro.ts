import { TX_TYPES, type Transaction, type TxType } from '../db/types'
import { pendingKind, type PendingKind } from './contas'

export type Situation = 'confirmado' | 'pendente' | 'atrasado'
export type Period = 'mes' | 'ano'

/** Valor de `subcategoria` para "lançamentos sem subcategoria". */
export const NO_SUB = 'nenhuma'
/** Valor de `forma` para "todos os cartões de crédito". */
export const ALL_CREDIT = 'credito'

/** Critérios da lista de lançamentos. Campo ausente = não filtra por ele. */
export interface TxFilter {
  tipo?: TxType
  /** Pendentes de uma direção (a pagar, a receber, a investir): é o que os botões rápidos usam. */
  pendencia?: PendingKind
  situacao?: Situation
  categoria?: string
  /** Id da subcategoria, ou NO_SUB. */
  subcategoria?: string
  /** Id da forma de pagamento, ou ALL_CREDIT. */
  forma?: string
  /** Faixa de valor, em centavos. */
  min?: number
  max?: number
  /** Procurado na descrição e nos nomes da categoria e da subcategoria. */
  texto?: string
  /** Só compras parceladas. */
  parcelado?: boolean
  /** Só lançamentos criados por uma recorrência. */
  recorrente?: boolean
  /**
   * Intervalo de datas ('AAAA-MM-DD', inclusive), pela data do "Ver por" da lista (vencimento ou compra).
   * Com intervalo, o seletor de mês e ano fica de lado.
   */
  de?: string
  ate?: string
}

const PENDING: PendingKind[] = ['pagar', 'receber', 'investir']
const SITUATIONS: Situation[] = ['confirmado', 'pendente', 'atrasado']
const oneOf = <T extends string>(value: string | null, options: readonly T[]) =>
  options.includes(value as T) ? (value as T) : undefined
const isoDate = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined)
const cents = (value: string | null) => {
  const n = Number(value)
  return value && Number.isInteger(n) && n > 0 ? n : undefined
}

// O filtro mora no endereço da tela (#/lancamentos?tipo=despesa&cat=…): assim o Início e os relatórios
// conseguem abrir a lista já filtrada, e o "voltar" do aparelho funciona. Valores inválidos são ignorados.
export function parseFilter(params: URLSearchParams): TxFilter {
  let de = isoDate(params.get('de'))
  let ate = isoDate(params.get('ate'))
  if (de && ate && de > ate) [de, ate] = [ate, de] // datas trocadas: vale o intervalo entre elas
  return {
    tipo: oneOf(params.get('tipo'), TX_TYPES),
    pendencia: oneOf(params.get('pend'), PENDING),
    situacao: oneOf(params.get('sit'), SITUATIONS),
    categoria: params.get('cat') || undefined,
    subcategoria: params.get('sub') || undefined,
    forma: params.get('forma') || undefined,
    min: cents(params.get('min')),
    max: cents(params.get('max')),
    texto: params.get('q')?.trim() || undefined,
    parcelado: params.get('parc') === '1' || undefined,
    recorrente: params.get('rec') === '1' || undefined,
    de,
    ate,
  }
}

export const parsePeriod = (params: URLSearchParams): Period => (params.get('periodo') === 'ano' ? 'ano' : 'mes')

export function filterToParams(filter: TxFilter, period: Period = 'mes'): URLSearchParams {
  const entries: [string, string | number | undefined][] = [
    ['periodo', period === 'ano' ? 'ano' : undefined],
    ['tipo', filter.tipo],
    ['pend', filter.pendencia],
    ['sit', filter.situacao],
    ['cat', filter.categoria],
    ['sub', filter.subcategoria],
    ['forma', filter.forma],
    ['min', filter.min],
    ['max', filter.max],
    ['q', filter.texto?.trim()],
    ['parc', filter.parcelado ? '1' : undefined],
    ['rec', filter.recorrente ? '1' : undefined],
    ['de', filter.de],
    ['ate', filter.ate],
  ]
  const params = new URLSearchParams()
  for (const [key, value] of entries) if (value !== undefined && value !== '') params.set(key, String(value))
  return params
}

/** Endereço da lista de lançamentos já com o filtro aplicado, para os atalhos das outras telas. */
export function lancamentosLink(filter: TxFilter = {}, period: Period = 'mes'): string {
  const query = filterToParams(filter, period).toString()
  return query ? `/lancamentos?${query}` : '/lancamentos'
}

/** Quantos critérios estão ativos. */
export const filterCount = (filter: TxFilter) => Object.values(filter).filter((v) => v !== undefined).length

export interface FilterContext {
  today: string
  /** Ids das formas de pagamento que são cartão de crédito. */
  creditIds: Set<string>
  /** Nome de cada categoria e subcategoria, para a busca por texto. */
  categoryNames: Map<string, string>
  /** Qual data o intervalo usa: a do vencimento (padrão) ou a da compra. */
  by?: 'vencimento' | 'compra'
}

type Filterable = Pick<
  Transaction,
  'type' | 'resgate' | 'paid' | 'date' | 'dueDate' | 'amount' | 'categoryId' | 'subcategoryId' | 'paymentMethodId' | 'description' | 'installmentGroupId' | 'recurrenceId'
>

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Diz se o lançamento passa no filtro. `shown` permite avaliar o que a linha exibe quando ela resume
 * várias parcelas (visão por data da compra): o valor total e se todas já foram confirmadas.
 */
export function matchesFilter(
  tx: Filterable,
  filter: TxFilter,
  ctx: FilterContext,
  shown: { amount: number; paid: boolean } = tx,
): boolean {
  if (filter.tipo && tx.type !== filter.tipo) return false
  if (filter.pendencia && (shown.paid || pendingKind(tx) !== filter.pendencia)) return false
  if (filter.situacao === 'confirmado' && !shown.paid) return false
  if (filter.situacao === 'pendente' && shown.paid) return false
  if (filter.situacao === 'atrasado' && (tx.paid || tx.dueDate >= ctx.today)) return false
  if (filter.categoria && tx.categoryId !== filter.categoria) return false
  if (filter.subcategoria === NO_SUB ? !!tx.subcategoryId : filter.subcategoria && tx.subcategoryId !== filter.subcategoria) {
    return false
  }
  if (filter.forma === ALL_CREDIT ? !ctx.creditIds.has(tx.paymentMethodId) : filter.forma && tx.paymentMethodId !== filter.forma) {
    return false
  }
  if (filter.min !== undefined && shown.amount < filter.min) return false
  if (filter.max !== undefined && shown.amount > filter.max) return false
  if (filter.parcelado && !tx.installmentGroupId) return false
  if (filter.recorrente && !tx.recurrenceId) return false
  const day = ctx.by === 'compra' ? tx.date : tx.dueDate
  if (filter.de && day < filter.de) return false
  if (filter.ate && day > filter.ate) return false
  if (filter.texto) {
    const haystack = [tx.description, ctx.categoryNames.get(tx.categoryId), tx.subcategoryId && ctx.categoryNames.get(tx.subcategoryId)]
    if (!plain(haystack.filter(Boolean).join(' ')).includes(plain(filter.texto))) return false
  }
  return true
}
