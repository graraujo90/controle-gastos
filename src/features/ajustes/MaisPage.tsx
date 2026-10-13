import { Archive, ChevronRight, Cloud, CreditCard, DatabaseBackup, Tags, TrendingUp, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

const READY = [
  { to: '/cartoes', label: 'Cartões e faturas', hint: 'Fatura do mês, limite usado e próximas faturas', icon: CreditCard },
  { to: '/investimentos', label: 'Investimentos', hint: 'Valores aportados por mês, ano e categoria', icon: TrendingUp },
  { to: '/mais/categorias', label: 'Categorias e subcategorias', hint: 'Receitas, despesas e investimentos', icon: Tags },
  { to: '/mais/formas', label: 'Formas de recebimento e pagamento', hint: 'Contas, Pix, dinheiro e cartões de crédito', icon: Wallet },
  { to: '/mais/arquivados', label: 'Arquivados', hint: 'Restaurar categorias e formas excluídas', icon: Archive },
  { to: '/mais/sincronizacao', label: 'Sincronização', hint: 'Mesmos dados em todos os aparelhos, pelo OneDrive', icon: Cloud },
  { to: '/mais/backup', label: 'Backup dos dados', hint: 'Salvar em arquivo, restaurar ou apagar tudo', icon: DatabaseBackup },
]

export function MaisPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mais</h1>
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {READY.map(({ to, label, hint, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
            <Icon size={20} className="text-slate-500" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-slate-500">{hint}</span>
            </span>
            <ChevronRight size={18} className="text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
