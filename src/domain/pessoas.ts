// Pessoas do orçamento familiar: de quem é cada lançamento e quanto cada adulto contribui.
import type { Person, Transaction, TxType } from '../db/types'
import { counted, type Counted } from './resumo'

/** Valor de `pessoa` no filtro para "lançamentos da família" (sem pessoa). */
export const FAMILY = 'familia'

/**
 * De quem é um lançamento novo, quando a pessoa ainda não escolheu: despesa é da família; receita e
 * investimento são de um adulto, o último escolhido neste aparelho (cada celular aprende o seu dono)
 * ou o primeiro adulto. Sem adultos cadastrados, tudo fica da família ('').
 */
export function defaultPersonId(type: TxType, adults: Pick<Person, 'id'>[], lastUsed?: string | null): string {
  if (type === 'despesa' || adults.length === 0) return ''
  return adults.some((p) => p.id === lastUsed) ? lastUsed! : adults[0].id
}

/** Ajuste manual da proporção de um mês: percentual de cada adulto (somam 100). */
export type ShareOverride = Record<string, number>

/** Chave em `settings` do ajuste manual da proporção de um mês ('AAAA-MM'). */
export const shareOverrideKey = (month: string) => `proporcao:${month}`

export interface Totals {
  receitas: number
  despesas: number
  investimentos: number
}

export interface AdultShare extends Totals {
  personId: string
  /** Peso do adulto na divisão das despesas da família (0 a 1). */
  proportion: number
  /** Parte do adulto no bolo da família, em centavos. */
  familyPart: number
  /** receitas − despesas − investimentos − parte na família. */
  saldo: number
}

export interface PeopleSummary {
  adults: AdultShare[]
  /** O que é de cada dependente (já incluído no bolo da família). */
  dependents: (Totals & { personId: string })[]
  /** Família e dependentes; `net` = despesas + investimentos − receitas, dividido entre os adultos. */
  family: Totals & { net: number }
  /** De onde veio a proporção: receitas dos adultos, ajuste manual ou partes iguais (sem receita). */
  source: 'receitas' | 'ajuste' | 'iguais'
}

type Tx = Counted & Pick<Transaction, 'personId'>

const zero = (): Totals => ({ receitas: 0, despesas: 0, investimentos: 0 })

function add(totals: Totals, t: Tx) {
  const value = counted(t)
  if (t.type === 'receita') totals.receitas += value
  else if (t.type === 'despesa') totals.despesas += value
  else totals.investimentos += value
}

/** Reparte um valor em centavos pelos pesos, fechando o total (os centavos vão para as maiores frações). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const w = sum > 0 ? weights : weights.map(() => 1)
  const whole = sum > 0 ? sum : w.length
  const abs = Math.abs(total)
  const ideal = w.map((x) => (abs * x) / whole)
  const parts = ideal.map(Math.floor)
  let cents = abs - parts.reduce((a, b) => a + b, 0)
  const order = ideal.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (cents === 0) break
    parts[i]++
    cents--
  }
  return parts.map((p) => (total < 0 ? -p : p))
}

/**
 * Análise de um período (normalmente um mês): cada adulto com o que é dele e a sua parte no bolo da
 * família, na proporção das receitas dos adultos (ou do ajuste manual; sem receita, partes iguais).
 * A soma dos saldos dos adultos é igual ao resultado do período.
 */
export function peopleSummary(
  transactions: Tx[],
  people: Pick<Person, 'id' | 'kind' | 'archived'>[],
  override?: ShareOverride | null,
): PeopleSummary {
  const byId = new Map(people.map((p) => [p.id, p]))
  const used = new Set(transactions.map((t) => t.personId).filter(Boolean))
  // Adultos ativos, e os arquivados que ainda têm lançamentos no período.
  const adults = people.filter((p) => p.kind === 'adulto' && (!p.archived || used.has(p.id)))
  const own = new Map(adults.map((p) => [p.id, zero()]))
  const deps = new Map<string, Totals>()
  const family = zero()

  for (const t of transactions) {
    const person = t.personId ? byId.get(t.personId) : undefined
    const adult = person?.kind === 'adulto' ? own.get(person.id) : undefined
    if (adult) {
      add(adult, t)
      continue
    }
    add(family, t)
    if (person?.kind === 'dependente') {
      if (!deps.has(person.id)) deps.set(person.id, zero())
      add(deps.get(person.id)!, t)
    }
  }

  const net = family.despesas + family.investimentos - family.receitas
  const manual = override ? adults.map((p) => Math.max(0, override[p.id] ?? 0)) : []
  const incomes = adults.map((p) => own.get(p.id)!.receitas)
  const source: PeopleSummary['source'] = manual.some((w) => w > 0)
    ? 'ajuste'
    : incomes.some((r) => r > 0)
      ? 'receitas'
      : 'iguais'
  const weights = source === 'ajuste' ? manual : source === 'receitas' ? incomes.map((r) => Math.max(0, r)) : adults.map(() => 1)
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const parts = allocate(net, weights)

  return {
    adults: adults.map((p, i) => {
      const t = own.get(p.id)!
      return {
        personId: p.id,
        ...t,
        proportion: weightSum > 0 ? weights[i] / weightSum : 0,
        familyPart: parts[i],
        saldo: t.receitas - t.despesas - t.investimentos - parts[i],
      }
    }),
    dependents: [...deps].map(([personId, t]) => ({ personId, ...t })),
    family: { ...family, net },
    source,
  }
}

/**
 * O ano somando os meses, cada um com a sua proporção (e o seu ajuste manual, se houver). A proporção
 * anual de cada adulto é a parte dele no bolo da família do ano.
 */
export function peopleYear(
  transactions: (Tx & Pick<Transaction, 'month'>)[],
  people: Pick<Person, 'id' | 'kind' | 'archived'>[],
  year: number,
  overrides: Record<string, ShareOverride | undefined> = {},
): PeopleSummary {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const inYear = transactions.filter((t) => t.month.startsWith(`${year}-`))
  const monthly = months.map((m) => peopleSummary(inYear.filter((t) => t.month === m), people, overrides[m]))
  const yearAdults = peopleSummary(inYear, people).adults.map((a) => a.personId)

  const family = { ...zero(), net: 0 }
  const adults = new Map(yearAdults.map((id) => [id, { personId: id, ...zero(), proportion: 0, familyPart: 0, saldo: 0 }]))
  const dependents = new Map<string, Totals & { personId: string }>()
  for (const s of monthly) {
    family.receitas += s.family.receitas
    family.despesas += s.family.despesas
    family.investimentos += s.family.investimentos
    family.net += s.family.net
    for (const a of s.adults) {
      const sum = adults.get(a.personId)
      if (!sum) continue
      sum.receitas += a.receitas
      sum.despesas += a.despesas
      sum.investimentos += a.investimentos
      sum.familyPart += a.familyPart
      sum.saldo += a.saldo
    }
    for (const d of s.dependents) {
      const sum = dependents.get(d.personId) ?? { personId: d.personId, ...zero() }
      sum.receitas += d.receitas
      sum.despesas += d.despesas
      sum.investimentos += d.investimentos
      dependents.set(d.personId, sum)
    }
  }
  const list = [...adults.values()].map((a) => ({ ...a, proportion: family.net !== 0 ? a.familyPart / family.net : 0 }))
  const source = monthly.some((s) => s.source === 'ajuste') ? 'ajuste' : 'receitas'
  return { adults: list, dependents: [...dependents.values()], family, source }
}
