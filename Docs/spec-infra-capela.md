# Especificação de Infraestrutura Cloud (AWS)
## Sistema de Gestão de Doações — Capela Comunitária
### Documento produzido via metodologia Spec-Driven Development (SDD)

---

## 0. Por que SDD aqui, e como este documento se encaixa

Spec-Driven Development inverte a ordem tradicional: em vez de escrever código e depois documentar, a **especificação é o artefato central e executável do processo** — ela vem antes da implementação, é validada, e só então vira plano técnico e tarefas. O prompt de protótipo que vocês já têm (a especificação **funcional/UX**, feita no Claude Design) é o "o quê" e o "para quem". Este documento é a camada seguinte da mesma cadeia SDD: a **especificação técnica de infraestrutura**, que responde "com o quê isso roda, com que garantias, e a que custo".

A cadeia fica assim:

```
spec.md (funcional, já pronto)  →  spec-infra.md (este doc)  →  plan.md (arquitetura)  →  tasks.md (backlog de IaC)
```

Cada seção abaixo segue esse encadeamento: primeiro eu derivo **requisitos não funcionais** a partir do que já foi especificado funcionalmente (rastreabilidade — todo requisito de infra referencia a exigência funcional que o originou), depois transformo isso em **decisões de arquitetura AWS**, e por fim num **backlog** que pode virar issues/tasks no repositório.

---

## 1. Especificação — Requisitos não funcionais derivados do funcional

Esta é a etapa "specify" do SDD: ler a spec funcional e extrair, de forma explícita e rastreável, tudo que ela exige da infraestrutura mas não diz com todas as letras.

| # | Requisito não funcional | Origem no prompt funcional |
|---|---|---|
| RNF-01 | Duas superfícies com perfis de tráfego e criticidade diferentes (`/doar` público de alto tráfego potencial e leitura/escrita simples; `/admin` interno, baixo tráfego, autenticado) devem poder escalar e falhar de forma **independente** | "duas rotas completamente distintas... mesma base de dados" |
| RNF-02 | Autenticação robusta com RBAC (papéis: admin geral, financeiro, voluntário de estoque) só para `/admin`; **zero fricção de auth** em `/doar` | Seção 1.0 e seção 2 (explicitamente "não deve ter nenhum fluxo de autenticação") |
| RNF-03 | Auditoria de acesso persistente e consultável (histórico de login com IP/dispositivo, data/hora, sucesso/falha) | "Histórico de login" |
| RNF-04 | Integridade transacional forte no livro-caixa (não pode haver lançamento perdido ou duplicado) | "Livro-caixa / lançamentos financeiros" |
| RNF-05 | Consistência FIFO no controle de estoque por lote, com jobs recorrentes para marcar vencimento próximo | "Controle de estoque físico... FIFO" |
| RNF-06 | Geração e armazenamento de documentos (recibo de doação, termo de doação de bens, relatório de prestação de contas) com retenção de longo prazo e possibilidade de auditoria externa | "documento que fica arquivado e pode ser solicitado em auditoria" |
| RNF-07 | Envio confiável de e-mail transacional (link de definição de senha, magic link de "Minha conta", recibo) — não pode cair em spam nem falhar silenciosamente | Múltiplas menções a e-mail em `/admin` e `/doar` |
| RNF-08 | Envio de notificação via WhatsApp (confirmação de doação, link do relatório público) | "recebe o link pelo WhatsApp" |
| RNF-09 | Processamento de pagamento (Pix com QR code dinâmico, cartão) com confirmação assíncrona (webhook) e conciliação automática com o livro-caixa | "Pix com QR code gerado na tela... escolha de método (Pix... ou cartão)" |
| RNF-10 | Dados pessoais de doadores (nome, CPF/CNPJ, contato) sob LGPD — residência de dados no Brasil, criptografia em repouso e em trânsito, minimização de dados coletados em `/doar` | Implícito por lidar com CPF/CNPJ e dados de contato de pessoas físicas |
| RNF-11 | Acessibilidade e desempenho em rede/dispositivo limitado (tablet fixo da secretaria, idosos, possível conexão instável) — carregamento rápido, sem dependência pesada de JS no primeiro paint | "fontes grandes... modo tablet presencial" |
| RNF-12 | Baixo custo operacional e previsível — é uma capela mantida por doação, não uma empresa com orçamento de infra | Contexto geral do cenário |
| RNF-13 | Backup e recuperação de desastre para dados financeiros e de estoque (não pode perder histórico de doações) | Implícito — dado financeiro/contábil |
| RNF-14 | Observabilidade mínima (alertas de erro, de falha de pagamento, de estoque vencendo) mesmo com equipe pequena e não técnica operando o dia a dia | Operação por voluntários, não por TI dedicada |

