# Implementation Plan: Gestão de Doações Comunitárias

**Branch**: `001-manage-community-donations` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-manage-community-donations/spec.md`

## Summary

Construir uma única aplicação web full-stack com duas áreas claramente separadas: `/doar`,
pública e acessível, e `/admin`, autenticada e autorizada por papel. A mesma aplicação executará
interface, regras de negócio, endpoints HTTP, geração de documentos e tarefas administrativas,
usando uma única base PostgreSQL.

A produção será hospedada em uma VPS por Docker Compose. Três serviços permanentes bastam:
`caddy` para HTTPS e proxy reverso, `app` para Next.js e `db` para PostgreSQL. Um contêiner de
backup será executado periodicamente e encerrado ao concluir. Pagamento, e-mail e WhatsApp serão
adaptadores simulados nesta entrega, conforme o escopo funcional.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 24 LTS

**Primary Dependencies**: Next.js 16 com App Router e React 19; shadcn/ui; Prisma ORM; Zod;
Argon2id; `pdf-lib`; Tailwind CSS; npm; Caddy 2; Docker Engine com Docker Compose v2

**Storage**: PostgreSQL 18 em contêiner com volume persistente; documentos PDF em volume privado
montado somente na aplicação; cópia de segurança criptografada fora da VPS

**Testing**: Vitest para unidade e integração; Testing Library para componentes; Playwright para
contrato HTTP, ponta a ponta e acessibilidade; axe-core para verificações automatizadas; PostgreSQL
descartável em Docker para testes de integração

**Target Platform**: Navegadores modernos; servidor Linux VPS x86_64 com Docker, mínimo inicial de
2 vCPU, 4 GB de RAM e 80 GB SSD

**Project Type**: Aplicação web full-stack monolítica modular, com duas superfícies de interface e
um único processo de aplicação

**Performance Goals**: Páginas interativas em até 2,5 segundos no percentil 75 em rede móvel
moderada; operações comuns em até 1 segundo no percentil 95; atualização compartilhada visível em
até 5 segundos; documentos disponíveis em até 10 segundos em 95% das solicitações

**Constraints**: Um único servidor; aplicação e banco em Docker somente na produção; em
desenvolvimento, apenas PostgreSQL em Docker e aplicação executada por `npm`; ausência de Redis,
fila, CDN, microserviços e orquestrador; `/doar` sem login e com até três passos; `/admin` protegido
no servidor; WCAG 2.2 AA; valores em BRL com decimal exato; instantes persistidos em UTC e exibidos
em `America/Fortaleza`; integrações financeiras e de mensagens simuladas

**Scale/Scope**: Até 100 acessos públicos e 20 administrativos simultâneos; 10 mil doadores, 100
mil lançamentos, 100 mil lotes/movimentações e 20 GB de documentos sem mudança arquitetural;
disponibilidade alvo de 99,5% ao mês, RPO de 6 horas e RTO de 4 horas

### UI Component Strategy

shadcn/ui será a fonte padrão de componentes reutilizáveis para `/admin` e `/doar`. Antes de criar
uma primitiva própria, a implementação deve reutilizar ou adaptar um componente adequado do
catálogo. Componentes específicos do domínio e composições próprias são permitidos quando não
houver equivalente, preservando os requisitos funcionais de acessibilidade, responsividade e
identidade visual definidos na especificação.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate

| Constitutional rule | Design evidence | Status |
|---|---|---|
| Fronteira `/admin` e `/doar` | Grupos de rotas, layouts, controladores e políticas separados; toda ação administrativa valida sessão e papel no servidor | PASS |
| Menor privilégio | Matriz de permissão central aplicada antes dos serviços de domínio; banco e documentos não são expostos pelo proxy | PASS |
| Acessibilidade padrão | HTML semântico, corpo mínimo de 18 px em `/doar`, foco visível, teclado, ajuda persistente, testes axe e manuais WCAG 2.2 AA | PASS |
| Fonte autoritativa única | Uma instância PostgreSQL e transações atômicas; não existem bancos ou caches de estado paralelos | PASS |
| Auditoria e privacidade | Tentativas de login e mutações relevantes persistidas; logs estruturados com redação de segredos e dados pessoais | PASS |
| Correção financeira | `numeric` para dinheiro, chave de idempotência, restrições e transações para lançamentos e documentos | PASS |
| Correção de estoque | Lotes bloqueados durante baixa, ordem por validade e entrada, descarte auditado e proibição de saldo negativo | PASS |
| Qualidade verificável | Testes de unidade, integração, contrato, E2E e acessibilidade organizados por risco e jornada | PASS |
| Simplicidade | Um repositório, uma aplicação, um banco, um servidor e Docker Compose; dependências externas somente para backup | PASS |
| Links e senhas protegidos | Argon2id para senhas; tokens aleatórios armazenados somente por hash e com validade/revogação | PASS |
| PDFs e temporalidade | Documentos derivados dos registros, volume privado, downloads autorizados, UTC no banco e fuso local na apresentação | PASS |

O gate pré-design passa sem exceções constitucionais.

### Post-Design Re-check

Os artefatos de Phase 1 mantêm as fronteiras em contratos distintos dentro da mesma aplicação,
definem invariantes transacionais no modelo, restringem documentos por autorização e incluem
cenários executáveis para permissões, idempotência, concorrência e acessibilidade. Não foi
introduzida exceção constitucional. **Resultado: PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-community-donations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── admin-api.openapi.yaml
│   └── public-api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/admin/          # páginas e layouts internos
│   ├── (public)/doar/          # fluxo público do doador
│   ├── api/admin/              # contratos HTTP administrativos
│   ├── api/public/             # contratos HTTP públicos
│   └── api/health/             # verificação operacional sem dados sensíveis
├── components/
│   ├── admin/                  # componentes densos do painel
│   ├── donor/                  # componentes acessíveis da rota pública
│   └── shared/                 # primitivas sem regra de autorização
├── server/
│   ├── auth/                   # sessão, senha, links e RBAC
│   ├── db/                     # cliente e transações Prisma
│   ├── domains/
│   │   ├── donors/
│   │   ├── finance/
│   │   ├── inventory/
│   │   ├── projects/
│   │   ├── reports/
│   │   └── users/
│   ├── documents/              # geração e entrega autorizada de PDF
│   ├── integrations/           # simuladores de pagamento e mensagens
│   └── observability/          # auditoria e logs redigidos
└── styles/

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

tests/
├── contract/
├── integration/
├── e2e/
├── accessibility/
└── unit/

deploy/
├── Caddyfile
├── compose.production.yaml
├── Dockerfile
└── scripts/
    ├── backup.sh
    ├── deploy.sh
    └── restore.sh

storage/
└── .gitkeep                    # PDFs reais ficam no volume, não no Git

compose.yaml                    # somente PostgreSQL para desenvolvimento/testes
package.json
```

**Structure Decision**: Um único projeto Next.js contém frontend e backend para reduzir build,
deploy e operação. A modularização ocorre por domínio dentro de `src/server/domains`, sem criar
serviços implantáveis separados. Os grupos de rota e contratos `/api/admin` e `/api/public`
preservam a fronteira de segurança exigida pela constituição. Produção usa somente os contêineres
necessários no mesmo Docker Compose e na mesma VPS.
