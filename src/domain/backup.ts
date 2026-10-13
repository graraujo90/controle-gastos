/** Tabelas que entram no arquivo de backup, na ordem em que são gravadas. */
export const BACKUP_TABLES = ['categories', 'paymentMethods', 'transactions', 'budgets', 'balances', 'settings'] as const
export type BackupTable = (typeof BACKUP_TABLES)[number]

export const BACKUP_APP = 'controle-gastos'

export interface Backup {
  app: typeof BACKUP_APP
  /** Versão do formato do arquivo. */
  format: 1
  exportedAt: string
  data: Record<BackupTable, unknown[]>
}

export function buildBackup(data: Record<BackupTable, unknown[]>, exportedAt: string): Backup {
  return { app: BACKUP_APP, format: 1, exportedAt, data }
}

/**
 * Lê e valida o conteúdo de um arquivo de backup. Lança Error com mensagem para o usuário
 * se o arquivo não for um backup deste app, para nunca apagar os dados atuais por engano.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('O arquivo não é um backup válido (não foi possível ler o conteúdo).')
  }
  const backup = raw as Partial<Backup> | null
  if (!backup || typeof backup !== 'object' || backup.app !== BACKUP_APP || !backup.data) {
    throw new Error('Este arquivo não é um backup do Controle de Gastos.')
  }
  if (backup.format !== 1) {
    throw new Error('Este backup foi feito por uma versão mais nova do app. Atualize o app antes de restaurar.')
  }
  const data = {} as Record<BackupTable, unknown[]>
  for (const table of BACKUP_TABLES) {
    const rows = backup.data[table] ?? []
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object')) {
      throw new Error(`O backup está corrompido (tabela "${table}").`)
    }
    data[table] = rows
  }
  if (data.categories.length === 0) throw new Error('O backup está vazio: não há categorias nele.')
  return { app: BACKUP_APP, format: 1, exportedAt: String(backup.exportedAt ?? ''), data }
}