Essas 14 linhas são o contrato entre a spec funcional e a arquitetura. Qualquer decisão técnica na seção 2 deve apontar de volta para pelo menos um RNF — isso é o que dá rastreabilidade SDD ao trabalho (e é um ótimo ponto para a banca/professor, porque mostra método, não só "escolhi AWS porque sim").

---

## 2. Plano técnico — Arquitetura AWS

### 2.1 Princípios de decisão (a "constituição" da arquitetura)

1. **Serverless-first**: dado o RNF-12 (custo) e o RNF-01 (tráfego baixo e imprevisível), pagar por uso vence provisionamento fixo. EC2/ECS fica reservado para onde não há opção serverless madura.
2. **Separação de blast radius entre `/doar` e `/admin`**: mesmo compartilhando o banco, cada rota tem sua própria API, suas próprias permissões IAM e seus próprios limites de rate — uma falha ou pico em `/doar` não deve degradar `/admin` e vice-versa.
3. **IaC total, sem clique no console**: tudo em Terraform, com estado remoto (S3 + DynamoDB lock), para reprodutibilidade entre ambientes (dev/hml/prod) e para servir de artefato de avaliação do trabalho.
4. **Dados sensíveis nunca em texto plano**: Secrets Manager para credenciais, KMS para criptografia em repouso, nada de segredo em variável de ambiente commitada.

### 2.2 Mapeamento de componentes

**Frontend (ambas as rotas)**
- S3 (bucket privado) + CloudFront como CDN/edge, com Origin Access Control. Dois "sites" lógicos (`/admin` e `/doar`) podem ser dois builds separados atrás do mesmo CloudFront com path routing, ou duas distribuições — recomendo **duas distribuições** para isolar cache, headers de segurança (CSP mais permissiva em `/admin`) e, futuramente, WAF rules diferentes → atende RNF-01 e RNF-11.
- Certificate Manager (ACM) para TLS.

**API / Backend**
- API Gateway (HTTP API, mais barato que REST API) + Lambda, uma função (ou grupo de funções) por domínio: `auth`, `financeiro`, `estoque`, `relatorios`, `doacoes-publicas`. Runtime Node.js ou Python conforme preferência da equipe.
- Dois estágios/API Gateways separados — `admin-api` e `doar-api` — com autorizers diferentes (RNF-02): `admin-api` usa Cognito Authorizer; `doar-api` não exige token, mas tem **rate limiting agressivo e WAF** (proteção contra abuso, já que é anônimo).

**Autenticação (`/admin` apenas)**
- Amazon Cognito User Pool: usuários administrativos, grupos = papéis (admin geral, financeiro, voluntário de estoque), mapeados para scopes que o backend valida. Cobre login, "esqueci minha senha", força de senha, e o fluxo de "criação de usuário pelo sistema" (Cognito `AdminCreateUser` sem senha temporária visível, disparando e-mail de definição via SES customizado) → resolve RNF-02 e a seção 1.0 quase inteira sem reinventar auth.
- MFA opcional habilitável por grupo (bom para o perfil "administrador geral").

**Banco de dados**
- Aurora PostgreSQL Serverless v2 (um único cluster compartilhado pelas duas rotas, como pede o prompt) → escala automaticamente com o tráfego, custo baixo em repouso, mas mantém ACID/transações fortes para o livro-caixa (RNF-04) e suporte a FIFO por consulta (RNF-05) sem gambiarra de NoSQL.
- Em VPC privada, sem acesso público; Lambdas em subnets privadas acessam via RDS Proxy (evita esgotamento de conexões — aliás, exatamente o tipo de problema de "Aurora/RDS connection exhaustion" que você já mexeu no VS Lojas).

