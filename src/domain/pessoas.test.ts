import { describe, expect, it } from 'vitest'
import { defaultPersonId } from './pessoas'

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
