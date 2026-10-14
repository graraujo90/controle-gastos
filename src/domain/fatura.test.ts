import { describe, expect, it } from 'vitest'
import type { PaymentMethod } from '../db/types'
import { dueDateFor, invoiceMonth } from './fatura'

describe('dueDateFor', () => {
  const card = { kind: 'credito', closingDay: 25, dueDay: 5 } as PaymentMethod

  it('crédito: vencimento da fatura', () => {
    expect(dueDateFor('2026-10-09', card)).toBe('2026-11-05')
    expect(dueDateFor('2026-10-26', card)).toBe('2026-12-05')
  })

  it('compra movida para a fatura anterior ou seguinte', () => {
    // Banco fechou dia 27 em vez de 25: a compra do dia 26 ainda entrou na fatura de novembro.
    expect(dueDateFor('2026-10-26', card, -1)).toBe('2026-11-05')
    expect(dueDateFor('2026-10-24', card, 1)).toBe('2026-12-05')
  })

  it('compra movida mantém o ajuste ao mudar a data e vira o ano', () => {
    expect(dueDateFor('2026-11-24', card, 1)).toBe('2027-01-05')
    expect(dueDateFor('2026-12-26', card, -1)).toBe('2027-01-05')
  })

  it('o ajuste fica limitado a uma fatura e não vale fora do crédito', () => {
    expect(dueDateFor('2026-10-09', card, 5)).toBe('2026-12-05')
    expect(dueDateFor('2026-10-09', { kind: 'pix' } as PaymentMethod, 1)).toBe('2026-10-09')
  })

  it('demais formas: a própria data', () => {
    expect(dueDateFor('2026-10-09', { kind: 'pix' } as PaymentMethod)).toBe('2026-10-09')
    expect(dueDateFor('2026-10-09', undefined)).toBe('2026-10-09')
  })
})

describe('invoiceMonth', () => {
  it('fecha dia 25, vence dia 5: compra antes do fechamento vence no mês seguinte', () => {
    expect(invoiceMonth('2026-10-10', 25, 5)).toBe('2026-11')
    expect(invoiceMonth('2026-10-25', 25, 5)).toBe('2026-11')
  })

  it('fecha dia 25, vence dia 5: compra após o fechamento pula mais um mês', () => {
    expect(invoiceMonth('2026-10-26', 25, 5)).toBe('2026-12')
  })

  it('fecha dia 3, vence dia 10: vencimento no mesmo mês do fechamento', () => {
    expect(invoiceMonth('2026-10-02', 3, 10)).toBe('2026-10')
    expect(invoiceMonth('2026-10-04', 3, 10)).toBe('2026-11')
  })

  it('vira o ano', () => {
    expect(invoiceMonth('2026-12-04', 3, 10)).toBe('2027-01')
    expect(invoiceMonth('2026-11-26', 25, 5)).toBe('2027-01')
  })

  it('fechamento dia 31 em mês curto', () => {
    expect(invoiceMonth('2027-02-28', 31, 10)).toBe('2027-03')
  })
})