**Documentos (recibos, termos, relatórios)**
- S3 (bucket privado, versionado, com Object Lock em modo governance para os termos de doação de bens) + geração de PDF via Lambda (ex: lib de PDF em Node, ou serviço como Puppeteer em Lambda com layer). URLs de acesso via presigned URL de curta duração → RNF-06.
- Lifecycle policy movendo para S3 Glacier Instant Retrieval após 1 ano (retenção longa, custo baixo).

**Notificações**
- SES (e-mail transacional: definição de senha, recibo, link de "Minha conta") com domínio verificado e DKIM, para não cair em spam → RNF-07.
- WhatsApp: via API oficial da Meta (Cloud API) ou provedor (ex: Twilio), chamada a partir de uma Lambda assíncrona disparada por evento (EventBridge) após confirmação de doação → RNF-08.

**Pagamentos**
- Integração com Provedor de Pix/cartão (ex: Mercado Pago ou similar, que oferecem Pix com QR code dinâmico e webhook de confirmação) — API Gateway expõe endpoint de webhook, que cai numa fila **SQS** antes de processar (desacopla e garante retry se a Lambda de conciliação falhar) → resolve RNF-09 com tolerância a falha.
- A confirmação assíncrona grava o lançamento no livro-caixa como "confirmado", nunca o frontend grava diretamente — pagamento é sempre server-to-server.

**Processamento assíncrono / jobs**
- EventBridge Scheduler (cron) para: (a) varrer lotes de estoque e marcar/alertar vencimento em 7/30 dias, (b) gerar cobrança recorrente de dízimo, (c) consolidar KPIs diários para o dashboard não recalcular tudo em tempo real → RNF-05.

**Segurança e compliance**
- WAF na CloudFront de `/doar` (proteção contra bots/abuso num endpoint sem login).
- Secrets Manager para credenciais de banco e de integrações de pagamento/WhatsApp.
- KMS para criptografia em repouso (RDS, S3, Cognito).
- CloudTrail habilitado em todas as regiões relevantes, com trilha gravada em bucket separado com retenção — soma-se ao histórico de login da aplicação como evidência de auditoria → RNF-03 e RNF-10.
- Região **sa-east-1 (São Paulo)** para residência de dados no Brasil → RNF-10.

**Observabilidade**
- CloudWatch Logs + Metrics para todas as Lambdas; CloudWatch Alarms para: taxa de erro 5xx, falha de webhook de pagamento, falha de envio SES, lote vencendo sem baixa. Alarmes disparam para SNS → e-mail/WhatsApp dos responsáveis técnicos, não só um dashboard que ninguém olha → RNF-14 (equipe pequena, não técnica).
- X-Ray para tracing distribuído entre API Gateway → Lambda → RDS Proxy → Aurora, útil pra debugar latência sem depender de acesso direto ao banco.

**Backup e DR**
- Aurora: backups automáticos + point-in-time recovery (janela de pelo menos 7 dias) e snapshot manual antes de cada deploy de schema.
- S3: versionamento ligado nos buckets de documentos.
- RNF-13 coberto sem precisar de infraestrutura multi-região (não se justifica pelo porte do projeto — dá pra mencionar como "trabalho futuro" no relatório).

### 2.3 Diagrama de arquitetura (texto)

```
                          ┌─────────────────────────┐
                          │        Route 53          │
                          └────────────┬─────────────┘
                    ┌──────────────────┴──────────────────┐
              CloudFront (/doar)                  CloudFront (/admin)
                    │  + WAF                                │
              S3 (site doar)                          S3 (site admin)
                    │                                        │
            API Gateway (doar-api)                 API Gateway (admin-api)
              rate-limited, sem auth                Cognito Authorizer
                    │                                        │
                    └───────────────┬────────────────────────┘
                                     │
                         Lambdas (auth/financeiro/estoque/
                          relatorios/doacoes-publicas)
                                     │
                     RDS Proxy ──── Aurora PostgreSQL Serverless v2
                                     │            (VPC privada)
                     ┌───────────────┼────────────────┐
                     │               │                │
                   S3 (docs)      SQS (webhooks)   EventBridge (jobs/cron)
                     │               │                │
                Presigned URL   Lambda conciliação   Lambda vencimento/
                                  pagamento            recorrência/KPI
                                     │
                          Provedor Pix/Cartão (webhook)

        Transversal: SES (e-mail) · WhatsApp API · Secrets Manager · KMS ·
                      CloudWatch/X-Ray/Alarms · CloudTrail · Terraform (IaC)
```

