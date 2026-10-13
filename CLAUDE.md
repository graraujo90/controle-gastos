# Controle de Gastos

App pessoal de controle de gastos e orçamento familiar (PWA, pt-BR). O dono do projeto não é programador:
explique decisões em linguagem simples e valide regras de negócio com ele antes de mudar.

## Comandos

- `npm run dev` — servidor local em http://localhost:5173
- `npm test` — testes das regras de negócio (Vitest)
- `npm run build` — checagem de tipos + build de produção em `dist/`
- Publicação: automática pelo GitHub Actions (`.github/workflows/deploy.yml`) a cada push na `main`.

## Arquitetura

Vite + React + TypeScript, Tailwind v4, Dexie (IndexedDB), Recharts, vite-plugin-pwa. Rotas com `HashRouter`.

- `src/domain/` — regras puras, sem banco nem tela, cada uma com teste ao lado. Toda regra de negócio nova entra aqui.
- `src/db/` — `db.ts` (schema e migrações), `types.ts`, `seed.ts`, e `repo.ts`: **única** camada que grava no banco.
  As telas nunca gravam direto; trocar o armazenamento significa mexer só em `repo.ts`.
- `src/features/<tela>/` — uma pasta por tela. Telas que usam Recharts são carregadas com `lazy` em `App.tsx`.
- `src/components/` — layout, modal, campo de moeda, seletor de mês, cores por tipo, ícones de categoria.
- `src/sync/` — login Microsoft, arquivo no OneDrive e o motor que decide quando sincronizar.
- `src/lib/format.ts` — moeda, datas e meses em pt-BR.

## Convenções

- Valores sempre em **centavos (inteiro)**; formate só na exibição com `formatBRL`.
- Datas como texto `AAAA-MM-DD`, meses como `AAAA-MM`; comparações são por texto.
- Todo registro tem `id` (UUID), `createdAt`, `updatedAt`.
- Mudou o formato dos dados? Crie uma nova `db.version(n)` com migração; nunca edite uma versão já publicada.
- Excluir categoria ou forma já usada apenas arquiva (`archived`), para preservar o histórico.

## Regras de negócio decididas com o dono

- Três tipos de lançamento: receita, despesa e investimento. Resultado do mês = receitas − despesas − investimentos.
- **Mês de competência = mês do vencimento** (`month` = mês de `dueDate`). No cartão de crédito o vencimento é o da
  fatura (`domain/fatura.ts`); nas outras formas é a data, ou o vencimento informado.
- A lista de lançamentos pode ser vista por vencimento ou por data da compra (preferência por aparelho). Isso muda
  só a listagem: totais, orçamento e relatórios seguem sempre o vencimento.
- O filtro da lista de lançamentos mora no endereço (`#/lancamentos?tipo=despesa&cat=…`, `domain/filtro.ts`).
  Qualquer número do Início ou dos relatórios que leve à lista deve usar `lancamentosLink()`, nunca estado interno.
  "Em atraso" ignora o período e mostra tudo que está vencido e não confirmado.
- Parcelas: uma compra em N vezes vira N lançamentos ligados por `installmentGroupId`; centavos que sobram vão na 1ª.
- Confirmação (`paid`) vale para os três tipos: despesa paga, receita recebida, investimento aplicado ou resgatado.
  **Pendentes contam no resultado do mês como previsto**; o Início mostra à parte o realizado e as pendências.
  No crédito, pagar marca a fatura inteira do cartão naquele mês.
- Orçamento: limite só por categoria (subcategorias somam nela). O limite vale do mês em que foi definido em diante,
  até o próximo ajuste; meses anteriores não mudam (`domain/orcamento.ts`). O total do mês compara **todas** as
  despesas com a soma dos limites: categoria sem limite conta como limite zero.
- Subcategorias existem em despesas e em investimentos.
- Investimentos: o app **não** acompanha saldo nem rendimento (isso foi removido a pedido do dono). Ficam só os
  lançamentos, para medir o impacto no orçamento: aporte e resgate (`resgate: true`). O resgate abate do investido
  e volta ao resultado do mês, sem contar como receita.
- Relatório anual: "aportado no ano" e "% da receita investida" zeram a cada ano; o saldo inicial passa de um ano
  para o outro.
- Metas/sonhos não existem como recurso: planos como viagens são categorias de despesa.
- Categorias têm cor e ícone (`components/categoryIcons.ts`); sem ícone escolhido, vale o sugerido pelo nome.

## Aparência

- Tema claro/escuro em `src/lib/theme.ts`: automático (segue o aparelho) por padrão, por aparelho, sem sincronizar.
  A mesma regra está repetida no trecho inicial de `index.html`, para não piscar ao abrir; mude os dois juntos.
- O escuro é feito redefinindo a escala de cores do Tailwind em `.dark` (`src/index.css`). Use as classes normais
  (`bg-white`, `text-slate-900`…) e elas acompanham o tema; evite cores fixas em hexadecimal nas telas.
- Cores de gráfico ficam em `CHART_THEME` (`components/typeStyle.ts`), um conjunto por tema, validadas para
  daltonismo contra o fundo de cada tema. Não troque sem validar de novo.

## Sincronização

- Dados em um arquivo `dados.json` numa pasta do OneDrive pessoal do dono, via Microsoft Graph (`src/sync/`).
  O dono cria a pasta; um convidado entra pelo link de compartilhamento, com a própria conta Microsoft.
- Junção registro a registro pelo `updatedAt`, com registro de exclusões (`deletions`); regras em `domain/sync.ts`.
- Toda exclusão de dado sincronizado passa por `remove()` em `repo.ts`, para deixar o registro de exclusão.
- Pendente de validação com o dono: convidado (conta da esposa) lendo e gravando na pasta compartilhada.

## Armadilhas do ambiente

- O projeto fica dentro do OneDrive, e o servidor de desenvolvimento às vezes **não percebe arquivos alterados**:
  a tela continua com código antigo e erros que já foram corrigidos. Na dúvida, reinicie o `npm run dev`.
