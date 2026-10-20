import { describe, expect, it } from 'vitest'
import { allocate, defaultPersonId, peopleSummary, peopleYear } from './pessoas'
import { summarize } from './resumo'

describe('defaultPersonId', () => {
  const adults = [{ id: 'ana' }, { id: 'pedro' }]

  it('despesa é da família', () => {
    expect(defaultPersonId('despesa', adults, 'pedro')).toBe('')
  })

  it('receita e investimento são do último adulto usado no aparelho, ou do primeiro', () => {
    expect(defaultPersonId('receita', adults, 'pedro')).toBe('pedro')
    expect(defaultPersonId('investimento', adults, null)).toBe('ana')
    // Pessoa lembrada que foi arquivada ou é dependente não vale.
    expect(defaultPersonId('receita', adults, 'filho')).toBe('ana')
  })

  it('sem adultos cadastrados, fica da família', () => {
    expect(defaultPersonId('receita', [], 'pedro')).toBe('')
  })
})

describe('análise por pessoa', () => {
  // Casal: Ana recebe R$ 6.000, Pedro R$ 4.000; o filho é dependente.
  const people = [
    { id: 'ana', kind: 'adulto' as const, archived: false },
    { id: 'pedro', kind: 'adulto' as const, archived: false },
    { id: 'filho', kind: 'dependente' as const, archived: false },
  ]
  const tx = (type: 'receita' | 'despesa' | 'investimento', amount: number, personId?: string, extra = {}) =>
    ({ type, amount, personId, month: '2026-10', ...extra })
  const month = [
    tx('receita', 600000, 'ana'),
    tx('receita', 400000, 'pedro'),
    tx('despesa', 450000), // mercado, contas: família
    tx('despesa', 50000, 'filho'), // roupa do filho: entra no bolo da família
    tx('despesa', 9000, 'ana'), // salão
    tx('investimento', 100000, 'pedro'),
  ]

  it('despesas da família divididas na proporção das receitas; saldos somam o resultado do mês', () => {
    const s = peopleSummary(month, people)
    expect(s.source).toBe('receitas')
    expect(s.family.net).toBe(500000)
    const [ana, pedro] = s.adults
    expect([ana.proportion, pedro.proportion]).toEqual([0.6, 0.4])
    expect([ana.familyPart, pedro.familyPart]).toEqual([300000, 200000])
    expect(ana.saldo).toBe(600000 - 9000 - 300000)
    expect(pedro.saldo).toBe(400000 - 100000 - 200000)
    expect(ana.saldo + pedro.saldo).toBe(summarize(month).resultado)
  })

  it('o que é do dependente aparece à parte, mas é pago pela família', () => {
    const s = peopleSummary(month, people)
    expect(s.dependents).toEqual([{ personId: 'filho', receitas: 0, despesas: 50000, investimentos: 0 }])
    expect(s.family.despesas).toBe(500000)
  })

  it('ajuste manual do mês substitui a proporção das receitas', () => {
    const s = peopleSummary(month, people, { ana: 50, pedro: 50 })
    expect(s.source).toBe('ajuste')
    expect(s.adults.map((a) => a.familyPart)).toEqual([250000, 250000])
  })

  it('sem receita de adulto no mês, partes iguais', () => {
    const s = peopleSummary([tx('despesa', 1001)], people)
    expect(s.source).toBe('iguais')
    expect(s.adults.map((a) => a.familyPart).reduce((a, b) => a + b, 0)).toBe(1001)
  })

  it('receita da família (sem pessoa) abate o bolo; minha parte e estorno valem como no resto do app', () => {
    const s = peopleSummary(
      [
        tx('receita', 100000, 'ana'),
        tx('receita', 20000), // aluguel recebido pela família
        tx('despesa', 30000, undefined, { myShare: 10000 }), // conta do bar dividida com amigos
        tx('despesa', 5000, undefined, { estorno: true }),
      ],
      people,
    )
    expect(s.family.net).toBe(10000 - 5000 - 20000)
    expect(s.adults[0].familyPart).toBe(-15000)
  })

  it('reparte centavos fechando o total, inclusive negativo', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333])
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333])
    expect(allocate(500, [0, 0])).toEqual([250, 250])
  })

  it('no ano, cada mês usa a sua proporção (e o seu ajuste)', () => {
    const november = [tx('receita', 500000, 'ana'), tx('receita', 500000, 'pedro'), tx('despesa', 100000)].map((t) => ({
      ...t,
      month: '2026-11',
    }))
    const y = peopleYear([...month, ...november], people, 2026, { '2026-11': { ana: 100, pedro: 0 } })
    const [ana, pedro] = y.adults
    expect(ana.familyPart).toBe(300000 + 100000)
    expect(pedro.familyPart).toBe(200000)
    expect(ana.saldo + pedro.saldo).toBe(summarize([...month, ...november]).resultado)
    expect(y.dependents[0].despesas).toBe(50000)
  })
})
