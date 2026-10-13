import { ChartColumn, CreditCard, House, List, Menu, PiggyBank, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AppContext, type AppState } from '../app/AppContext'
import type { Transaction } from '../db/types'
import { SyncBadge } from './SyncBadge'
import { TransactionForm } from '../features/lancamentos/TransactionForm'
import { currentMonth } from '../lib/format'

// No celular a barra inferior tem dois itens de cada lado do botão de novo lançamento, para ele ficar
// exatamente no centro; o que não cabe ali fica dentro de "Mais".
const NAV = [
  { to: '/', label: 'Início', icon: House, mobile: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: List, mobile: true },
  { to: '/orcamento', label: 'Orçamento', icon: PiggyBank, mobile: true },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard, mobile: false },
  { to: '/relatorios', label: 'Relatórios', icon: ChartColumn, mobile: false },
  { to: '/mais', label: 'Mais', icon: Menu, mobile: true },
]
const MOBILE_NAV = NAV.filter((item) => item.mobile)

function MobileItem({ to, label, icon: Icon }: (typeof NAV)[number]) {
  const { pathname } = useLocation()
  // Telas que no celular ficam dentro de "Mais" (Relatórios, Cartões) mantêm "Mais" aceso.
  const insideMore = to === '/mais' && NAV.some((item) => !item.mobile && pathname.startsWith(item.to))
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
          isActive || insideMore ? 'text-slate-900' : 'text-slate-400'
        }`
      }
    >
      <Icon size={20} />
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  )
}

export function Layout() {
  const [month, setMonth] = useState(currentMonth)
  const [form, setForm] = useState<{ tx?: Transaction } | null>(null)
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
          <SyncBadge className="mt-auto px-2" />
        </aside>

        <main className="min-w-0 flex-1 p-4 pb-24 md:p-8">
          <SyncBadge className="mb-2 justify-end md:hidden" />
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_NAV.slice(0, 2).map((item) => (
          <MobileItem key={item.to} {...item} />
        ))}
        {/* O "+" mora na barra, no centro, para nunca cobrir o conteúdo que rola. */}
        <div className="flex flex-1 items-center justify-center">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-md"
            onClick={() => setForm({})}
            aria-label="Novo lançamento"
          >
            <Plus size={24} />
          </button>
        </div>
        {MOBILE_NAV.slice(2).map((item) => (
          <MobileItem key={item.to} {...item} />
        ))}
      </nav>

      {form && <TransactionForm tx={form.tx} onClose={() => setForm(null)} />}
    </AppContext.Provider>
  )
}
