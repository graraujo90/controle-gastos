import { describe, expect, it } from 'vitest'
import {
  ALL_CREDIT, filterCount, filterToParams, lancamentosLink, matchesFilter, NO_SUB, parseFilter, parsePeriod,
  type FilterContext, type TxFilter,
} from './filtro'

const ctx: FilterContext = {
  today: '2026-10-13',
  creditIds: new Set(['nubank', 'itau']),
  categoryNames: new Map([['moradia', 'Moradia'], ['aluguel', 'Aluguel'], ['alim', 'Alimentação'], ['salario', 'Salário']]),
}

const tx = (over: Partial<Parameters<typeof matchesFilter>[0]> = {}) => ({
  type: 'despesa' as const,
  paid: true,
  date: '2026-09-28',
  dueDate: '2026-10-05',
  amount: 10000,
  categoryId: 'moradia',
  subcategoryId: null,
  paymentMethodId: 'pix',
  description: '',
  ...over,
})
const pass = (t: ReturnType<typeof tx>, f: TxFilter) => matchesFilter(t, f, ctx)

describe('matchesFilter', () => {
  it('sem critérios passa tudo', () => {
    expect(pass(tx(), {})).toBe(true)
  })

  it('tipo', () => {
    expect(pass(tx(), { tipo: 'despesa' })).toBe(true)
    expect(pass(tx(), { tipo: 'receita' })).toBe(false)
  })

  it('pendência: só não confirmados, na direção certa; resgate pendente é "a receber"', () => {
    expect(pass(tx({ paid: false }), { pendencia: 'pagar' })).toBe(true)
    expect(pass(tx({ paid: true }), { pendencia: 'pagar' })).toBe(false)
    expect(pass(tx({ type: 'receita', paid: false }), { pendencia: 'pagar' })).toBe(false)
    expect(pass(tx({ type: 'investimento', paid: false, resgate: true }), { pendencia: 'receber' })).toBe(true)
    expect(pass(tx({ type: 'investimento', paid: false }), { pendencia: 'investir' })).toBe(true)
  })

  it('situação: confirmado, pendente e em atraso (vencido e não confirmado)', () => {
    expect(pass(tx(), { situacao: 'confirmado' })).toBe(true)
    expect(pass(tx({ paid: false }), { situacao: 'confirmado' })).toBe(false)
    expect(pass(tx({ paid: false }), { situacao: 'pendente' })).toBe(true)
    expect(pass(tx({ paid: false, dueDate: '2026-10-12' }), { situacao: 'atrasado' })).toBe(true)
    expect(pass(tx({ paid: false, dueDate: '2026-10-13' }), { situacao: 'atrasado' })).toBe(false)
    expect(pass(tx({ paid: true, dueDate: '2026-09-01' }), { situacao: 'atrasado' })).toBe(false)
  })

  it('categoria e subcategoria, incluindo "sem subcategoria"', () => {
    expect(pass(tx(), { categoria: 'moradia' })).toBe(true)
    expect(pass(tx(), { categoria: 'alim' })).toBe(false)
    expect(pass(tx({ subcategoryId: 'aluguel' }), { subcategoria: 'aluguel' })).toBe(true)
    expect(pass(tx(), { subcategoria: 'aluguel' })).toBe(false)
    expect(pass(tx(), { subcategoria: NO_SUB })).toBe(true)
    expect(pass(tx({ subcategoryId: 'aluguel' }), { subcategoria: NO_SUB })).toBe(false)
  })

  it('forma de pagamento: uma forma, ou todos os cartões de crédito', () => {
    expect(pass(tx(), { forma: 'pix' })).toBe(true)
    expect(pass(tx({ paymentMethodId: 'nubank' }), { forma: 'pix' })).toBe(false)
    expect(pass(tx({ paymentMethodId: 'nubank' }), { forma: ALL_CREDIT })).toBe(true)
    expect(pass(tx({ paymentMethodId: 'itau' }), { forma: ALL_CREDIT })).toBe(true)
    expect(pass(tx(), { forma: ALL_CREDIT })).toBe(false)
  })

  it('faixa de valor, com os limites incluídos', () => {
    expect(pass(tx(), { min: 10000, max: 10000 })).toBe(true)
    expect(pass(tx(), { min: 10001 })).toBe(false)
    expect(pass(tx(), { max: 9999 })).toBe(false)
  })

  it('texto: descrição, categoria ou subcategoria, sem diferenciar acento e maiúscula', () => {
    expect(pass(tx({ description: 'Padaria do Zé' }), { texto: 'ze' })).toBe(true)
    expect(pass(tx({ categoryId: 'alim' }), { texto: 'alimentacao' })).toBe(true)
    expect(pass(tx({ subcategoryId: 'aluguel' }), { texto: 'ALUG' })).toBe(true)
    expect(pass(tx(), { texto: 'farmácia' })).toBe(false)
  })

  it('só parceladas', () => {
    expect(pass(tx({ installmentGroupId: 'g1' }), { parcelado: true })).toBe(true)
    expect(pass(tx(), { parcelado: true })).toBe(false)
  })

  it('só recorrentes', () => {
    expect(pass(tx({ recurrenceId: 'r1' }), { recorrente: true })).toBe(true)
    expect(pass(tx(), { recorrente: true })).toBe(false)
  })

  it('critérios se somam', () => {
    const f: TxFilter = { tipo: 'despesa', categoria: 'moradia', forma: 'pix', min: 5000 }
    expect(pass(tx(), f)).toBe(true)
    expect(pass(tx({ amount: 4000 }), f)).toBe(false)
    expect(pass(tx({ paymentMethodId: 'nubank' }), f)).toBe(false)
  })

  it('linha que resume uma compra parcelada: vale o total e se todas as parcelas foram confirmadas', () => {
    const first = tx({ amount: 6000, paid: true, installmentGroupId: 'g1' })
    const shown = { amount: 18000, paid: false }
    expect(matchesFilter(first, { min: 15000 }, ctx, shown)).toBe(true)
    expect(matchesFilter(first, { pendencia: 'pagar' }, ctx, shown)).toBe(true)
    expect(matchesFilter(first, { situacao: 'confirmado' }, ctx, shown)).toBe(false)
  })
})

