import { describe, expect, it } from 'vitest'
import { remaining, splitAcrossInstallments, splitError, splitSlot } from './divisao'

const part = (categoryId: string, amount: number) => ({ categoryId, subcategoryId: null, amount })

describe('divisão em categorias', () => {
  // Mercado de R$ 300: R$ 220 em Alimentação e R$ 80 em Limpeza.
  it('pronta quando as partes somam o total', () => {
    expect(splitError(30000, [part('alimentacao', 22000), part('limpeza', 8000)])).toBeNull()
  })

  it('mostra quanto falta ou quanto passou', () => {
    expect(remaining(30000, [part('alimentacao', 22000)])).toBe(8000)
    expect(remaining(30000, [part('alimentacao', 22000), part('limpeza', 9000)])).toBe(-1000)
  })

  it('não salva com soma diferente do total', () => {
    expect(splitError(30000, [part('alimentacao', 22000), part('limpeza', 7000)])).toMatch(/falta/)
    expect(splitError(30000, [part('alimentacao', 22000), part('limpeza', 9000)])).toMatch(/mais/)
  })

  it('exige duas partes, categoria e valor em cada uma', () => {
    expect(splitError(30000, [part('alimentacao', 30000)])).toMatch(/duas/)
    expect(splitError(30000, [part('alimentacao', 22000), part('', 8000)])).toMatch(/categoria/)
    expect(splitError(30000, [part('alimentacao', 30000), part('limpeza', 0)])).toMatch(/valor/)
  })
})

describe('divisão em parcelas', () => {
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)

  it('geladeira de R$ 3.000 em 10×: R$ 2.000 da família e R$ 1.000 do marido', () => {
    const parcels = Array(10).fill(30000)
    const [family, husband] = splitAcrossInstallments(parcels, [200000, 100000])
    expect(family).toEqual(Array(10).fill(20000))
    expect(husband).toEqual(Array(10).fill(10000))
  })

  it('centavos: cada parcela fecha com a fatura e cada parte fecha com o seu total', () => {
    // R$ 1.000,00 em 3× (333,34 + 333,33 + 333,33), dividido em 3 partes desiguais.
    const parcels = [33334, 33333, 33333]
    const totals = [50001, 29999, 20000]
    const byPart = splitAcrossInstallments(parcels, totals)
    byPart.forEach((amounts, k) => expect(sum(amounts)).toBe(totals[k]))
    parcels.forEach((parcel, j) => expect(sum(byPart.map((amounts) => amounts[j]))).toBe(parcel))
    expect(byPart.flat().every((a) => a >= 0)).toBe(true)
  })

  it('recusa partes que não somam o total', () => {
    expect(() => splitAcrossInstallments([1000, 1000], [1500, 400])).toThrow()
  })

  it('a vez de cada parte: a parcela, ou a data', () => {
    expect(splitSlot({ installmentNumber: 3, date: '2026-10-10' })).toBe('parcela 3')
    expect(splitSlot({ date: '2026-10-10' })).toBe('2026-10-10')
  })
})
