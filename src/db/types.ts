export type TxType = 'receita' | 'despesa' | 'investimento'

export const TX_TYPES: TxType[] = ['receita', 'despesa', 'investimento']

export const TX_LABEL: Record<TxType, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  investimento: 'Investimento',
}

export const TX_LABEL_PLURAL: Record<TxType, string> = {
  receita: 'Receitas',
  despesa: 'Despesas',
  investimento: 'Investimentos',
}

interface Base {
  id: string
  createdAt: string
  updatedAt: string
}

export interface Category extends Base {
  name: string
  type: TxType
  /** Preenchido apenas em subcategorias (existem em despesas e investimentos). */
  parentId: string | null
  color: string
  /** Chave de CATEGORY_ICONS. Ausente = ícone sugerido pelo nome (ou herdado da categoria-mãe). */
  icon?: string
  archived: boolean
}

export type MethodKind = 'dinheiro' | 'pix' | 'debito' | 'conta' | 'credito' | 'outro'
export type MethodUse = 'recebimento' | 'pagamento' | 'ambos'

export const METHOD_KIND_LABEL: Record<MethodKind, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Cartão de débito',
  conta: 'Conta bancária',
  credito: 'Cartão de crédito',
  outro: 'Outro',
}

export const METHOD_USE_LABEL: Record<MethodUse, string> = {
  ambos: 'Recebimento e pagamento',
  recebimento: 'Só recebimento',
  pagamento: 'Só pagamento',
}

/** Adulto tem saldo próprio na análise por pessoa; o que é de dependente entra no bolo da família. */
export type PersonKind = 'adulto' | 'dependente'

export const PERSON_KIND_LABEL: Record<PersonKind, string> = {
  adulto: 'Adulto',
  dependente: 'Dependente',
}

/** Pessoa do orçamento familiar. Excluir uma pessoa já usada só arquiva. */
export interface Person extends Base {
  name: string
  kind: PersonKind
  archived: boolean
}

export interface PaymentMethod extends Base {
  name: string
  kind: MethodKind
  use: MethodUse
  archived: boolean
  /** Campos de cartão de crédito (centavos / dia do mês). */
  limit?: number
  closingDay?: number
  dueDay?: number
}

export interface Transaction extends Base {
  /** Data do lançamento, 'AAAA-MM-DD'. */
  date: string
  /** Vencimento, 'AAAA-MM-DD': a data, o vencimento da fatura (crédito) ou o informado. */
  dueDate: string
  /** Mês de competência, 'AAAA-MM': sempre o mês do vencimento. */
  month: string
  /** Confirmado: despesa paga, receita recebida, investimento aplicado ou resgatado. Pendente conta como previsto. */
  paid: boolean
  /** Centavos, sempre positivo. */
  amount: number
  type: TxType
  categoryId: string
  subcategoryId: string | null
  description: string
  paymentMethodId: string
  /** Só em investimentos: true quando é um resgate (dinheiro saindo do investimento) em vez de aporte. */
  resgate?: boolean
  /** Lançamento criado por uma recorrência: a regra e o número da ocorrência. */
  recurrenceId?: string
  recurrenceNumber?: number
  installmentGroupId?: string
  installmentNumber?: number
  installmentTotal?: number
  /** Só no cartão de crédito: compra movida para a fatura anterior (−1) ou seguinte (+1). */
  invoiceShift?: number
  /**
   * Só em despesas: conta dividida. `amount` é o valor cheio (o da fatura e do extrato); a minha parte,
   * em centavos, é o que conta no orçamento. Ausente = a despesa é toda minha.
   */
  myShare?: number
  /** Só em despesas: dinheiro devolvido pelo cartão ou pela loja. Abate da fatura e do gasto do mês. */
  estorno?: boolean
  /** Compra dividida em categorias: as partes têm o mesmo grupo, data, forma e situação de pagamento. */
  splitGroupId?: string
  /** De quem é o lançamento (adulto ou dependente). Vazio = da família. */
  personId?: string
}

/**
 * Regra de um lançamento que se repete. Os lançamentos em si são criados de verdade (um por
 * ocorrência, com `recurrenceId`); a regra guarda o modelo para criar os próximos.
 */
export interface Recurrence extends Base {
  frequency: 'semanal' | 'quinzenal' | 'mensal'
  /** Data da 1ª ocorrência. */
  startDate: string
  /** Vencimento da 1ª ocorrência, quando difere da data (não se aplica a cartão de crédito). */
  startDueDate?: string
  /** Número de vezes; ausente = sem data para acabar. */
  count?: number
  /** Quantas ocorrências já foram criadas. Só cresce: o que foi apagado não é recriado. */
  generated: number
  /** Encerrada: nenhuma ocorrência nova é criada. */
  ended: boolean
  // Modelo das próximas ocorrências.
  type: TxType
  amount: number
  categoryId: string
  subcategoryId: string | null
  paymentMethodId: string
  description: string
  resgate?: boolean
  /** Conta dividida: a minha parte em cada ocorrência. */
  myShare?: number
  /** Cartão de crédito: todas as ocorrências movidas para a fatura anterior (−1) ou seguinte (+1). */
  invoiceShift?: number
  /** De quem é cada ocorrência. Vazio = da família. */
  personId?: string
}

export interface Budget extends Base {
  month: string
  categoryId: string
  limit: number
}

/** Configuração compartilhada entre os aparelhos (ex.: saldo inicial). */
export interface Setting {
  key: string
  value: unknown
  updatedAt?: string
}

/** Valor que pertence só a este aparelho (ex.: data do último backup, estado da sincronização). */
export interface LocalValue {
  key: string
  value: unknown
}