describe('filtro no endereço', () => {
  const full: TxFilter = {
    tipo: 'despesa', pendencia: 'pagar', situacao: 'atrasado', categoria: 'moradia', subcategoria: NO_SUB,
    forma: ALL_CREDIT, min: 1000, max: 50000, texto: 'mercado', parcelado: true, recorrente: true,
  }

  it('o que é gravado volta igual ao ler', () => {
    expect(parseFilter(filterToParams(full))).toEqual(full)
    expect(parsePeriod(filterToParams(full, 'ano'))).toBe('ano')
    expect(parsePeriod(filterToParams(full))).toBe('mes')
  })

  it('filtro vazio não põe nada no endereço', () => {
    expect(filterToParams({}).toString()).toBe('')
    expect(lancamentosLink()).toBe('/lancamentos')
    expect(filterCount(parseFilter(new URLSearchParams()))).toBe(0)
  })

  it('valores inválidos no endereço são ignorados', () => {
    const f = parseFilter(new URLSearchParams('tipo=xyz&pend=nada&sit=talvez&min=abc&max=-5&parc=sim'))
    expect(filterCount(f)).toBe(0)
  })

  it('monta o endereço dos atalhos', () => {
    expect(lancamentosLink({ tipo: 'receita' })).toBe('/lancamentos?tipo=receita')
    expect(lancamentosLink({ tipo: 'despesa', categoria: 'c1' }, 'ano')).toBe('/lancamentos?periodo=ano&tipo=despesa&cat=c1')
  })

  it('conta os critérios ativos', () => {
    expect(filterCount({ tipo: 'despesa', min: 100 })).toBe(2)
  })
})

describe('intervalo de datas', () => {
  // Compra em 28/09, vencimento (fatura) em 05/10.
  it('usa o vencimento por padrão, com as duas pontas incluídas', () => {
    expect(pass(tx(), { de: '2026-10-01', ate: '2026-10-05' })).toBe(true)
    expect(pass(tx(), { de: '2026-10-06' })).toBe(false)
    expect(pass(tx(), { ate: '2026-10-04' })).toBe(false)
  })

  it('na visão por data da compra, usa a data da compra', () => {
    const byPurchase = { ...ctx, by: 'compra' as const }
    expect(matchesFilter(tx(), { de: '2026-09-01', ate: '2026-09-30' }, byPurchase)).toBe(true)
    expect(matchesFilter(tx(), { de: '2026-10-01' }, byPurchase)).toBe(false)
  })

  it('vai e volta pelo endereço; datas inválidas são ignoradas e trocadas são desinvertidas', () => {
    const params = filterToParams({ de: '2026-09-01', ate: '2026-10-15' })
    expect(params.toString()).toBe('de=2026-09-01&ate=2026-10-15')
    expect(parseFilter(params)).toMatchObject({ de: '2026-09-01', ate: '2026-10-15' })
    expect(parseFilter(new URLSearchParams('de=ontem&ate=2026-10-15')).de).toBeUndefined()
    expect(parseFilter(new URLSearchParams('de=2026-10-15&ate=2026-09-01'))).toMatchObject({ de: '2026-09-01', ate: '2026-10-15' })
  })
})
