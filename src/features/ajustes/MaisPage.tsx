import {
  Archive, ChartColumn, ChevronRight, Cloud, CreditCard, DatabaseBackup, Repeat, SunMoon, Tags, Users, Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const READY = [
  { to: '/relatorios', label: 'Relatórios', hint: 'Resumo do mês, gráficos e resumo anual mês a mês', icon: ChartColumn },
  { to: '/cartoes', label: 'Cartões e faturas', hint: 'Fatura do mês, limite usado e próximas faturas', icon: CreditCard },
  { to: '/mais/recorrencias', label: 'Recorrências', hint: 'Lançamentos que se repetem: ver e encerrar', icon: Repeat },
  { to: '/mais/pessoas', label: 'Pessoas', hint: 'Adultos e dependentes do orçamento familiar', icon: Users },
  { to: '/mais/categorias', label: 'Categorias e subcategorias', hint: 'Receitas, despesas e investimentos', icon: Tags },
  { to: '/mais/formas', label: 'Formas de recebimento e pagamento', hint: 'Contas, Pix, dinheiro e cartões de crédito', icon: Wallet },
  { to: '/mais/arquivados', label: 'Arquivados', hint: 'Restaurar categorias, formas e pessoas excluídas', icon: Archive },
  { to: '/mais/aparencia', label: 'Aparência', hint: 'Modo claro, escuro ou automático', icon: SunMoon },
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
      <p className="text-center text-xs text-slate-400">Controle de Gastos · versão {__APP_VERSION__}</p>
    </div>
  )
}
