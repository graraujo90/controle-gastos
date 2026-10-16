# Controle de Gastos

App pessoal de controle de gastos e orçamento familiar (PWA, pt-BR). O dono do projeto não é programador:
explique decisões em linguagem simples e valide regras de negócio com ele antes de mudar.

## Como trabalhamos (combinados com o dono)

Valem em qualquer computador: este arquivo é a memória do projeto. Quando o dono disser "quero continuar o
desenvolvimento do app de gastos", leia este arquivo, faça `git pull` e pergunte o que ele quer ajustar.

- **Estado atual**: versão 1.2.3 publicada em https://graraujo90.github.io/controle-gastos/ (etiqueta `v1.2.3`). O
  dono usa o app publicado; os dados reais dele ficam no celular e no OneDrive, nunca no navegador local. Itens em
  aberto em "Pendências e ideias", no fim deste arquivo. Atualize esta linha a cada versão publicada.
- **Commit e push quando o dono aprova a entrega** (o pedido ou o plano aprovado já diz para publicar); na dúvida,
  pergunte. Autor dos commits: `graraujo90 <graraujo90@users.noreply.github.com>` (nunca o e-mail pessoal: o
  repositório é público), mensagem em português, terminando com a linha `Co-Authored-By` do Claude. Cada push na
  `main` publica o site sozinho (GitHub Actions); confira que a publicação terminou com sucesso.
- **A cada entrega**: sobe a versão em `package.json` e `package-lock.json` (os dois primeiros `"version"`), registra
  as regras novas neste arquivo, roda `npm test` e `npm run build`, confere no navegador (celular 360/375 px e
  computador, claro e escuro), cria a etiqueta `vX.Y.Z` e envia junto.
- **Teste no navegador só com dados próprios de teste**: lançamentos, formas e categorias com nome começando por
  "TESTE"; apague tudo no fim pelas funções de `repo.ts` (para ficar o registro de exclusão). O banco do navegador
  local é só de desenvolvimento; nunca mexa nos dados do dono.
- Antes de mudar uma regra de negócio, proponha e espere o ok; pergunte com opções claras e uma recomendada.
- **Dois computadores**: o projeto fica no OneDrive e no GitHub. Não trabalhe nos dois ao mesmo tempo; espere o
  OneDrive terminar de sincronizar antes de abrir no outro; comece com `git pull` e termine com commit e push. Se
  faltar `node_modules`, rode `npm install`. A memória automática do Claude fica em cada computador; o que precisa
  valer nos dois tem que estar aqui.

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
  "Em atraso" ignora o período e mostra tudo que está vencido e não confirmado. O intervalo de datas (`de`/`ate`)
  também deixa o seletor de mês e ano de lado e usa a data do "Ver por" (vencimento ou compra).
- Parcelas: uma compra em N vezes vira N lançamentos ligados por `installmentGroupId`; centavos que sobram vão na 1ª.
  Editar ou excluir uma parcela pergunta o alcance: **só esta** (padrão), esta e as próximas, ou todas. Na edição,
  categoria, subcategoria, forma e descrição vão para o alcance. Valor e minha parte só vão quando foram mudados, e
  valem **por parcela** (o total da compra muda); sem mudança, cada parcela mantém o seu (centavos da 1ª).
- Mover de fatura (`invoiceShift`, só no crédito, até uma fatura para cada lado): para quando o banco fecha em dia
  diferente do cadastrado. Fica guardado no lançamento e se mantém ao mudar a data; numa compra parcelada, todas as
  parcelas andam juntas. Recorrência não se move.
- **Minha parte** (`myShare`, conta dividida) e **estorno** (`estorno: true`), só em despesas. Uma regra única em
  `domain/resumo.ts`: `spent()` (minha parte; estorno negativo) vale para resultado, orçamento, categorias,
  relatórios e pendências; `invoiceValue()` (valor cheio; estorno negativo) vale para fatura e limite do cartão.
  Parcelas dividem a minha parte pela mesma regra do valor; recorrência mantém a parte em cada ocorrência. O
  estorno é lançado na data e na fatura em que aparece, com a categoria da compra.
- **Compra dividida em categorias** (`domain/divisao.ts`): várias despesas ligadas por `splitGroupId`, com a mesma
  data, forma e situação de pagamento; só salva quando as partes somam o total. Abrir uma parte edita a divisão
  inteira; confirmar uma parte confirma todas. Só para compra à vista (sem parcelas, repetição ou estorno).
- Na lista dá para selecionar vários (botão ou toque longo): excluir, confirmar/desfazer e mudar categoria (só
  lançamentos de um tipo).
- Recorrência (`domain/recorrencia.ts`, tabela `recurrences`): semanal, quinzenal ou mensal, com N vezes ou sem fim.
  Os lançamentos são criados de verdade, com id previsível `regra:número` (dois aparelhos não duplicam) e carimbo de
  data da regra. Sem fim mantém 12 meses à frente (`extendRecurrences`, ao abrir e após sincronizar). O contador
  `generated` só cresce: ocorrência apagada não volta. "Este e os próximos" altera os seguintes ainda não confirmados;
  excluir "este e os próximos" encerra a repetição. O padrão ao editar e excluir é **só este**.
- Arquivos de backup e sincronização estão no formato 2 (`FILE_FORMAT`); versão antiga do app recusa e pede atualização.
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
- A Microsoft só renova o acesso sozinha por 24 h em apps web. Vencido, o app tenta ao abrir uma ida e volta **sem
  tela** (`prompt: 'none'`, conta indicada), uma vez por abertura e só nos primeiros 20 s (nunca com formulário
  aberto). Se falhar, fica o aviso; "Entrar de novo" vai à Microsoft já com a conta, sem a tela de escolha.
- Pendente de validação com o dono: convidado (conta da esposa) lendo e gravando na pasta compartilhada.

## Armadilhas do ambiente

- O projeto fica dentro do OneDrive, e o servidor de desenvolvimento às vezes **não percebe arquivos alterados**:
  a tela continua com código antigo e erros que já foram corrigidos. Na dúvida, reinicie o `npm run dev`.
- No Windows, comandos longos com crases ou aspas no Git Bash quebram ("unexpected EOF"): escreva o script num arquivo
  `.cjs` na pasta temporária e rode com `node`. Não há Python instalado.
- O login da Microsoft não dá para testar no navegador local; mudanças em `src/sync/` são conferidas por testes
  (`engine.test.ts` simula dois aparelhos) e depois no aparelho do dono.

## Pendências e ideias

Atualize ao entregar: tire o que foi feito, acrescente o que o dono pedir para depois.

- **Conferir no celular do dono** a renovação do login (1.2.2): depois de mais de 24 h sem abrir, o app deve voltar
  sincronizado sem senha. Se a Microsoft pedir senha toda vez, conversar sobre alternativas.
- **Teste com a conta da esposa** como convidada (ver Sincronização).
- **Perguntas ao dono ainda sem resposta**: (1) em "A pagar no mês", a conta dividida conta só a minha parte (como
  hoje) ou o valor cheio que o banco cobra? (2) o resgate de investimento também em verde, como o estorno?
- **Ideia oferecida**: dividir em categorias junto com parcelamento (cada parcela dividida entre as categorias;
  centavos na 1ª; o alcance "só esta / próximas / todas" vale para a divisão inteira da parcela). Hoje o caminho é
  lançar uma compra parcelada por categoria.
- Desfazer uma divisão já salva: hoje só excluindo e lançando de novo.
- Lançamentos a partir de notificações do celular: em espera.
