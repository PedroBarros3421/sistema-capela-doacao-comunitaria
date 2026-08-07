# Quickstart: Gestão de Doações Comunitárias

Este guia define como executar e validar a implementação planejada. Os comandos passam a existir
durante `$speckit-implement`; até lá, servem como contrato operacional para as tarefas.

## References

- [Feature specification](./spec.md)
- [Implementation plan](./plan.md)
- [Data model](./data-model.md)
- [Admin API contract](./contracts/admin-api.openapi.yaml)
- [Public API contract](./contracts/public-api.openapi.yaml)

## Prerequisites

- Node.js 24 LTS
- npm compatível com o Node.js 24
- Docker Engine e Docker Compose v2
- 4 GB de RAM livres para ambiente local completo e navegador de testes

## Development Setup

Em desenvolvimento, Docker executa **somente o PostgreSQL**. A aplicação Next.js roda diretamente
no host pelo npm para preservar recarga rápida, depuração e integração com o editor.

```bash
cp .env.example .env
docker compose up -d db
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Resultados esperados:

- `docker compose ps` mostra somente o serviço `db` como permanente;
- PostgreSQL 18 aceita conexões apenas pela porta local definida para desenvolvimento;
- `/doar` abre sem autenticação em `http://localhost:3000/doar`;
- `/admin` redireciona para login quando não existe sessão válida;
- o seed imprime somente credenciais de desenvolvimento não reutilizadas em produção.

Para encerrar:

```bash
docker compose stop db
```

Não use `docker compose down -v` em um ambiente que contenha dados úteis, pois remove o volume do
banco.

## Static and Automated Validation

Os testes de integração usam Testcontainers para iniciar PostgreSQL 18 efêmero. Docker deve estar
ativo, mas não é necessário configurar `TEST_DATABASE_URL` nem manter o serviço `db` de
desenvolvimento em execução para essas suítes.

```bash
npm run lint
npm run typecheck
npm run contract:validate
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:a11y
```

Os scripts devem falhar com código diferente de zero quando qualquer gate abaixo não for atendido.

## Critical Validation Scenarios

### 1. Public donation and idempotency

```bash
npm run test:e2e -- donation-public.spec.ts
```

Expected:

1. A pessoa conclui uma simulação em no máximo três passos, sem conta.
2. O resultado mostra claramente que Pix/cartão são simulações.
3. Repetir a confirmação com a mesma chave retorna o mesmo lançamento.
4. Livro-caixa e dashboard mostram uma única entrada com origem pública em até cinco segundos.
5. Doador identificado recebe o link pessoal somente na resposta de confirmação; o banco contém
   apenas o hash desse segredo.

### 2. Authentication, RBAC, and blocking

```bash
npm run test:e2e -- admin-auth-rbac.spec.ts
```

Expected:

1. Acesso direto a toda rota administrativa sem sessão é negado.
2. Financeiro não altera usuários nem estoque; voluntário não acessa finanças; administrador geral
   executa todas as ações.
3. A quinta senha incorreta consecutiva bloqueia a conta.
4. Senha correta não remove o bloqueio; somente administrador geral desbloqueia.
5. Desativar ou mudar o papel afeta a requisição seguinte, mesmo em sessão já criada.

### 3. Reusable and revocable links

```bash
npm run test:integration -- access-links.test.ts
```

Expected:

- Convite, redefinição e “Minha conta” funcionam repetidamente dentro dos 30 dias.
- Alterar senha não revoga automaticamente o link reutilizável.
- Expiração, alteração do token ou revogação explícita bloqueia todo uso posterior.
- Nenhum token bruto aparece em banco, logs ou eventos de auditoria.

### 4. Donor matching and conflict review

```bash
npm run test:integration -- donor-matching.test.ts
```

Expected:

- A associação prioriza CPF/CNPJ, depois e-mail e depois telefone normalizados.
- Nome isolado nunca associa registros.
- Quando e-mail e telefone apontam para pessoas diferentes, uma pessoa provisória e uma revisão
  são criadas; a contribuição não é atribuída a um candidato existente.
- Resolver por separação ou mesclagem preserva histórico e auditoria.