### 2.4 Trade-off que vale registrar no trabalho

Vocês vão ser perguntados "por que não containers/K8s, já que é um tema de DevOps avançado?". Resposta honesta pra colocar no relatório: dado o **RNF-12 (custo)** e o volume de tráfego esperado (uma capela de bairro, não uma rede nacional), serverless minimiza custo em repouso e operação por equipe não técnica. K8s (EKS) adicionaria complexidade operacional e custo fixo de control plane sem ganho real aqui — é a arquitetura certa para o VS Lojas, não necessariamente para este cenário. Isso é um ponto de maturidade a favor de vocês: mostrar que sabem escolher a ferramenta pelo problema, não pela moda.

---

## 3. Backlog de infraestrutura (tasks.md — etapa "implement" do SDD)

Organizado por épico, pronto para virar issues:

**Épico: Fundação**
- [ ] Estrutura Terraform com backend remoto (S3 + DynamoDB lock), workspaces para dev/hml/prod
- [ ] VPC com subnets públicas/privadas, NAT Gateway (ou NAT instance para reduzir custo em dev)
- [ ] Módulo Terraform de rede reutilizável entre ambientes

**Épico: Auth e usuários (`/admin`)**
- [ ] Cognito User Pool + grupos (admin, financeiro, voluntário) + client app
- [ ] Fluxo de criação de usuário sem autocadastro (Lambda trigger `AdminCreateUser` + SES customizado)
- [ ] Cognito Authorizer no `admin-api`

**Épico: Dados**
- [ ] Aurora Serverless v2 + RDS Proxy em subnets privadas
- [ ] Schema inicial (migrations versionadas — ex: Flyway ou Prisma Migrate)
- [ ] Política de backup e PITR

**Épico: APIs**
- [ ] `admin-api` (API Gateway HTTP API) + Lambdas por domínio
- [ ] `doar-api` com rate limiting e WAF
- [ ] Testes de contrato entre frontend (Claude Design) e as duas APIs

**Épico: Pagamentos e conciliação**
- [ ] Integração webhook Pix/cartão → SQS → Lambda de conciliação
- [ ] Idempotência no processamento de webhook (evitar lançamento duplicado)

**Épico: Documentos e notificações**
- [ ] Bucket S3 versionado + geração de PDF (recibo, termo, relatório)
- [ ] Domínio verificado no SES + templates de e-mail
- [ ] Integração WhatsApp Business API

**Épico: Jobs e observabilidade**
- [ ] EventBridge Scheduler para vencimento de lote, cobrança recorrente, consolidação de KPI
- [ ] Dashboards CloudWatch + alarmes críticos → SNS
- [ ] CloudTrail + bucket de auditoria

**Épico: CI/CD**
- [ ] Pipeline GitHub Actions: lint/test → `terraform plan` em PR → `terraform apply` manual/aprovado em prod
- [ ] Ambientes dev/hml/prod isolados por conta AWS (ou por workspace, se orçamento não permitir multi-conta)
- [ ] Rotação de revisor automática nos PRs de infra (o mesmo padrão que você já usa no VS Lojas)

---

## 4. Próximos passos sugeridos

1. Validar este documento com o professor/orientador como "spec de infra" formal antes de partir para os módulos Terraform.
2. Escolher o provedor de Pix (isso muda o desenho do webhook e vale uma pesquisa rápida antes de fechar o `plan.md`).
3. Decidir conta única vs. multi-conta AWS (Organizations) — para um trabalho acadêmico, conta única com workspaces Terraform costuma ser suficiente e mais barato de demonstrar.
