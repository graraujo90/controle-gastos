import type { Transaction } from '../db/types'

interface Words {
  /** Rótulo da caixa no formulário. */
  checkbox: string
  /** Texto de pendente ainda no prazo, seguido da data. */
  upcoming: string
  /** Texto de pendente com a data já passada, seguido da data. */
  overdue: string
  /** Ação do botão para confirmar e para desfazer. */
  confirm: string
  undo: string
}

/** Vocabulário de confirmação de cada tipo: despesa é paga, receita é recebida, investimento é aplicado ou resgatado. */
export function confirmWords(t: Pick<Transaction, 'type' | 'resgate'>): Words {
  if (t.type === 'despesa') {
    return { checkbox: 'Já paga', upcoming: 'vence', overdue: 'atrasada desde', confirm: 'Marcar como paga', undo: 'Marcar como não paga' }
  }
  if (t.type === 'receita') {
    return { checkbox: 'Já recebida', upcoming: 'prevista para', overdue: 'não recebida desde', confirm: 'Marcar como recebida', undo: 'Marcar como não recebida' }
  }
  return t.resgate
    ? { checkbox: 'Já resgatado', upcoming: 'previsto para', overdue: 'não resgatado desde', confirm: 'Marcar como resgatado', undo: 'Marcar como não resgatado' }
    : { checkbox: 'Já aplicado', upcoming: 'previsto para', overdue: 'não aplicado desde', confirm: 'Marcar como aplicado', undo: 'Marcar como não aplicado' }
}
