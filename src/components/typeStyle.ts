import type { TxType } from '../db/types'

/**
 * Cores das séries nos gráficos. São tons diferentes dos usados em texto de propósito:
 * este trio foi validado para continuar distinguível com daltonismo (verde x vermelho).
 */
export const CHART_COLOR: Record<TxType, string> = {
  receita: '#047857',
  despesa: '#fb7185',
  investimento: '#4f46e5',
}

/** Cores fixas por tipo de lançamento, usadas em todo o app. */
export const TYPE_STYLE: Record<TxType, { text: string; bg: string; solid: string; sign: string }> = {
  receita: { text: 'text-emerald-600', bg: 'bg-emerald-50', solid: 'bg-emerald-600', sign: '+' },
  despesa: { text: 'text-rose-600', bg: 'bg-rose-50', solid: 'bg-rose-600', sign: '−' },
  investimento: { text: 'text-indigo-600', bg: 'bg-indigo-50', solid: 'bg-indigo-600', sign: '' },
}
