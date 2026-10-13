import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import { extendRecurrences } from './db/repo'
import { initTheme } from './lib/theme'
import { initSync } from './sync/engine'

initTheme()
// Recorrências sem data para acabar: mantém os próximos 12 meses lançados.
void extendRecurrences().catch((error) => console.error('Falha ao completar recorrências', error))

// A sincronização inicia antes das telas porque o retorno do login da Microsoft chega no "#" do
// endereço, o mesmo lugar que as rotas do app usam. Se falhar, o app abre normalmente, sem sincronizar.
initSync()
  .catch((error) => console.error('Falha ao iniciar a sincronização', error))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
