import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ArquivadosPage } from './features/ajustes/ArquivadosPage'
import { BackupPage } from './features/ajustes/BackupPage'
import { CategoriasPage } from './features/ajustes/CategoriasPage'
import { FormasPage } from './features/ajustes/FormasPage'
import { MaisPage } from './features/ajustes/MaisPage'
import { SincronizacaoPage } from './features/ajustes/SincronizacaoPage'
import { CartoesPage } from './features/cartoes/CartoesPage'
import { InicioPage } from './features/inicio/InicioPage'
import { LancamentosPage } from './features/lancamentos/LancamentosPage'
import { OrcamentoPage } from './features/orcamento/OrcamentoPage'

// Os gráficos pesam metade do app; carregam só quando a tela de relatórios é aberta.
const RelatoriosPage = lazy(() =>
  import('./features/relatorios/RelatoriosPage').then((m) => ({ default: m.RelatoriosPage })),
)

const loading = <p className="p-8 text-center text-sm text-slate-500">Carregando…</p>

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="lancamentos" element={<LancamentosPage />} />
          <Route path="orcamento" element={<OrcamentoPage />} />
          <Route path="cartoes" element={<CartoesPage />} />
          <Route path="relatorios" element={<Suspense fallback={loading}><RelatoriosPage /></Suspense>} />
          <Route path="mais" element={<MaisPage />} />
          <Route path="mais/categorias" element={<CategoriasPage />} />
          <Route path="mais/formas" element={<FormasPage />} />
          <Route path="mais/arquivados" element={<ArquivadosPage />} />
          <Route path="mais/backup" element={<BackupPage />} />
          <Route path="mais/sincronizacao" element={<SincronizacaoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
