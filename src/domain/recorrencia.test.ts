import { describe, expect, it } from 'vitest'
import { missingOccurrences, occurrenceDate } from './recorrencia'

describe('occurrenceDate', () => {
  it('a primeira ocorrência é a própria data de início', () => {
    expect(occurrenceDate('2026-10-05', 'mensal', 1)).toBe('2026-10-05')
    expect(occurrenceDate('2026-10-05', 'semanal', 1)).toBe('2026-10-05')
  })

  it('mensal: mesmo dia, virando o ano', () => {
    expect(occurrenceDate('2026-10-05', 'mensal', 2)).toBe('2026-11-05')
    expect(occurrenceDate('2026-10-05', 'mensal', 4)).toBe('2027-01-05')
  })

  it('mensal no dia 31: usa o último dia nos meses curtos sem perder o 31 depois', () => {
    const dates = [1, 2, 3, 4].map((n) => occurrenceDate('2027-01-31', 'mensal', n))
    expect(dates).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'])
  })

  it('semanal e quinzenal: de 7 em 7 e de 14 em 14 dias, atravessando mês e ano', () => {
    expect(occurrenceDate('2026-12-24', 'semanal', 2)).toBe('2026-12-31')
    expect(occurrenceDate('2026-12-24', 'semanal', 3)).toBe('2027-01-07')
    expect(occurrenceDate('2026-10-26', 'quinzenal', 2)).toBe('2026-11-09')
  })
})

describe('missingOccurrences', () => {
  const rule = { frequency: 'mensal' as const, startDate: '2026-10-05', generated: 0, ended: false }

  it('com número de vezes: cria todas de uma vez', () => {
    expect(missingOccurrences({ ...rule, count: 3 }, '2026-10-13')).toEqual([1, 2, 3])
  })

  it('com número de vezes já criado: nada a fazer', () => {
    expect(missingOccurrences({ ...rule, count: 3, generated: 3 }, '2026-10-13')).toEqual([])
  })

  it('sem data para acabar: cria até 12 meses à frente de hoje', () => {
    // De 05/10/2026 até 13/10/2027: as ocorrências 1 a 13 (a 13ª cai em 05/10/2027).
    expect(missingOccurrences(rule, '2026-10-13')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it('sem data para acabar: com o passar do tempo, completa só o que falta', () => {
    expect(missingOccurrences({ ...rule, generated: 13 }, '2026-10-13')).toEqual([])
    expect(missingOccurrences({ ...rule, generated: 13 }, '2026-12-06')).toEqual([14, 15])
  })

  it('não recria o que ficou para trás: só olha depois de `generated`', () => {
    expect(missingOccurrences({ ...rule, count: 5, generated: 4 }, '2026-10-13')).toEqual([5])
  })

  it('encerrada não cria mais nada', () => {
    expect(missingOccurrences({ ...rule, ended: true }, '2026-10-13')).toEqual([])
  })

  it('semanal sem fim: um ano de semanas', () => {
    expect(missingOccurrences({ ...rule, frequency: 'semanal' }, '2026-10-05')).toHaveLength(53)
  })
})
