import { describe, expect, it } from 'vitest'
import { remaining, splitError } from './divisao'

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
