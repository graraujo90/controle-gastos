import { describe, expect, it } from 'vitest'
import { CATEGORY_ICONS, iconKeyFor } from './categoryIcons'

const cat = (name: string, type: 'receita' | 'despesa' | 'investimento' = 'despesa', icon?: string) => ({ name, type, icon })

describe('iconKeyFor', () => {
  it('usa o ícone escolhido', () => {
    expect(iconKeyFor(cat('Moradia', 'despesa', 'pet'))).toBe('pet')
  })

  it('sem escolha, sugere pelo nome, ignorando acentos e maiúsculas', () => {
    expect(iconKeyFor(cat('Alimentação'))).toBe('refeicao')
    expect(iconKeyFor(cat('ÁGUA'))).toBe('agua')
    expect(iconKeyFor(cat('Outras receitas', 'receita'))).toBe('moedas')
    expect(iconKeyFor(cat('Reserva de emergência', 'investimento'))).toBe('cofre')
  })

  it('nome sem sugestão cai no padrão do tipo', () => {
    expect(iconKeyFor(cat('Xyz'))).toBe('etiqueta')
    expect(iconKeyFor(cat('Xyz', 'investimento'))).toBe('investimento')
  })

  it('subcategoria herda o ícone escolhido da categoria-mãe, mas o seu próprio vence', () => {
    expect(iconKeyFor(cat('Banco A', 'investimento'), cat('Renda fixa', 'investimento', 'dolar'))).toBe('dolar')
    expect(iconKeyFor(cat('Banco A', 'investimento', 'cripto'), cat('Renda fixa', 'investimento', 'dolar'))).toBe('cripto')
  })

  it('subcategoria sem nada escolhido usa a sugestão do próprio nome antes da do nome da mãe', () => {
    expect(iconKeyFor(cat('Energia'), cat('Moradia'))).toBe('energia')
    expect(iconKeyFor(cat('Xyz'), cat('Moradia'))).toBe('casa')
  })

  it('chave gravada que não existe mais é ignorada', () => {
    expect(iconKeyFor(cat('Moradia', 'despesa', 'icone-removido'))).toBe('casa')
  })

  it('toda sugestão aponta para um ícone existente', () => {
    for (const name of ['Moradia', 'Mercado', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Salário', 'Previdência']) {
      expect(CATEGORY_ICONS[iconKeyFor(cat(name))]).toBeDefined()
    }
  })
})