### 5. Concurrent inventory movement

```bash
npm run test:integration -- inventory-concurrency.test.ts
```

Expected:

1. A sugestão ordena por validade, entrada e identificador, deixando validade ausente por último.
2. Duas baixas concorrentes nunca produzem quantidade negativa.
3. Uma distribuição pode consumir múltiplos lotes na mesma transação.
4. Descarte parcial reduz saldo; descarte total do remanescente muda o lote para `DISCARDED`.
5. Quantidades descartadas reconciliam com o relatório do período.

### 6. Public report publication

```bash
npm run test:e2e -- public-report.spec.ts
```

Expected:

- Alterar lançamentos muda a prévia administrativa, mas não uma publicação anterior.
- Publicar cria novo snapshot imutável e registra o administrador.
- `/doar` exibe somente a publicação mais recente, sem dados pessoais.
- A versão anterior continua disponível para auditoria interna.

### 7. Documents and retry safety

```bash
npm run test:integration -- documents.test.ts
```

Expected:

- Recibo exige entrada confirmada e CPF/CNPJ válido.
- Termo deriva os dados do lote.
- Repetir geração não altera o registro de origem nem cria documentos conflitantes.
- Arquivos privados só são entregues a administrador autorizado ou ao link do próprio doador.

### 8. Accessibility

```bash
npm run test:a11y
```

Além da automação, executar manualmente os fluxos `/doar` em 320 px, 768 px e desktop, com teclado,
zoom de 200% e leitor de tela. Confirmar:

- corpo de texto mínimo de 18 px e alvos de 44×44 px;
- foco visível e não oculto;
- botão “Chamar um voluntário” na mesma ordem relativa em todas as telas;
- erros descritos em texto e anunciados por tecnologia assistiva;
- instruções visuais passo a passo mesmo quando áudio não estiver disponível;
- revisão e correção dos dados antes da confirmação financeira.

## Production Validation on the VPS

Produção executa proxy, aplicação e banco em Docker. Use um arquivo de ambiente fora do Git e uma
imagem construída a partir do commit aprovado.

```bash
docker compose --env-file /etc/capela/capela.env \
  -f deploy/compose.production.yaml config
docker compose --env-file /etc/capela/capela.env \
  -f deploy/compose.production.yaml up -d --build
docker compose -f deploy/compose.production.yaml ps
curl --fail --silent https://DOMINIO_DA_CAPELA/api/health
```

Expected:

- `caddy`, `app` e `db` estão saudáveis e têm política de reinício;
- somente portas 80 e 443 são publicadas; PostgreSQL não é alcançável externamente;
- HTTPS usa certificado válido e HTTP redireciona para HTTPS;
- a aplicação grava PDFs e PostgreSQL grava dados em volumes persistentes;
- o health check não revela versão, credenciais, caminhos ou dados pessoais.

## Backup and Restore Drill

O backup é um contêiner efêmero/profile, não um serviço permanentemente exposto.

```bash
docker compose --env-file /etc/capela/capela.env \
  -f deploy/compose.production.yaml --profile maintenance run --rm backup
docker compose --env-file /etc/capela/capela.env \
  -f deploy/compose.production.yaml --profile maintenance run --rm restore --verify-only
```

Expected:

- backup inclui dump consistente do PostgreSQL e PDFs;
- artefato é criptografado e copiado para destino fora da VPS;
- logs não contêm conteúdo de documentos nem credenciais;
- verificação comprova que o conjunto é legível e possui checksums válidos;
- a cada trimestre, uma restauração completa em ambiente isolado confirma RPO de 6 horas e RTO de
  4 horas.

## Release Gate

Uma versão só pode ir para produção quando:

1. todas as migrações aplicam em cópia recente e o caminho de rollback está documentado;
2. lint, tipos, contratos e todas as suítes passam;
3. permissões, idempotência, concorrência e acessibilidade passam nos cenários acima;
4. backup anterior ao deploy está confirmado;
5. política de retenção foi aprovada pelo responsável da capela; e
6. nenhum adaptador simulado aparenta cobrança ou entrega real.
