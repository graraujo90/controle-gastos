import { describe, expect, it } from 'vitest'
import { position } from './investimentos'

describe('position', () => {
  const aportes = [
    { date: '2026-07-05', amount: 100000 },
    { date: '2026-08-05', amount: 100000 },
    { date: '2026-10-05', amount: 50000 },
  ]

  it('sem saldo informado: o saldo é o que foi aportado e não há rendimento', () => {
    expect(position(aportes, [])).toEqual({ aportado: 250000, saldo: 250000, rendimento: null })
  })

  it('rendimento = saldo informado − aportes até a data do saldo', () => {
    const p = position(aportes, [{ date: '2026-09-01', amount: 206000 }])
    expect(p.rendimento).toBe(6000)
    expect(p.lastBalance).toBe(206000)
  })

  it('aportes posteriores ao saldo informado somam no saldo atual', () => {
    expect(position(aportes, [{ date: '2026-09-01', amount: 206000 }]).saldo).toBe(256000)
  })

  it('vale o saldo mais recente, independente da ordem de entrada', () => {
    const p = position(aportes, [
      { date: '2026-10-31', amount: 262000 },
      { date: '2026-09-01', amount: 206000 },
    ])
    expect(p.lastDate).toBe('2026-10-31')
    expect(p.saldo).toBe(262000)
    expect(p.rendimento).toBe(12000)
  })

  it('investimento antigo sem aportes no app: tudo aparece como rendimento', () => {
    expect(position([], [{ date: '2026-10-01', amount: 500000 }])).toMatchObject({ saldo: 500000, rendimento: 500000 })
  })

  it('resgate abate do aportado: o rendimento não piora por tirar dinheiro', () => {
    const comResgate = [...aportes, { date: '2026-11-10', amount: 100000, resgate: true }]
    // Tinha 262.000, resgatou 100.000: o banco mostra 162.000 e o rendimento segue 12.000.
    const p = position(comResgate, [{ date: '2026-11-30', amount: 162000 }])
    expect(p.aportado).toBe(150000)
    expect(p.rendimento).toBe(12000)
  })

  it('resgate lançado depois do último saldo reduz o saldo atual', () => {
    const comResgate = [...aportes, { date: '2026-11-10', amount: 100000, resgate: true }]
    expect(position(comResgate, [{ date: '2026-10-31', amount: 262000 }]).saldo).toBe(162000)
  })

  it('saldo abaixo do aportado dá rendimento negativo', () => {
    expect(position(aportes, [{ date: '2026-12-01', amount: 240000 }]).rendimento).toBe(-10000)
  })
})
