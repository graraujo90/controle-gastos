import { ChartColumn, CreditCard, House, List, Menu, PiggyBank, Plus, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AppContext, type AppState } from '../app/AppContext'
import type { Transaction } from '../db/types'
import { TransactionForm } from '../features/lancamentos/TransactionForm'
import { currentMonth } from '../lib/format'

// A barra inferior do celular comporta cinco itens; os demais ficam dentro de "Mais".
const NAV = [
  { to: '/', label: 'Início', icon: House, mobile: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: List, mobile: true },
  { to: '/orcamento', label: 'Orçamento', icon: PiggyBank, mobile: true },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard, mobile: false },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp, mobile: false },
  { to: '/relatorios', label: 'Relatórios', icon: ChartColumn, mobile: true },
  { to: '/mais', label: 'Mais', icon: Menu, mobile: true },
]

export function Layout() {
  const [month, setMonth] = useState(currentMonth)
  const [form, setForm] = useState<{ tx?: Transaction } | null>(null)
  const { pathname } = useLocation()
  const state = useMemo<AppState>(
    () => ({ month, setMonth, openForm: (tx) => setForm({ tx }) }),
    [month],
  )

  return (
    <AppContext.Provider value={state}>
      <div className="mx-auto flex min-h-dvh max-w-5xl">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4 md:flex">
          <div className="mb-4 px-2 text-lg font-bold">Controle de Gastos</div>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <button className="btn btn-primary mt-4" onClick={() => setForm({})}>
            <Plus size={18} /> Novo lançamento
          </button>
        </aside>

        <main className="min-w-0 flex-1 p-4 pb-28 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* Nas telas de cadastro o botão flutuante cobriria os campos de adicionar. */}
      {!pathname.startsWith('/mais/') && <button
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg md:hidden"
        onClick={() => setForm({})}
        aria-label="Novo lançamento"
      >
        <Plus size={26} />
      </button>}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((item) => item.mobile).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? 'text-slate-900' : 'text-slate-400'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      {form && <TransactionForm tx={form.tx} onClose={() => setForm(null)} />}
    </AppContext.Provider>
  )
}
