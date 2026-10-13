import type { TxType } from '../db/types'
import type { Theme } from '../lib/theme'

/** Cores que os gráficos precisam em código (o Recharts não lê as classes do Tailwind). */
export interface ChartTheme {
  /** Uma cor por tipo de lançamento. */
  series: Record<TxType, string>
  /** Linha do resultado acumulado. */
  result: string
  grid: string
  axis: string
  tick: string
  /** Realce da coluna sob o cursor. */
  cursor: string
  tooltip: { background: string; border: string; color: string }
}

/**
 * As cores das séries são tons diferentes dos usados em texto de propósito: cada trio foi validado,
 * contra o fundo do seu tema, para continuar distinguível com daltonismo (verde x vermelho).
 * Não troque sem validar de novo.
 */
export const CHART_THEME: Record<Theme, ChartTheme> = {
  light: {
    series: { receita: '#047857', despesa: '#fb7185', investimento: '#4f46e5' },
    result: '#0f172a',
    grid: '#e2e8f0',
    axis: '#cbd5e1',
    tick: '#64748b',
    cursor: '#f1f5f9',
    tooltip: { background: '#ffffff', border: '#e2e8f0', color: '#0f172a' },
  },
  dark: {
    series: { receita: '#10a878', despesa: '#c81e4a', investimento: '#7477f3' },
    result: '#f1f5f9',
    grid: '#27344d',
    axis: '#3a4762',
    tick: '#94a3b8',
    cursor: '#1c2740',
    tooltip: { background: '#172033', border: '#3a4762', color: '#f1f5f9' },
  },
}

/** Cores fixas por tipo de lançamento, usadas em todo o app. */
export const TYPE_STYLE: Record<TxType, { text: string; bg: string; solid: string; sign: string }> = {
  receita: { text: 'text-emerald-600', bg: 'bg-emerald-50', solid: 'bg-emerald-600', sign: '+' },
  despesa: { text: 'text-rose-600', bg: 'bg-rose-50', solid: 'bg-rose-600', sign: '−' },
  investimento: { text: 'text-indigo-600', bg: 'bg-indigo-50', solid: 'bg-indigo-600', sign: '' },
}
