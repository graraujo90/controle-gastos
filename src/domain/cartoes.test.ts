import { describe, expect, it } from 'vitest'
import { invoicesByMonth } from './cartoes'

describe('invoicesByMonth', () => {
  it('soma por mês de vencimento e ordena da mais antiga para a mais nova', () => {
    const invoices = invoicesByMonth([
      { month: '2026-12', amount: 5000, paid: false },
      { month: '2026-11', amount: 10000, paid: true },
      { month: '2026-11', amount: 2500, paid: true },
    ])
    expect(invoices).toEqual([
      { month: '2026-11', total: 12500, count: 2, paid: true },
      { month: '2026-12', total: 5000, count: 1, paid: false },
    ])
  })

  it('fatura com algum lançamento em aberto não está paga', () => {
    const [invoice] = invoicesByMonth([
      { month: '2026-11', amount: 100, paid: true },
      { month: '2026-11', amount: 200, paid: false },
    ])
    expect(invoice.paid).toBe(false)
  })
})

describe('fatura com conta dividida e estorno', () => {
  it('soma o valor cheio e abate o estorno', () => {
    const [invoice] = invoicesByMonth([
      { month: '2026-11', amount: 30000, paid: false }, // conta dividida: a fatura cobra o cheio
      { month: '2026-11', amount: 5000, estorno: true, paid: false },
    ])
    expect(invoice.total).toBe(25000)
  })
})
