import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from './backup'

const data = {
  categories: [{ id: 'c1', name: 'Moradia' }],
  paymentMethods: [{ id: 'm1', name: 'Pix' }],
  people: [{ id: 'p1', name: 'Ana', kind: 'adulto' }],
  transactions: [{ id: 't1', amount: 1000, personId: 'p1' }],
  budgets: [],
  recurrences: [{ id: 'r1', frequency: 'mensal' }],
  settings: [{ key: 'saldoInicial', value: 5000 }],
}

describe('backup', () => {
  it('o que é exportado volta igual ao importar', () => {
    const text = JSON.stringify(buildBackup(data, '2026-10-13T12:00:00.000Z'))
    expect(parseBackup(text).data).toEqual(data)
  })

  it('tabela ausente em backup antigo entra vazia', () => {
    const { budgets: _omit, ...older } = data
    const text = JSON.stringify({ app: 'controle-gastos', format: 1, exportedAt: '', data: older })
    expect(parseBackup(text).data.budgets).toEqual([])
  })

  it('ignora tabelas que o app não usa mais (saldos de investimento de backups antigos)', () => {
    const text = JSON.stringify(buildBackup({ ...data, balances: [{ id: 'b1' }] } as typeof data, ''))
    expect(Object.keys(parseBackup(text).data)).not.toContain('balances')
  })

  it('lê backup do formato anterior, sem recorrências', () => {
    const { recurrences: _omit, ...older } = data
    const text = JSON.stringify({ app: 'controle-gastos', format: 1, exportedAt: '', data: older })
    expect(parseBackup(text).data.recurrences).toEqual([])
    expect(parseBackup(text).data.transactions).toEqual(data.transactions)
  })

  it('lê backup do formato 2, sem pessoas', () => {
    const { people: _omit, ...older } = data
    const text = JSON.stringify({ app: 'controle-gastos', format: 2, exportedAt: '', data: older })
    expect(parseBackup(text).data.people).toEqual([])
  })

  it('recusa arquivo que não é JSON', () => {
    expect(() => parseBackup('não é json')).toThrow(/não é um backup válido/)
  })

  it('recusa JSON de outra origem', () => {
    expect(() => parseBackup('{"foo": 1}')).toThrow(/não é um backup do Controle de Gastos/)
    expect(() => parseBackup('null')).toThrow(/não é um backup do Controle de Gastos/)
  })

  it('recusa formato mais novo', () => {
    const text = JSON.stringify({ ...buildBackup(data, ''), format: 99 })
    expect(() => parseBackup(text)).toThrow(/versão mais nova/)
  })

  it('recusa tabela corrompida e backup sem categorias', () => {
    const broken = JSON.stringify(buildBackup({ ...data, transactions: ['x'] as unknown[] }, ''))
    expect(() => parseBackup(broken)).toThrow(/corrompido/)
    const empty = JSON.stringify(buildBackup({ ...data, categories: [] }, ''))
    expect(() => parseBackup(empty)).toThrow(/vazio/)
  })
})
