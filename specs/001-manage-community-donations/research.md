# Research: Gestão de Doações Comunitárias

## 1. Arquitetura da aplicação

**Decision**: Usar um monólito modular full-stack em Next.js 16, com App Router, TypeScript e
React, executado como um único contêiner de aplicação.

**Rationale**: O produto tem uma equipe e uma base de dados pequenas, regras fortemente
transacionais e duas experiências que compartilham o mesmo domínio. Um processo reduz contratos
internos, deploys e pontos de falha sem impedir a separação de segurança por rotas e módulos.
Next.js 16 suporta Linux, TypeScript e Node.js moderno e reúne páginas e handlers HTTP na mesma
unidade de implantação ([documentação oficial](https://nextjs.org/docs/app/getting-started/installation)).

**Alternatives considered**:

- Frontend React e backend separados: rejeitado por duplicar configuração, deploy e contratos.
- Microserviços/serverless: rejeitado por custo cognitivo e operacional desnecessário.
- Renderização somente no cliente: rejeitada porque aumenta exposição de regras e dificulta a
  proteção consistente de `/admin`.

## 2. Runtime e dependências

**Decision**: Fixar Node.js 24 LTS, TypeScript 5.x e versões de dependências por lockfile.

**Rationale**: Node.js 24 está em LTS até 2028 e é compatível com Next.js e Prisma. Prisma suporta
Node 24 e TypeScript 5.4 ou superior ([Node.js releases](https://nodejs.org/en/about/previous-releases),
[Prisma requirements](https://docs.prisma.io/docs/orm/reference/system-requirements)). Uma linguagem
única cobre interface, validação, domínio, documentos e testes.

**Alternatives considered**:

- Node.js 26 Current: rejeitado por ainda não ser LTS.
- Backend em outra linguagem: rejeitado por criar duas toolchains sem benefício necessário.

## 3. Persistência e consistência

**Decision**: Usar PostgreSQL 18 e Prisma ORM, com SQL explícito nas operações concorrentes de
estoque e finanças quando o ORM não expressar adequadamente bloqueios e restrições.

**Rationale**: PostgreSQL fornece transações, `numeric`, índices parciais, JSON e bloqueio de linhas
necessários às invariantes. A versão 18 tem suporte oficial até 2030
([política de versões](https://www.postgresql.org/support/versioning/)). Prisma reduz código de CRUD
e mantém migrações legíveis; transações críticas continuam verificáveis no banco.

**Alternatives considered**:

- SQLite: rejeitado por concorrência de escrita, operação em contêiner e evolução de relatórios.
- Banco gerenciado: rejeitado pelo pedido explícito de banco Docker na mesma VPS.
- Redis: rejeitado; sessão, idempotência e limites cabem no PostgreSQL nesta escala.

## 4. Autenticação e autorização

**Decision**: Implementar autenticação local com senha Argon2id e sessões opacas em cookie
`HttpOnly`, `Secure` e `SameSite=Lax`. O token de sessão terá somente seu hash armazenado; sessão
administrativa expira após 8 horas. Toda requisição administrativa consulta usuário ativo e papel.

**Rationale**: A autenticação local atende exatamente os estados pendente, ativo, inativo e
bloqueado, inclusive o bloqueio após cinco falhas até desbloqueio manual. Evita integrar um
provedor de identidade cujo comportamento de bloqueio diverge da regra esclarecida. A sessão no
banco permite revogação imediata e mantém a arquitetura em um servidor.

**Alternatives considered**:

- Amazon Cognito ou outro provedor: rejeitado por contrariar a simplificação em VPS e dificultar o
  bloqueio manual exato.
- JWT sem estado: rejeitado porque desativação e mudança de papel não seriam imediatas.
- Credenciais em armazenamento do navegador: rejeitado por ampliar impacto de scripts maliciosos.

## 5. Links de convite, redefinição e acesso pessoal

**Decision**: Gerar tokens aleatórios de 256 bits, guardar somente SHA-256 do token e finalidade,
titular, emissão, expiração e revogação. Todos são reutilizáveis por 30 dias, como decidido na
clarificação. Alterar uma senha não revoga o link automaticamente; revogação explícita e expiração
são as únicas formas de invalidá-lo.

**Rationale**: Tokens de alta entropia podem ser validados por hash sem que o segredo seja
recuperável do banco. Um único modelo atende às três finalidades e preserva a decisão funcional,
mesmo sendo menos restritiva que a prática usual para redefinição de senha.

**Alternatives considered**:

- Links de uso único: rejeitados porque contradizem a decisão registrada na especificação.
- Token em texto puro: rejeitado pela constituição.
- CPF/Pix como segredo: rejeitado por permitir descoberta e exposição de histórico.

## 6. Fronteiras pública e administrativa

**Decision**: Manter uma aplicação, mas separar layouts, rotas HTTP, validadores e serviços de
autorização. `/api/admin/**` exige sessão e papel; `/api/public/**` aceita somente operações e
projeções explicitamente públicas. Componentes compartilhados não acessam banco nem autorização.

**Rationale**: A separação lógica é suficiente para um único processo desde que validada no
servidor e coberta por testes de acesso direto. Isso preserva a simplicidade sem enfraquecer a
constituição.

**Alternatives considered**:

- Dois processos na mesma VPS: rejeitado por duplicar deploy e consumo de memória.
- Somente ocultar menus: rejeitado por não constituir autorização.

## 7. Transações, idempotência e estoque

**Decision**: Toda confirmação pública recebe chave de idempotência única. Lançamento, doador e
recorrência são gravados na mesma transação. Distribuições bloqueiam lotes elegíveis e os consomem
por validade ascendente, depois entrada e identificador; lotes sem validade vêm por último. Descarte
usa o mesmo livro de baixas, com tipo próprio e dados de auditoria.

**Rationale**: Restrições únicas e bloqueio de linhas impedem duplicação e saldo negativo mesmo com
duplo toque ou requisições concorrentes. A regra é tecnicamente FEFO (vence primeiro, sai primeiro),
embora a linguagem do produto a chame de FIFO por validade.

**Alternatives considered**:

- Verificar saldo apenas na interface: rejeitado por corrida concorrente.
- Fila para serializar baixas: rejeitada porque uma transação PostgreSQL resolve a escala prevista.
- Recalcular idempotência por conteúdo: rejeitado por colisões entre doações legítimas iguais.

## 8. Documentos e publicações

**Decision**: Gerar PDFs simples com `pdf-lib`, gravá-los em diretório privado de volume Docker e
servi-los por endpoint que reaplica autorização. Publicações públicas guardam um snapshot imutável
dos totais e linhas exibíveis; somente a publicação mais recente é projetada em `/doar`.

**Rationale**: Geração síncrona atende documentos pequenos e à meta de 10 segundos sem fila. Volume
privado evita expor CPF/CNPJ diretamente pelo servidor web. Snapshot preserva exatamente o que foi
publicado mesmo após correções nos registros de origem.

**Alternatives considered**:

- Armazenamento público: rejeitado por privacidade e enumeração de arquivos.
- Regenerar relatório público em cada acesso: rejeitado por quebrar imutabilidade e aprovação.
- Serviço assíncrono de PDF: rejeitado até que medições mostrem necessidade.

## 9. Integrações simuladas

**Decision**: Definir portas internas para pagamento e entrega de mensagens, com implementações
simuladas persistentes. A simulação de pagamento aceita estados pendente, confirmado e falho; a
caixa de saída registra destinatário, template, link e estado sem enviar mensagem real.

**Rationale**: As portas mantêm futura substituição possível, mas nenhuma integração real entra no
deploy atual. Os simuladores tornam fluxos e testes observáveis sem aparentar cobrança ou envio.

**Alternatives considered**:

- Gateway e SMTP reais: rejeitados por estarem fora de escopo.
- Condicionais espalhadas pela interface: rejeitadas porque dificultariam troca futura e testes.

## 10. Produção em uma VPS com Docker

**Decision**: Usar Docker Compose em produção com `caddy`, `app` e `db`; o banco não publica porta
no host. Caddy encerra TLS automaticamente e encaminha somente para a aplicação. Volumes nomeados
guardam banco, documentos e estado do Caddy. Imagens são imutáveis e reiniciam automaticamente.
Em desenvolvimento, `compose.yaml` inicia somente PostgreSQL; Node.js 24 e a aplicação são
executados no host com `npm install` e `npm run dev`.

**Rationale**: Docker Compose documenta toda a pilha e é suportado para implantação em um único
servidor ([Docker Compose em produção](https://docs.docker.com/compose/how-tos/production/)). Caddy
automatiza certificados e redirecionamento HTTPS
([documentação oficial](https://caddyserver.com/docs/automatic-https)). Executar somente a
dependência de dados em Docker no desenvolvimento preserva recarga rápida e depuração direta sem
criar divergência de versão do PostgreSQL.

**Alternatives considered**:

- Kubernetes ou Swarm: rejeitados por não haver múltiplos nós nem necessidade de orquestração.
- Instalação manual de Node/PostgreSQL no host: rejeitada por reduzir reprodutibilidade.
- Banco exposto na internet: rejeitado por segurança.

## 11. Backup, recuperação e operação

**Decision**: Executar a cada 6 horas um contêiner efêmero que produz `pg_dump`, inclui PDFs e envia
o conjunto criptografado para armazenamento fora da VPS. Manter 7 diários, 5 semanais e 12 mensais.
Testar restauração trimestralmente. Logs JSON vão para stdout com rotação do Docker; `/api/health`
verifica processo, banco e espaço de documentos sem revelar detalhes.

**Rationale**: Um único servidor exige cópia externa para sobreviver à perda da VPS. O procedimento
atinge RPO de 6 horas e RTO de 4 horas com muito menos operação que replicação ou cluster.

**Alternatives considered**:

- Backup apenas no volume local: rejeitado porque falha junto com a VPS.
- Replicação contínua: rejeitada pela prioridade de simplicidade e disponibilidade de 99,5%.
- Plataforma completa de observabilidade: rejeitada; logs rotacionados, health check e monitor
  externo simples cobrem o primeiro estágio.

## 12. Acessibilidade e qualidade

**Decision**: Adotar WCAG 2.2 nível AA como alvo verificável. Usar HTML nativo, instruções visuais
passo a passo como alternativa obrigatória ao áudio, corpo de 18 px em `/doar`, alvos de pelo menos
44×44 px e revisão antes de confirmar dados financeiros. Executar axe e testes por teclado, zoom e
leitor de tela nos fluxos críticos.

**Rationale**: WCAG 2.2 recomenda AA e inclui foco não oculto, ajuda consistente, tamanho mínimo de
alvo e prevenção de erro financeiro ([W3C](https://www.w3.org/TR/WCAG22/)). Alvos de 44 px superam o
mínimo normativo e atendem melhor o público idoso.

**Alternatives considered**:

- Widget de acessibilidade: rejeitado por não corrigir marcação ou fluxos.
- Áudio obrigatório em todos os navegadores: rejeitado porque instruções visuais equivalentes já
  cumprem a especificação e são mais previsíveis.

## 13. Retenção e privacidade

**Decision**: Implementar política configurável com padrão inicial: tentativas de login por 180
dias; sessões expiradas por 30 dias; links expirados/revogados por 180 dias sem guardar o segredo;
auditoria, lançamentos e documentos por 5 anos; cadastro do doador enquanto houver vínculo e por 5
anos depois, com anonimização quando o histórico puder ser preservado sem identificação. A política
deve ser aprovada pelo responsável da capela antes de produção.

**Rationale**: A LGPD exige eliminação ao término do tratamento, mas admite conservação para
obrigação legal ou regulatória; portanto, prazos precisam ter finalidade documentada
([ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes)). Configuração e
anonimização evitam codificar uma retenção imutável como se fosse determinação legal universal.

**Alternatives considered**:

- Retenção indefinida: rejeitada por minimização e risco de privacidade.
- Exclusão imediata de todo histórico: rejeitada por auditoria e prestação de contas.

## 14. Isolamento dos testes de integração

**Decision**: Executar cada suíte de integração contra um contêiner efêmero PostgreSQL 18 iniciado
por Testcontainers. As migrações aplicam no contêiner antes dos cenários e o contêiner é encerrado
ao final, sem depender de `DATABASE_URL`, `TEST_DATABASE_URL` ou do banco de desenvolvimento.

**Rationale**: O isolamento reproduz a versão real do banco, evita interferência entre execuções e
permite que os testes validem as rotas públicas completas, inclusive carregamento de projetos e
confirmação, sem substituir os endpoints por mocks.

**Alternatives considered**:

- Esquemas temporários em banco compartilhado: rejeitados por dependerem de serviço previamente
  configurado e permitirem divergência de versão ou estado.
- Banco em memória: rejeitado porque não reproduz tipos, constraints e transações do PostgreSQL.
