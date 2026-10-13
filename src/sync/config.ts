// Registro do app na Microsoft (Entra ID). O ID do cliente identifica o app, não é segredo.
export const CLIENT_ID = 'f2e74c27-1fe2-4167-8ca4-92edb228f452'

// Só contas Microsoft pessoais (Outlook, Hotmail, Live).
export const AUTHORITY = 'https://login.microsoftonline.com/consumers'

// Leitura e gravação de arquivos do OneDrive de quem entra. Precisa ser a permissão ampla porque a
// restrita ("pasta do app") não alcança uma pasta compartilhada por outra pessoa.
export const SCOPES = ['Files.ReadWrite.All']

export const FOLDER_NAME = 'Controle de Gastos'
export const FILE_NAME = 'dados.json'

/** Endereço de retorno do login: a raiz do app, que é o que está cadastrado na Microsoft. */
export const redirectUri = () => new URL('./', location.origin + location.pathname).href
