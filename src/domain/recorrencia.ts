import type { Recurrence } from '../db/types'
import { addDays, addMonthsToDate } from '../lib/format'

export type Frequency = Recurrence['frequency']

export const FREQUENCIES: Frequency[] = ['semanal', 'quinzenal', 'mensal']

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  semanal: 'Toda semana',
  quinzenal: 'A cada 2 semanas',
  mensal: 'Todo mês',
}

/** Recorrência sem data para acabar fica sempre lançada até esta distância à frente. */
export const HORIZON_MONTHS = 12
/** Limite de repetições com número definido, para um engano de digitação não criar milhares de lançamentos. */
export const MAX_COUNT = 120

/**
 * Data da ocorrência de número `n` (a 1ª é a própria data de início). No mensal, cada data parte
 * do dia original: dia 31 vira o último dia nos meses curtos e volta a ser 31 nos seguintes.
 */
export function occurrenceDate(start: string, frequency: Frequency, n: number): string {
  if (frequency === 'mensal') return addMonthsToDate(start, n - 1)
  return addDays(start, (frequency === 'semanal' ? 7 : 14) * (n - 1))
}

type Rule = Pick<Recurrence, 'frequency' | 'startDate' | 'count' | 'generated' | 'ended'>

/**
 * Números das ocorrências que ainda faltam criar. Com quantidade definida, todas de uma vez;
 * sem data para acabar, as que caem até HORIZON_MONTHS à frente de hoje. Nunca volta atrás de
 * `generated`, então o que foi apagado depois de criado não é recriado.
 */
export function missingOccurrences(rule: Rule, today: string): number[] {
  if (rule.ended) return []
  const out: number[] = []
  if (rule.count !== undefined) {
    for (let n = rule.generated + 1; n <= Math.min(rule.count, MAX_COUNT); n++) out.push(n)
    return out
  }
  const horizon = addMonthsToDate(today, HORIZON_MONTHS)
  for (let n = rule.generated + 1; occurrenceDate(rule.startDate, rule.frequency, n) <= horizon; n++) out.push(n)
  return out
}
