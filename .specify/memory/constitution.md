<!--
Sync Impact Report
- Version change: template (unratified) -> 1.0.0
- Modified principles:
  - Template principle 1 -> I. Fronteiras de Acesso e Menor Privilégio
  - Template principle 2 -> II. Acessibilidade como Padrão
  - Template principle 3 -> III. Integridade, Rastreabilidade e Auditoria
  - Template principle 4 -> IV. Correção do Domínio de Doações
  - Template principle 5 -> V. Qualidade Verificável e Simplicidade
- Added sections:
  - Restrições de Produto e Segurança
  - Fluxo de Desenvolvimento e Portões de Qualidade
- Removed sections: none
- Follow-up TODOs: none
-->
# Constituição do Sistema de Gestão de Doações da Capela Comunitária

## Core Principles

### I. Fronteiras de Acesso e Menor Privilégio
A aplicação DEVE manter uma fronteira explícita entre a experiência pública em `/doar` e a
operação interna em `/admin`. Toda tela, consulta e mutação administrativa DEVE exigir uma
sessão válida e autorização no servidor conforme um dos papéis fixos do produto. Ocultar itens
de interface NÃO substitui autorização. A rota pública NÃO DEVE solicitar criação de conta,
senha ou autenticação para concluir uma doação. Dados e componentes compartilhados NÃO DEVEM
permitir que informações internas sejam expostas pela rota pública. Essa separação protege
doadores e operações sensíveis sem criar barreiras à doação.

### II. Acessibilidade como Padrão
Toda experiência em `/doar` DEVE ser concebida para a pessoa com menor familiaridade digital,
sem oferecer uma variante menos acessível aos demais públicos. Texto de corpo DEVE ter pelo
menos 18 px; contraste, foco visível, navegação por teclado, rótulos textuais e alvos de toque
amplos DEVEM ser verificados. O fluxo principal DEVE ser linear, conter no máximo três passos
para concluir uma doação e manter a ação “Chamar um voluntário” disponível. Cada tela DEVE
oferecer leitura em voz alta ou instruções visuais passo a passo equivalentes. Nenhuma ação
essencial PODE depender somente de cor, ícone, áudio ou gesto. Acessibilidade é requisito de
aceite, não melhoria opcional.

### III. Integridade, Rastreabilidade e Auditoria
As duas rotas DEVEM operar sobre a mesma fonte autoritativa de dados, e toda alteração
confirmada DEVE ficar visível aos consumidores autorizados sem reconciliação manual. Registros
gerados em `/doar` DEVEM preservar sua origem e ser identificáveis em `/admin`. Tentativas de
login e ações administrativas relevantes, incluindo lançamentos manuais e distribuições de
estoque, DEVEM registrar ator, instante, resultado e contexto suficiente para auditoria. Valores
financeiros DEVEM usar representação decimal exata; atualizações de saldo, lote ou assinatura
DEVEM ser atômicas e impedir duplicação, saldo negativo e baixa concorrente inconsistente.
Logs NÃO DEVEM conter senhas, tokens, dados completos de pagamento ou dados pessoais além do
necessário. Essas regras sustentam transparência e prestação de contas confiável.

### IV. Correção do Domínio de Doações
Cada recebimento físico DEVE criar um lote rastreável, mesmo quando já existir estoque do mesmo
item. Quantidade disponível NÃO PODE exceder a recebida nem ficar negativa. Distribuições DEVEM
sugerir primeiro os lotes elegíveis com vencimento mais próximo; qualquer ajuste manual DEVE
ser autorizado e auditado. Valores estimados DEVEM indicar se foram informados manualmente ou
calculados a partir da quantidade e do valor médio vigente. Lançamentos financeiros DEVEM
preservar tipo, valor, data, projeto, método, status, origem e doador quando informado. Recibos,
termos e relatórios DEVEM ser derivados dos registros persistidos, nunca de totais paralelos ou
dados mockados. Regras e estados do domínio DEVEM ser aplicados no servidor e cobertos por
invariantes testáveis.

### V. Qualidade Verificável e Simplicidade
Cada mudança DEVE ter critérios de aceite observáveis e testes proporcionais ao risco. Regras
financeiras, permissões, autenticação, recorrência, inventário por lote e integrações entre
`/doar` e `/admin` EXIGEM testes automatizados de unidade e integração; os fluxos críticos de
doação e administração EXIGEM testes de ponta a ponta. Correções de defeitos DEVEM incluir um
teste de regressão quando tecnicamente viável. O projeto DEVE preferir a solução mais simples
que preserve as invariantes, evitando abstrações, serviços ou estados duplicados sem uma
necessidade demonstrada. Dados mockados DEVEM ficar isolados do caminho de produção.

