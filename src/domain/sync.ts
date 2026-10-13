import { BACKUP_TABLES, type BackupTable } from './backup'

/** Registro de exclusão: impede que algo apagado em um aparelho volte vindo de outro. */
export interface Deletion {
  table: BackupTable
  id: string
  deletedAt: string
}

/** Linha de qualquer tabela sincronizada. Configurações usam `key` no lugar de `id`. */
export type Row = { id?: string; key?: string; updatedAt?: string } & Record<string, unknown>

export interface SyncData {
  tables: Record<BackupTable, Row[]>
  deletions: Deletion[]
}

export interface MergeResult {
  data: SyncData
  /** O resultado difere do que o aparelho tem: precisa gravar no banco local. */
  localChanged: boolean
  /** O resultado difere do que está na nuvem: precisa enviar. */
  remoteChanged: boolean
}

export const rowKey = (row: Row) => String(row.id ?? row.key)
const stamp = (row: Row | undefined) => row?.updatedAt ?? ''
const deletionKey = (d: Pick<Deletion, 'table' | 'id'>) => `${d.table}:${d.id}`

export const emptySyncData = (): SyncData => ({
  tables: Object.fromEntries(BACKUP_TABLES.map((t) => [t, [] as Row[]])) as Record<BackupTable, Row[]>,
  deletions: [],
})

/** Impressão digital do conteúdo: iguais se e só se têm os mesmos registros, versões e exclusões. */
function fingerprint(data: SyncData): string {
  const rows = BACKUP_TABLES.flatMap((t) => (data.tables[t] ?? []).map((r) => `${t}:${rowKey(r)}@${stamp(r)}`))
  const deletions = data.deletions.map((d) => `x:${deletionKey(d)}@${d.deletedAt}`)
  return [...rows, ...deletions].sort().join('|')
}

/**
 * Junta os dados do aparelho com os da nuvem, registro a registro:
 * - registro que só existe de um lado entra;
 * - nos dois lados, vale o de `updatedAt` mais recente (empate: o do aparelho);
 * - exclusão feita depois da última alteração remove o registro; alteração feita depois da exclusão o mantém.
 * Não depende da ordem: juntar A com B ou B com A dá o mesmo conteúdo.
 */
export function mergeData(local: SyncData, remote: SyncData): MergeResult {
  const deletions = new Map<string, Deletion>()
  for (const d of [...local.deletions, ...remote.deletions]) {
    const current = deletions.get(deletionKey(d))
    if (!current || d.deletedAt > current.deletedAt) deletions.set(deletionKey(d), d)
  }

  const data = emptySyncData()
  for (const table of BACKUP_TABLES) {
    const rows = new Map<string, Row>()
    for (const row of remote.tables[table] ?? []) rows.set(rowKey(row), row)
    for (const row of local.tables[table] ?? []) {
      const other = rows.get(rowKey(row))
      if (!other || stamp(row) >= stamp(other)) rows.set(rowKey(row), row)
    }
    for (const [key, row] of rows) {
      const deletion = deletions.get(deletionKey({ table, id: key }))
      if (!deletion) continue
      if (deletion.deletedAt >= stamp(row)) rows.delete(key)
      // Registro recriado ou alterado depois da exclusão: a exclusão deixa de valer.
      else deletions.delete(deletionKey(deletion))
    }
    data.tables[table] = [...rows.values()]
  }
  data.deletions = [...deletions.values()]

  const merged = fingerprint(data)
  return { data, localChanged: merged !== fingerprint(local), remoteChanged: merged !== fingerprint(remote) }
}
