import { createContext, useContext } from 'react'
import type { Transaction } from '../db/types'

export interface AppState {
  /** Mês em exibição, 'AAAA-MM'. */
  month: string
  setMonth: (month: string) => void
  /** Abre o formulário de lançamento (novo, ou edição quando recebe um lançamento). */
  openForm: (tx?: Transaction) => void
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp fora do AppContext')
  return ctx
}
