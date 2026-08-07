# Tasks: Gestão de Doações Comunitárias

**Input**: Design documents from `/specs/001-manage-community-donations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Obrigatórios por constituição para autenticação, permissões, finanças, recorrência,
estoque, integração `/doar` → `/admin`, documentos e fluxos críticos. Em cada história, escreva os
testes indicados e confirme que falham antes da implementação correspondente.

**Organization**: Tarefas agrupadas por história para permitir implementação e validação
incrementais. Todos os caminhos são relativos à raiz do repositório.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: executável em paralelo, em arquivos distintos e sem depender de tarefa incompleta
- **[Story]**: história correspondente (`US1` a `US8`)
- Tarefas de Setup, Foundation e Polish não recebem rótulo de história

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar o monólito Next.js e o ambiente local com somente PostgreSQL em Docker.

- [X] T001 Inicializar Next.js 16, React 19, TypeScript e scripts npm de build/dev/start em package.json e src/app/layout.tsx
- [X] T002 [P] Configurar TypeScript, alias `@/*`, ESLint e formatação em tsconfig.json, eslint.config.mjs e .editorconfig
- [X] T003 [P] Configurar PostgreSQL 18 como único serviço Docker de desenvolvimento em compose.yaml
- [X] T004 [P] Configurar Vitest, Testing Library, Playwright e axe em vitest.config.ts, playwright.config.ts e tests/setup.ts
- [X] T005 [P] Criar estilos globais, tokens de alto contraste e temas público/admin em src/app/globals.css e src/styles/tokens.css
- [X] T006 [P] Preparar diretório privado de documentos e regras de exclusão em storage/.gitkeep, storage/.gitignore e .gitignore

**Checkpoint**: `docker compose up -d db`, `npm ci` e `npm run dev` iniciam banco e aplicação separadamente.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura interna compartilhada que bloqueia todas as histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase terminar.

- [X] T007 Configurar Prisma para PostgreSQL 18 e o cliente singleton em prisma/schema.prisma, prisma.config.ts e src/server/db/client.ts
- [X] T008 [P] Validar variáveis de banco, sessão, URL pública, documentos e contato da capela em src/server/config/env.ts e .env.example
- [X] T009 [P] Implementar envelope HTTP de sucesso/erro e mapeamento de exceções em src/server/http/errors.ts e src/server/http/responses.ts
- [X] T010 [P] Implementar esquemas Zod e normalizadores de e-mail, telefone, CPF/CNPJ, dinheiro, quantidade e datas em src/server/validation/common.ts
- [X] T011 [P] Implementar Argon2id, tokens aleatórios e hashing SHA-256 de segredos em src/server/auth/crypto.ts
- [X] T012 Criar modelos compartilhados User, Session, LoginAttempt, AccessLink, AuditEvent e Project em prisma/schema.prisma
- [X] T013 Criar migração-base com unicidade, checks, índices e timestamps UTC em prisma/migrations/001_foundation/migration.sql
- [X] T014 [P] Implementar auditoria append-only e logger JSON com redação de dados sensíveis em src/server/observability/audit.ts e src/server/observability/logger.ts
- [X] T015 [P] Criar primitivas acessíveis de botão, campo, alerta, modal e estado assíncrono em src/components/shared/Button.tsx, src/components/shared/Field.tsx, src/components/shared/Alert.tsx, src/components/shared/Dialog.tsx e src/components/shared/AsyncState.tsx
- [X] T016 Implementar carregamento de sessão, matriz RBAC, proteção CSRF por Origin e fronteira de rotas em src/server/auth/session.ts, src/server/auth/permissions.ts e src/proxy.ts
- [X] T017 [P] Criar utilitários de banco descartável, factories, autenticação e limpeza para testes em tests/helpers/database.ts, tests/helpers/factories.ts e tests/helpers/auth.ts
- [X] T018 Criar seed idempotente de administrador, projetos, catálogo e configurações públicas em prisma/seed.ts

**Checkpoint**: Foundation pronta; migrações aplicam do zero, seed é repetível e rotas administrativas negam sessão ausente.

---

## Phase 3: User Story 1 - Doar dinheiro sem criar conta (Priority: P1) 🎯 First Slice

**Goal**: Concluir uma doação simulada única ou mensal em até três passos, sem conta, persistindo
uma única entrada com origem pública e oferecendo recibo/link quando identificada.

**Independent Test**: Criar, confirmar e repetir a mesma simulação; a pessoa recebe agradecimento,
uma única entrada é persistida e nenhuma autenticação é solicitada.

### Tests for User Story 1

- [X] T019 [P] [US1] Validar o contrato de configuração, simulação e confirmação pública em tests/contract/public-donations.contract.test.ts
- [X] T020 [P] [US1] Testar transação atômica, idempotência e rollback de doador/lançamento/recorrência em tests/integration/donation-confirmation.test.ts
- [X] T021 [P] [US1] Testar CPF/CNPJ, dinheiro decimal, anonimato e geração idempotente de recibo em tests/integration/donation-receipt.test.ts
- [X] T022 [P] [US1] Testar o fluxo acessível de três passos, Pix/cartão simulados e duplo toque em tests/e2e/donation-public.spec.ts

### Implementation for User Story 1

- [X] T023 [US1] Adicionar Donor, PaymentSimulation, LedgerEntry, RecurringSubscription e DonationReceipt ao modelo em prisma/schema.prisma
- [X] T024 [US1] Criar constraints de moeda, destino condicional, documento parcial-único e idempotência em prisma/migrations/002_public_donations/migration.sql
- [X] T025 [P] [US1] Implementar consulta de projetos ativos e configuração pública em src/server/domains/projects/public-projects.ts e src/server/config/public-config.ts
- [X] T026 [P] [US1] Implementar adaptador de Pix/cartão explicitamente simulado em src/server/integrations/payment-simulator.ts
- [X] T027 [US1] Implementar criação/associação inicial de doador pela ordem documento, e-mail e telefone em src/server/domains/donors/match-donor.ts
- [X] T028 [US1] Implementar confirmação idempotente que grava doador, lançamento e recorrência numa transação em src/server/domains/finance/confirm-donation.ts
- [X] T029 [US1] Implementar recibo PDF derivado do lançamento e link pessoal com token apenas em hash em src/server/documents/donation-receipt.ts e src/server/auth/access-links.ts
- [X] T030 [US1] Implementar endpoints de configuração, criação, consulta e confirmação em src/app/api/public/configuration/route.ts, src/app/api/public/payment-simulations/route.ts, src/app/api/public/payment-simulations/[simulationId]/route.ts e src/app/api/public/payment-simulations/[simulationId]/confirmation/route.ts
- [X] T031 [P] [US1] Criar boas-vindas e seleção de dinheiro/itens em src/app/(public)/doar/page.tsx e src/components/donor/DonationChoice.tsx
- [X] T032 [US1] Criar etapas de tipo/valor, método e destino/revisão em src/app/(public)/doar/dinheiro/page.tsx, src/components/donor/AmountStep.tsx, src/components/donor/MethodStep.tsx e src/components/donor/DestinationStep.tsx
- [X] T033 [US1] Criar confirmação, agradecimento, instruções passo a passo e ajuda persistente em src/app/(public)/doar/obrigado/page.tsx, src/components/donor/DonationSummary.tsx e src/components/donor/VolunteerHelp.tsx

**Checkpoint**: US1 funciona sem `/admin`; o teste confirma diretamente no banco uma única entrada de origem pública.

---

## Phase 4: User Story 2 - Acessar o painel conforme o papel (Priority: P1)

**Goal**: Autenticar contas internas, bloquear após cinco falhas, recuperar/definir senha por link
de 30 dias e restringir toda ação pelo papel no servidor.

**Independent Test**: Entrar com os três papéis, tentar URLs diretas, provocar bloqueio, desbloquear
por administrador e validar convite/redefinição reutilizáveis e revogáveis.

### Tests for User Story 2

- [ ] T034 [P] [US2] Validar contratos de login, logout, perfil, convite e redefinição em tests/contract/admin-auth.contract.test.ts
- [ ] T035 [P] [US2] Testar hash Argon2id, sessões opacas, expiração, revogação e bloqueio na quinta falha em tests/integration/admin-auth.test.ts
- [ ] T036 [P] [US2] Testar negação por papel e alteração imediata de status/papel em acesso direto em tests/integration/rbac-boundary.test.ts
- [ ] T037 [P] [US2] Testar login, mensagens de estado, recuperação genérica e menus por papel em tests/e2e/admin-auth-rbac.spec.ts

### Implementation for User Story 2

- [ ] T038 [P] [US2] Implementar repositórios de usuário, sessão, tentativa e link em src/server/domains/users/user-repository.ts e src/server/auth/auth-repository.ts
- [ ] T039 [US2] Implementar login com contagem consecutiva, bloqueio, criação de sessão e auditoria em src/server/auth/login-service.ts
- [ ] T040 [US2] Implementar logout, troca de senha, revogação de sessões e consulta do perfil em src/server/auth/account-service.ts
- [ ] T041 [US2] Implementar convite/redefinição reutilizáveis por 30 dias e outbox simulada em src/server/auth/password-links.ts e src/server/integrations/notification-simulator.ts
- [ ] T042 [US2] Implementar endpoints públicos de convite e reset sem enumeração em src/app/api/public/access/invitation/route.ts, src/app/api/public/access/password-reset-requests/route.ts e src/app/api/public/access/password-reset/route.ts
- [ ] T043 [US2] Implementar endpoints de login, logout, perfil e senha em src/app/api/admin/auth/login/route.ts, src/app/api/admin/auth/logout/route.ts, src/app/api/admin/me/route.ts e src/app/api/admin/me/password/route.ts
- [ ] T044 [P] [US2] Criar telas de login, solicitação e definição de senha em src/app/(admin)/admin/login/page.tsx, src/app/(public)/acesso/redefinir/page.tsx e src/app/(public)/acesso/convite/page.tsx
- [ ] T045 [US2] Criar shell administrativo e menu filtrado por papel em src/app/(admin)/admin/layout.tsx, src/components/admin/AdminShell.tsx e src/components/admin/AdminNavigation.tsx
- [ ] T046 [US2] Criar página Meu Perfil com dados básicos e troca de senha em src/app/(admin)/admin/perfil/page.tsx

**Checkpoint**: US2 protege `/admin` de forma independente e fornece uma área interna vazia, mas segura, para os demais módulos.

---

## Phase 5: User Story 3 - Controlar o livro-caixa e indicadores (Priority: P1) 🎯 Operational MVP

**Goal**: Consultar KPIs e lançamentos, filtrar e criar entrada/saída manual auditada, incluindo
doações públicas já criadas em US1.

**Independent Test**: Com seed financeiro, usuário autorizado vê totais reconciliados, filtra a
tabela e cria lançamento manual; voluntário recebe negação.

### Tests for User Story 3

- [ ] T047 [P] [US3] Validar contratos de dashboard e livro-caixa em tests/contract/admin-finance.contract.test.ts
- [ ] T048 [P] [US3] Testar decimal exato, saldo, doador ativo, filtros e auditoria manual em tests/integration/finance-dashboard.test.ts
- [ ] T049 [P] [US3] Testar KPIs, origem pública, filtros, estados vazios e novo lançamento em tests/e2e/admin-finance.spec.ts

### Implementation for User Story 3

- [ ] T050 [P] [US3] Implementar consultas paginadas e filtros do livro-caixa em src/server/domains/finance/ledger-repository.ts
- [ ] T051 [US3] Implementar lançamento manual e entrada compensatória imutável com auditoria em src/server/domains/finance/manual-ledger-service.ts
- [ ] T052 [US3] Implementar agregações mensais, saldo e definição de doador ativo em src/server/domains/finance/dashboard-service.ts
- [ ] T053 [US3] Implementar endpoints de dashboard e livro-caixa em src/app/api/admin/dashboard/route.ts e src/app/api/admin/ledger/route.ts
- [ ] T054 [P] [US3] Criar dashboard com KPIs e gráficos acessíveis por projeto/tipo em src/app/(admin)/admin/page.tsx e src/components/admin/DashboardCharts.tsx
- [ ] T055 [US3] Criar livro-caixa com filtros, selo de origem e formulário manual em src/app/(admin)/admin/financeiro/page.tsx, src/components/admin/LedgerTable.tsx e src/components/admin/LedgerForm.tsx

**Checkpoint**: US1 + US2 + US3 formam o MVP operacional: doar, acessar com segurança e visualizar no caixa.

---

## Phase 6: User Story 4 - Receber e distribuir itens por lote (Priority: P1)

**Goal**: Cadastrar lotes independentes, consolidar por item, sugerir baixa por vencimento,
distribuir/descartar atomicamente e gerar termo de bens.

**Independent Test**: Dois lotes com validades diferentes são consolidados; distribuição escolhe o
mais próximo, concorrência não negativa saldo e descarte/termo ficam auditados.

### Tests for User Story 4

- [ ] T056 [P] [US4] Validar contratos de catálogo, lotes, sugestão, movimentação e termo em tests/contract/admin-inventory.contract.test.ts
- [ ] T057 [P] [US4] Testar ordenação por validade, múltiplos lotes e bloqueio concorrente em tests/integration/inventory-concurrency.test.ts
- [ ] T058 [P] [US4] Testar descarte parcial/total, estados e reconciliação de perdas em tests/integration/inventory-discard.test.ts
- [ ] T059 [P] [US4] Testar cálculo/manual de valor e geração idempotente do termo PDF em tests/integration/in-kind-term.test.ts
- [ ] T060 [P] [US4] Testar cadastro, alertas 7/30 dias, drill-down, sugestão ajustável e saída em tests/e2e/admin-inventory.spec.ts

### Implementation for User Story 4

- [ ] T061 [US4] Adicionar InventoryItem, AcceptedItemConfig, InventoryLot, InventoryMovement, InventoryMovementLine e InKindDonationTerm em prisma/schema.prisma
- [ ] T062 [US4] Criar checks de quantidade, linhas únicas e índices de validade/estado em prisma/migrations/003_inventory/migration.sql
- [ ] T063 [P] [US4] Implementar catálogo, consolidação e repositório de lotes em src/server/domains/inventory/inventory-repository.ts
- [ ] T064 [P] [US4] Implementar valoração manual ou média com snapshots em src/server/domains/inventory/valuation-service.ts
- [ ] T065 [US4] Implementar sugestão e distribuição transacional com `FOR UPDATE` em src/server/domains/inventory/distribution-service.ts
- [ ] T066 [US4] Implementar descarte parcial/total e derivação de estado do lote em src/server/domains/inventory/discard-service.ts
- [ ] T067 [US4] Implementar termo PDF privado e idempotente em src/server/documents/in-kind-term.ts
- [ ] T068 [US4] Implementar endpoints de itens, lotes, sugestão, movimentos e termo em src/app/api/admin/inventory/items/route.ts, src/app/api/admin/inventory/lots/route.ts, src/app/api/admin/inventory/distribution-suggestion/route.ts, src/app/api/admin/inventory/movements/route.ts e src/app/api/admin/inventory/lots/[lotId]/term/route.ts
- [ ] T069 [US4] Criar telas de estoque consolidado, lotes, alertas, recebimento e distribuição em src/app/(admin)/admin/estoque/page.tsx, src/components/admin/InventoryTable.tsx, src/components/admin/LotForm.tsx e src/components/admin/MovementForm.tsx

**Checkpoint**: US4 opera estoque completo sem depender das histórias P2.

---

## Phase 7: User Story 5 - Informar itens aceitos para doação (Priority: P2)

**Goal**: Configurar aceitação/prioridade no admin e refletir imediatamente uma lista apenas
informativa em `/doar`.

**Independent Test**: Pausar/priorizar um item altera a próxima leitura pública em até cinco
segundos; a tela nunca oferece cadastro de lote.

### Tests for User Story 5

- [ ] T070 [P] [US5] Validar contratos de atualização administrativa e lista pública de itens em tests/contract/accepted-items.contract.test.ts
- [ ] T071 [P] [US5] Testar consistência imediata, prioridade e item pausado em tests/integration/accepted-items.test.ts
- [ ] T072 [P] [US5] Testar configuração no admin e orientação pública sem formulário de lote em tests/e2e/accepted-items.spec.ts

### Implementation for User Story 5

- [ ] T073 [US5] Implementar regras aceito/pausado/prioridade e projeção pública ordenada em src/server/domains/inventory/accepted-items-service.ts
- [ ] T074 [US5] Implementar atualização parcial do item/configuração em src/app/api/admin/inventory/items/[itemId]/route.ts
- [ ] T075 [US5] Implementar endpoint público sem dados internos em src/app/api/public/accepted-items/route.ts
- [ ] T076 [US5] Criar configuração administrativa e página pública de entrega em src/app/(admin)/admin/estoque/itens-aceitos/page.tsx e src/app/(public)/doar/itens/page.tsx

**Checkpoint**: US5 conecta a necessidade operacional ao doador sem criar recebimento público.

---

## Phase 8: User Story 6 - Gerir doadores e recorrências (Priority: P2)

**Goal**: Consultar doadores e linha do tempo, resolver conflitos de identidade e permitir que o
doador gerencie recorrências por link pessoal.

**Independent Test**: Doação identificada cria/associa corretamente; conflito abre revisão; link
válido mostra apenas o próprio histórico e altera, pausa, retoma ou cancela recorrência.

### Tests for User Story 6

- [ ] T077 [P] [US6] Validar contratos de doadores, revisões, conta e recorrências em tests/contract/donors-account.contract.test.ts
- [ ] T078 [P] [US6] Testar prioridade de matching, conflito e merge auditado em tests/integration/donor-matching.test.ts
- [ ] T079 [P] [US6] Testar posse, escopo, reutilização, expiração e revogação do link pessoal em tests/integration/donor-account-links.test.ts
- [ ] T080 [P] [US6] Testar transições e preservação do histórico recorrente em tests/integration/recurring-subscriptions.test.ts
- [ ] T081 [P] [US6] Testar lista/timeline/revisão no admin e Minha Conta pública em tests/e2e/donors-account.spec.ts

### Implementation for User Story 6

- [ ] T082 [US6] Adicionar DonorMatchReview e campos de revisão/merge ao modelo em prisma/schema.prisma
- [ ] T083 [US6] Criar índices de matching e constraints de resolução em prisma/migrations/004_donor_reviews/migration.sql
- [ ] T084 [US6] Completar matching para criar doador provisório e revisão em conflitos em src/server/domains/donors/match-donor.ts
- [ ] T085 [US6] Implementar keep-separate/merge transacional com redirecionamento de referências em src/server/domains/donors/review-service.ts
- [ ] T086 [P] [US6] Implementar busca, detalhe, timeline e mascaramento em src/server/domains/donors/donor-query-service.ts
- [ ] T087 [P] [US6] Implementar alterar valor, pausar, retomar e cancelar recorrência em src/server/domains/donors/subscription-service.ts
- [ ] T088 [US6] Implementar solicitação genérica e validação adicional por contato para Minha Conta em src/server/domains/donors/account-access-service.ts
- [ ] T089 [US6] Implementar endpoints administrativos de doadores e revisões em src/app/api/admin/donors/route.ts, src/app/api/admin/donors/[donorId]/route.ts, src/app/api/admin/donor-match-reviews/route.ts e src/app/api/admin/donor-match-reviews/[reviewId]/resolution/route.ts
- [ ] T090 [US6] Implementar endpoints públicos de acesso, conta, recorrência e recibo próprio em src/app/api/public/account/access-requests/route.ts, src/app/api/public/account/route.ts, src/app/api/public/account/subscriptions/[subscriptionId]/route.ts e src/app/api/public/account/receipts/[receiptId]/route.ts
- [ ] T091 [US6] Criar gestão administrativa e Minha Conta acessível em src/app/(admin)/admin/doadores/page.tsx, src/app/(admin)/admin/doadores/[donorId]/page.tsx, src/app/(admin)/admin/doadores/revisoes/page.tsx e src/app/(public)/doar/minha-conta/page.tsx

**Checkpoint**: US6 entrega gestão e autosserviço sem criar autenticação convencional para doador.

---

## Phase 9: User Story 7 - Prestar contas ao público (Priority: P2)

**Goal**: Gerar consolidação financeira/física, publicar snapshot imutável e exibir somente a
última versão aprovada sem dados pessoais.

**Independent Test**: Publicar um período, alterar a origem e comprovar que a publicação antiga não
muda; nova publicação passa a ser a visão pública.

### Tests for User Story 7

- [ ] T092 [P] [US7] Validar contratos de prévia, publicação e consulta/download público em tests/contract/reports.contract.test.ts
- [ ] T093 [P] [US7] Testar reconciliação por período/projeto, giro e perdas de estoque em tests/integration/report-aggregation.test.ts
- [ ] T094 [P] [US7] Testar imutabilidade, ordenação e ausência de dados pessoais no snapshot em tests/integration/report-publication.test.ts
- [ ] T095 [P] [US7] Testar geração administrativa e compreensão da visão pública em tests/e2e/public-report.spec.ts

### Implementation for User Story 7

- [ ] T096 [US7] Adicionar PublicReportPublication e vínculo de supersessão ao modelo em prisma/schema.prisma
- [ ] T097 [US7] Criar constraints de período, índice de última publicação e imutabilidade em prisma/migrations/005_report_publications/migration.sql
- [ ] T098 [US7] Implementar agregação de dinheiro, bens, giro, vencidos e descartes em src/server/domains/reports/report-service.ts
- [ ] T099 [US7] Implementar snapshot sanitizado e publicação append-only em src/server/domains/reports/publication-service.ts
- [ ] T100 [P] [US7] Implementar PDF de prestação de contas derivado do snapshot em src/server/documents/accountability-report.ts
- [ ] T101 [US7] Implementar endpoints administrativos de prévia/publicação em src/app/api/admin/reports/preview/route.ts e src/app/api/admin/reports/publications/route.ts
- [ ] T102 [US7] Implementar endpoints públicos da última publicação e PDF em src/app/api/public/reports/latest/route.ts e src/app/api/public/reports/latest.pdf/route.ts
- [ ] T103 [US7] Criar gerador administrativo e visão pública com gráfico textual/SVG acessível em src/app/(admin)/admin/relatorios/page.tsx, src/app/(public)/doar/transparencia/page.tsx e src/components/donor/PublicReportChart.tsx

**Checkpoint**: US7 fornece transparência aprovada e historicamente auditável.

---

## Phase 10: User Story 8 - Administrar usuários e projetos (Priority: P3)

**Goal**: Criar/manter usuários e projetos, desbloquear contas, reenviar convite e consultar o
histórico de login.

**Independent Test**: Administrador cria usuário pendente, altera papel/estado, bloqueia/desbloqueia,
reenvia link, filtra tentativas e desativa projeto sem quebrar histórico.

### Tests for User Story 8

- [ ] T104 [P] [US8] Validar contratos CRUD de usuários/projetos e histórico de login em tests/contract/admin-governance.contract.test.ts
- [ ] T105 [P] [US8] Testar ciclo de usuário, revogação de sessões, convite e desbloqueio em tests/integration/user-administration.test.ts
- [ ] T106 [P] [US8] Testar projeto ativo/inativo e preservação de vínculos históricos em tests/integration/project-lifecycle.test.ts
- [ ] T107 [P] [US8] Testar telas de usuários, projetos e histórico filtrável em tests/e2e/admin-governance.spec.ts

### Implementation for User Story 8

- [ ] T108 [US8] Implementar CRUD, status, papel, desbloqueio e revogação de sessões em src/server/domains/users/user-admin-service.ts
- [ ] T109 [US8] Implementar reenvio que revoga convites anteriores e retorna o novo link uma vez em src/server/domains/users/invitation-service.ts
- [ ] T110 [P] [US8] Implementar ciclo ativo/inativo de projetos e proteção de vínculos em src/server/domains/projects/project-admin-service.ts
- [ ] T111 [P] [US8] Implementar consulta paginada e filtros de tentativas em src/server/domains/users/login-history-service.ts
- [ ] T112 [US8] Implementar endpoints de coleção/detalhe/desbloqueio/convite de usuários em src/app/api/admin/users/route.ts, src/app/api/admin/users/[userId]/route.ts, src/app/api/admin/users/[userId]/unlock/route.ts e src/app/api/admin/users/[userId]/invitation/route.ts
- [ ] T113 [US8] Implementar endpoints de projetos em src/app/api/admin/projects/route.ts e src/app/api/admin/projects/[projectId]/route.ts
- [ ] T114 [US8] Implementar endpoint de histórico de login em src/app/api/admin/login-attempts/route.ts
- [ ] T115 [P] [US8] Criar listagem, formulário e ações de usuários em src/app/(admin)/admin/usuarios/page.tsx e src/components/admin/UserForm.tsx
- [ ] T116 [US8] Criar projetos e histórico de login em src/app/(admin)/admin/projetos/page.tsx e src/app/(admin)/admin/acessos/page.tsx

**Checkpoint**: As oito histórias estão funcionais e administráveis pela própria aplicação.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Segurança, produção Docker, recuperação, desempenho e validação integral.

- [ ] T117 [P] Criar imagem multi-stage Node.js 24 sem usuário root e com output standalone em deploy/Dockerfile e next.config.ts
- [ ] T118 Criar Docker Compose de produção com app, PostgreSQL, Caddy, healthchecks, volumes e profile de manutenção em deploy/compose.production.yaml
- [ ] T119 [P] Configurar HTTPS automático, proxy e headers de segurança em deploy/Caddyfile
- [ ] T120 Criar deploy com migração prévia, backup, health check e rollback de imagem em deploy/scripts/deploy.sh
- [ ] T121 [P] Implementar backup criptografado de PostgreSQL/PDFs com retenção 7/5/12 em deploy/scripts/backup.sh
- [ ] T122 Implementar restauração isolada e modo `--verify-only` em deploy/scripts/restore.sh
- [ ] T123 [P] Implementar limpeza configurável de sessões, links e tentativas antigas em src/server/maintenance/retention.ts e scripts/run-retention.ts
- [ ] T124 Endurecer rate limits no PostgreSQL, CSP, cookies, uploads/downloads e proteção contra enumeração em src/server/security/rate-limit.ts, src/server/auth/session.ts e next.config.ts
- [ ] T125 [P] Adicionar índices finais e testes de carga para 100 públicos/20 admins em prisma/migrations/006_performance/migration.sql e tests/performance/baseline.test.ts
- [ ] T126 [P] Completar suíte WCAG 2.2 AA em 320/768/desktop, teclado e zoom em tests/accessibility/public-flow.spec.ts e tests/accessibility/admin-flow.spec.ts
- [ ] T127 [P] Validar conteúdo seguro de logs, auditoria e health check em tests/integration/observability-security.test.ts e src/app/api/health/route.ts
- [ ] T128 Executar todos os comandos e cenários de specs/001-manage-community-donations/quickstart.md e registrar resultados em specs/001-manage-community-donations/validation-report.md
- [ ] T129 Documentar retenção aprovada, operação VPS, backup/restore e adaptadores simulados em docs/operations.md e docs/privacy-retention.md

**Checkpoint**: Release candidata passa todos os gates e pode ser implantada na VPS.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Setup (1)
  └─> Foundation (2)
       ├─> US1 Doação pública (3)
       ├─> US2 Autenticação/RBAC (4)
       │    ├─> US3 Caixa/Dashboard (5) ──┐
       │    ├─> US4 Estoque (6) ─────────┼─> US7 Prestação de contas (9)
       │    └─> US8 Usuários/Projetos (10)
       ├─> US5 Itens aceitos (7), após US4
       └─> US6 Doadores/Recorrências (8), após US1 e US2

Todas as histórias selecionadas ──> Polish (11)
```

- **Phase 1**: sem dependências.
- **Phase 2**: depende de Phase 1 e bloqueia todas as histórias.
- **US1**: depende somente da Foundation.
- **US2**: depende somente da Foundation e habilita os módulos administrativos.
- **US3**: depende de US1 para integração pública e US2 para acesso administrativo.
- **US4**: depende de US2 para acesso do voluntário; não depende de US3.
- **US5**: depende de US4 para catálogo/configuração de itens.
- **US6**: depende de US1 para doadores/recorrências e US2 para gestão interna.
- **US7**: depende de US3 e US4 como fontes financeira e física.
- **US8**: depende de US2; projetos mínimos já existem pelo seed, e o CRUD completo chega aqui.
- **Phase 11**: depende de todas as histórias que farão parte da release.

### Within Each User Story

1. Escrever os testes e confirmar falha pelo comportamento ausente.
2. Alterar modelo e migração antes de repositórios/serviços.
3. Implementar regras do domínio antes dos endpoints.
4. Implementar endpoints antes das telas.
5. Executar testes da história e validar o checkpoint antes de seguir.

## Parallel Opportunities

- Setup: T002–T006 podem avançar em paralelo após T001.
- Foundation: T008–T011, T014–T015 e T017 usam arquivos separados; T012–T013 permanecem sequenciais.
- Após Foundation, US1 e US2 podem começar em paralelo.
- Após US2, US4 e US8 podem avançar enquanto US3 integra US1.
- Em cada história, os testes marcados `[P]` podem ser escritos em paralelo antes da implementação.
- Serviços marcados `[P]` dentro de uma história não alteram os mesmos arquivos.
- Polish: imagem, Caddy, backup, retenção, desempenho, acessibilidade e observabilidade possuem
  arquivos independentes conforme os marcadores.

## Parallel Examples by User Story

```text
US1: T019 + T020 + T021 + T022; depois T025 + T026
US2: T034 + T035 + T036 + T037; depois T038 + T044
US3: T047 + T048 + T049; depois T050 + T054
US4: T056 + T057 + T058 + T059 + T060; depois T063 + T064
US5: T070 + T071 + T072
US6: T077 + T078 + T079 + T080 + T081; depois T086 + T087
US7: T092 + T093 + T094 + T095; depois T100 enquanto T098/T099 avançam em sequência
US8: T104 + T105 + T106 + T107; depois T110 + T111 + T115
```

## Implementation Strategy

### First Testable Slice

1. Phase 1: Setup.
2. Phase 2: Foundation.
3. Phase 3: US1.
4. Parar e validar doação pública, idempotência e acessibilidade sem depender do painel.

### Operational MVP

1. Entregar First Testable Slice.
2. Adicionar US2 para acesso administrativo seguro.
3. Adicionar US3 para caixa/dashboard e integração visual da origem pública.
4. Implantar/demo somente após o checkpoint de US3.

### Incremental Delivery

1. US4 completa o segundo domínio P1: estoque físico.
2. US5 e US6 adicionam orientação pública e relacionamento com doadores.
3. US7 adiciona transparência publicada.
4. US8 torna usuários e projetos autogerenciáveis.
5. Phase 11 endurece e prepara a release na VPS.

## Notes

- `[P]` significa arquivos distintos e nenhuma dependência pendente naquele ponto.
- Todas as tarefas de história possuem `[USn]`; Setup, Foundation e Polish não possuem.
- Simuladores devem exibir seu estado e nunca aparentar pagamento ou mensagem real.
- Migrações devem preservar dados e ter rollback documentado antes do deploy.
- Commits devem agrupar uma tarefa ou conjunto lógico pequeno e manter testes verdes.

---

## Phase 12: Convergence

**Purpose**: Corrigir regressões observadas no fluxo público concluído e tornar sua validação independente do banco compartilhado e de APIs mockadas.

- [X] T130 CRITICAL Criar teste de regressão que exercite configuração pública, projeto ativo, criação e confirmação simulada pelas rotas reais com PostgreSQL isolado per Constitution V, FR-014, FR-016 e US1/AC1 (contradicts)
- [X] T131 CRITICAL Corrigir o bootstrap de configuração e banco no desenvolvimento para que `/api/public/configuration` e a confirmação retornem envelopes HTTP úteis e funcionem com o ambiente local documentado per FR-014, FR-016 e US1/AC1 (partial)
- [X] T132 [P] Migrar o helper e os testes de integração para PostgreSQL 18 efêmero com Testcontainers, sem exigir `TEST_DATABASE_URL` ou banco compartilhado, e atualizar plan.md, research.md e quickstart.md per plan: Testing (partial)
- [X] T133 [P] Implementar carregamento, vazio, erro recuperável e nova tentativa da lista de projetos no fluxo de dinheiro per Constitution V e FR-014 (partial)
- [X] T134 Executar as regressões sem mocks de API, os testes de integração com Testcontainers, typecheck e lint, registrando que projetos e confirmação simulada funcionam per SC-005 e Constitution V (partial)
