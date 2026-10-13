import type { Category, MethodKind, MethodUse, PaymentMethod, TxType } from './types'

export const PALETTE = [
  '#0ea5e9', '#f97316', '#8b5cf6', '#10b981', '#ef4444', '#eab308',
  '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f43f5e', '#64748b',
]

const DESPESAS: [string, string[]][] = [
  ['Moradia', ['Aluguel', 'Condomínio', 'Energia', 'Água', 'Internet']],
  ['Alimentação', ['Mercado', 'Restaurantes']],
  ['Transporte', ['Combustível', 'Manutenção', 'Apps']],
  ['Saúde', []],
  ['Educação', []],
  ['Lazer', []],
  ['Vestuário', []],
  ['Assinaturas', []],
  ['Outros', []],
]
const RECEITAS = ['Salário', 'Renda extra', 'Outras receitas']
const INVESTIMENTOS = ['Renda fixa', 'Renda variável', 'Previdência', 'Reserva de emergência']

const METHODS: [string, MethodKind, MethodUse][] = [
  ['Dinheiro', 'dinheiro', 'ambos'],
  ['Pix', 'pix', 'ambos'],
  ['Débito', 'debito', 'pagamento'],
  ['Conta corrente', 'conta', 'ambos'],
]

export function seedCategories(): Category[] {
  const now = new Date().toISOString()
  const out: Category[] = []
  let i = 0
  const add = (name: string, type: TxType, parentId: string | null, color: string) => {
    const c: Category = {
      id: crypto.randomUUID(), name, type, parentId, color, archived: false,
      createdAt: now, updatedAt: now,
    }
    out.push(c)
    return c
  }
  for (const [name, subs] of DESPESAS) {
    const parent = add(name, 'despesa', null, PALETTE[i++ % PALETTE.length])
    for (const sub of subs) add(sub, 'despesa', parent.id, parent.color)
  }
  for (const name of RECEITAS) add(name, 'receita', null, PALETTE[i++ % PALETTE.length])
  for (const name of INVESTIMENTOS) add(name, 'investimento', null, PALETTE[i++ % PALETTE.length])
  return out
}

export function seedMethods(): PaymentMethod[] {
  const now = new Date().toISOString()
  return METHODS.map(([name, kind, use]) => ({
    id: crypto.randomUUID(), name, kind, use, archived: false, createdAt: now, updatedAt: now,
  }))
}
