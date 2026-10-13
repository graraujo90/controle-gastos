import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { db } from '../../db/db'
import { exportAll, importAll, LAST_BACKUP, resetAll } from '../../db/repo'
import { parseBackup } from '../../domain/backup'
import { disconnect, isConnected, replaceRemote } from '../../sync/engine'
import { BackLink } from './BackLink'

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function BackupPage() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const last = useLiveQuery(() => db.local.get(LAST_BACKUP), [])
  const count = useLiveQuery(() => db.transactions.count(), [])

  async function download() {
    const backup = await exportAll()
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `controle-gastos-${backup.exportedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage({ ok: true, text: 'Backup gerado. Guarde o arquivo em um lugar seguro, como o OneDrive ou o e-mail.' })
  }

  async function restore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      const when = backup.exportedAt ? ` de ${dateTime(backup.exportedAt)}` : ''
      const total = backup.data.transactions.length
      const scope = isConnected()
        ? 'Todos os dados atuais serão substituídos, neste aparelho, no OneDrive e nos outros aparelhos conectados.'
        : 'Todos os dados atuais deste aparelho serão substituídos.'
      if (!confirm(`Restaurar o backup${when}, com ${total} lançamentos?\n\n${scope}`)) return
      await importAll(backup)
      await replaceRemote()
      setMessage({ ok: true, text: `Backup restaurado: ${total} lançamentos.` })
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível restaurar o backup.' })
    }
  }

  async function reset() {
    if (!confirm('Apagar TODOS os lançamentos, categorias, formas, orçamentos e saldos deste aparelho?\n\nIsso não pode ser desfeito. Faça um backup antes se tiver dúvida.')) return
    // Apagar é só neste aparelho: desconecta antes, senão a sincronização traria tudo de volta.
    const wasConnected = isConnected()
    await disconnect()
    await resetAll()
    setMessage({
      ok: true,
      text: wasConnected
        ? 'Dados apagados neste aparelho, que foi desconectado da sincronização. O que está no OneDrive não foi alterado.'
        : 'Dados apagados. O app voltou aos cadastros iniciais.',
    })
  }

  return (
    <div className="space-y-4">
      <BackLink title="Backup dos dados" />
      <p className="text-sm text-slate-500">
        Seus dados ficam guardados só neste aparelho, dentro do navegador. O backup gera um arquivo com tudo, para você
        guardar em outro lugar ou levar para outro aparelho.
      </p>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message.text}
        </p>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Fazer backup</h2>
        <p className="text-sm text-slate-500">
          {count ?? 0} lançamentos neste aparelho.{' '}
          {typeof last?.value === 'string' ? `Último backup em ${dateTime(last.value)}.` : 'Nenhum backup feito ainda.'}
        </p>
        <button className="btn btn-primary" onClick={download}>
          <Download size={16} /> Baixar arquivo de backup
        </button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Restaurar backup</h2>
        <p className="text-sm text-slate-500">
          Escolha um arquivo de backup. Os dados atuais deste aparelho são substituídos pelos do arquivo.
        </p>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={restore} />
        <button className="btn btn-ghost ring-1 ring-slate-300" onClick={() => fileInput.current?.click()}>
          <Upload size={16} /> Escolher arquivo
        </button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Apagar tudo e recomeçar</h2>
        <p className="text-sm text-slate-500">
          Remove todos os dados deste aparelho e volta aos cadastros iniciais. Use para limpar dados de teste antes de
          começar a usar de verdade.
        </p>
        <button className="btn btn-danger ring-1 ring-rose-200" onClick={reset}>
          <Trash2 size={16} /> Apagar todos os dados
        </button>
      </section>
    </div>
  )
}
