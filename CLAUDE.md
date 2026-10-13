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
- `src/components/` — layout, modal, campo de moeda, seletor de mês, cores por tipo.
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
- Parcelas: uma compra em N vezes vira N lançamentos ligados por `installmentGroupId`; centavos que sobram vão na 1ª.
- Pago / a pagar só existe em despesas. No crédito, pagar marca a fatura inteira do cartão naquele mês.
- Orçamento: limite só por categoria (subcategorias somam nela). O limite vale do mês em que foi definido em diante,
  até o próximo ajuste; meses anteriores não mudam (`domain/orcamento.ts`).
- Subcategorias existem em despesas e em investimentos (em investimentos servem para separar por banco).
- Investimentos: aporte e resgate (`resgate: true`). O resgate abate do investido e volta ao resultado do mês,
  sem contar como receita. Saldo é informado pelo usuário por categoria/subcategoria (`balances`);
  rendimento = saldo informado − aportado líquido até aquela data (`domain/investimentos.ts`).
- Relatório anual: "aportado no ano" e "% da receita investida" zeram a cada ano; o saldo inicial passa de um ano
  para o outro.
- Metas/sonhos não existem como recurso: planos como viagens são categorias de despesa.
- Cores dos gráficos (`CHART_COLOR`) foram validadas para daltonismo; não troque sem revalidar.

## Em andamento

Plano aprovado: publicar no GitHub Pages e sincronizar os dados por um arquivo em uma pasta do OneDrive pessoal do
dono, compartilhada com a esposa (cada um com a própria conta Microsoft, via Microsoft Graph). Antes de construir
a sincronização, confirmar com duas contas pessoais que o convidado lê e grava na pasta compartilhada.