## Restrições de Produto e Segurança

- `/admin` DEVE ser otimizado para desktop e permanecer utilizável nos tamanhos de tela
  suportados; `/doar` DEVE priorizar tablet e celular e funcionar em desktop.
- Senhas DEVEM ser armazenadas somente por meio de hash resistente e apropriado para senhas.
  Links de convite, redefinição e acesso pessoal DEVEM ser de uso restrito, expiráveis e
  armazenados de forma que seu segredo não seja recuperável do banco de dados.
- Recuperação de senha NÃO DEVE revelar se um e-mail está cadastrado. Mensagens específicas de
  login PODEM distinguir estados somente quando isso estiver de acordo com o modelo de ameaça
  aprovado e houver proteção contra enumeração e força bruta.
- CPF/CNPJ, contatos, IP e histórico de acesso DEVEM ser coletados apenas para finalidade
  definida, ter acesso restrito e seguir política documentada de retenção e descarte.
- Integrações externas DEVEM ser encapsuladas por contratos substituíveis. Simulações de
  pagamento ou e-mail DEVEM estar explicitamente marcadas e NÃO PODEM aparentar uma transação
  real concluída em produção.
- Documentos PDF DEVEM ser gerados a partir de dados validados, possuir vínculo com o registro
  de origem e respeitar as mesmas regras de autorização e privacidade da tela equivalente.
- Horários DEVEM ser persistidos de forma inequívoca e exibidos no fuso aplicável; valores
  monetários DEVEM registrar sua moeda.

## Fluxo de Desenvolvimento e Portões de Qualidade

Toda funcionalidade DEVE partir de uma especificação revisável, com histórias independentes,
critérios de aceite e casos de erro. O plano técnico DEVE explicitar mudanças de esquema,
autorização, tratamento de dados pessoais, auditoria e estratégia de teste. Migrações DEVEM ser
compatíveis com dados existentes, reversíveis quando razoável e validadas antes da implantação.

Antes da integração, a revisão DEVE confirmar:

1. conformidade com esta Constituição e rastreabilidade aos critérios da especificação;
2. autorização no servidor e ausência de exposição indevida entre `/admin` e `/doar`;
3. preservação das invariantes financeiras e de estoque sob falhas e concorrência;
4. testes automatizados aprovados, incluindo acessibilidade e fluxos críticos afetados;
5. estados de carregamento, vazio, erro, repetição e sucesso tratados sem induzir o usuário a
   duplicar ações; e
6. documentação de decisões, migrações e operação atualizada quando houver impacto.

Exceções a um princípio DEVEM ser registradas antes da integração, conter justificativa, riscos,
responsável, prazo e plano de remoção. Urgência, isoladamente, NÃO constitui justificativa.

## Governance

Esta Constituição prevalece sobre convenções, planos e decisões técnicas conflitantes do
projeto. Especificações podem detalhar os princípios, mas NÃO PODEM enfraquecê-los implicitamente.

Emendas DEVEM ser propostas por alteração explícita deste arquivo, incluir motivação e relatório
de impacto, e ser aprovadas pelos responsáveis do projeto. A emenda DEVE indicar adaptações
necessárias em especificações, planos, tarefas, código ou operação; migrações incompatíveis
EXIGEM um plano antes da aprovação.

O versionamento segue SemVer: MAJOR para remoção ou redefinição incompatível de princípios;
MINOR para novo princípio, seção ou expansão material de obrigações; PATCH para esclarecimentos
sem alteração normativa. A data de última emenda DEVE mudar sempre que o conteúdo normativo for
alterado.

Toda especificação e todo plano DEVEM passar por verificação de conformidade antes da execução.
Toda revisão de código DEVE apontar violações ou declarar a conformidade pertinente. Uma revisão
formal desta Constituição DEVE ocorrer antes de cada entrega relevante ou, no mínimo, a cada
seis meses. Violações conhecidas DEVEM ser corrigidas ou formalizadas como exceções temporárias.

**Version**: 1.0.0 | **Ratified**: 2026-08-06 | **Last Amended**: 2026-08-06
