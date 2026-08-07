# Feature Specification: Gestão de Doações Comunitárias

**Feature Branch**: N/A — nenhum hook de criação de branch está configurado

**Created**: 2026-08-06

**Status**: Draft

**Input**: Sistema web responsivo para gerir doações financeiras e físicas de uma capela,
com painel interno protegido em `/admin` e experiência pública acessível em `/doar`.

## Clarifications

### Session 2026-08-06

- Q: Como a prestação de contas deve se tornar visível na página pública? → A: Somente a versão
  mais recente publicada explicitamente por um administrador.
- Q: Quais dados devem determinar automaticamente se uma nova doação pertence a um doador já
  existente? → A: CPF/CNPJ exato; sem documento, e-mail exato; depois telefone exato. Conflitos
  exigem revisão manual.
- Q: Por quanto tempo e quantas vezes os links de convite, redefinição de senha e “Minha conta”
  devem poder ser usados? → A: Todos são reutilizáveis por 30 dias e revogáveis.
- Q: Quando uma conta administrativa deve ser temporariamente bloqueada após tentativas de login
  malsucedidas? → A: Após 5 falhas consecutivas, até desbloqueio por administrador geral.
- Q: Como o sistema deve registrar o descarte de itens vencidos, danificados ou impróprios para
  distribuição? → A: Descarte parcial ou total com quantidade, motivo, data e responsável; reduzir
  o saldo e marcar o lote como descartado quando totalmente baixado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Doar dinheiro sem criar conta (Priority: P1)

Como doador presencial ou remoto, quero fazer uma doação financeira única ou mensal em um
fluxo simples e acessível, para contribuir com a capela sem criar conta ou senha.

**Why this priority**: A captação de recursos é o valor público central do produto e precisa
funcionar para pessoas com diferentes níveis de familiaridade digital.

**Independent Test**: Um doador pode escolher tipo e valor, selecionar Pix ou cartão, indicar
um destino e concluir a simulação em até três passos, recebendo confirmação; a contribuição
aparece automaticamente no painel interno com sua origem.

**Acceptance Scenarios**:

1. **Given** que o doador está na tela pública, **When** escolhe uma doação única, um valor,
   Pix e um projeto, **Then** visualiza o código de pagamento, confirma a simulação e recebe
   um resumo de agradecimento sem criar conta.
2. **Given** que o doador escolheu contribuição mensal, **When** conclui a simulação,
   **Then** a contribuição recorrente fica registrada como ativa e vinculada ao doador.
3. **Given** que o doador não escolheu projeto, **When** confirma “onde for mais necessário”,
   **Then** a doação fica registrada com esse destino geral.
4. **Given** que o doador informou CPF ou CNPJ válido, **When** a contribuição financeira é
   confirmada, **Then** pode obter um recibo vinculado à contribuição.
5. **Given** que uma pessoa usa somente teclado ou recursos assistivos, **When** percorre o
   fluxo, **Then** consegue identificar controles, ouvir ou ler instruções e concluir a doação.

---

### User Story 2 - Acessar o painel conforme o papel (Priority: P1)

Como integrante autorizado da capela, quero entrar com e-mail e senha e acessar somente os
módulos permitidos pelo meu papel, para trabalhar com segurança e privacidade.

**Why this priority**: Todas as operações internas dependem de uma fronteira de acesso segura
e de permissões aplicadas de forma consistente.

**Independent Test**: Contas dos três papéis podem entrar e sair; cada uma vê e executa apenas
as ações permitidas, enquanto usuários anônimos e contas sem autorização são bloqueados.

**Acceptance Scenarios**:

1. **Given** uma conta ativa com credenciais válidas, **When** o usuário entra, **Then** acessa
   o painel e vê somente módulos e ações autorizados para seu papel.
2. **Given** credenciais inválidas, conta inativa, pendente ou bloqueada, **When** há uma tentativa
   de entrada, **Then** o acesso é negado com a mensagem correspondente e a tentativa é registrada.
3. **Given** uma pessoa sem sessão válida, **When** tenta acessar qualquer tela interna,
   **Then** não recebe dados administrativos e é direcionada à entrada.
4. **Given** um usuário que esqueceu a senha, **When** solicita redefinição, **Then** recebe a
   mesma confirmação independentemente de o e-mail existir e pode definir uma senha válida por
   meio de um link autorizado e vigente.

---

### User Story 3 - Controlar o livro-caixa e indicadores (Priority: P1)

Como administrador geral ou responsável financeiro, quero acompanhar entradas, saídas e
indicadores consolidados, para conhecer a situação financeira e corrigir pendências.

**Why this priority**: A capela precisa transformar contribuições em informação confiável para
decisões operacionais e prestação de contas.

**Independent Test**: Um usuário autorizado consulta KPIs e lançamentos, aplica filtros e cria
um lançamento manual; totais e origem dos registros permanecem rastreáveis.

**Acceptance Scenarios**:

1. **Given** contribuições e despesas no mês, **When** o usuário abre o dashboard, **Then** vê
   total arrecadado, total gasto, saldo, doadores ativos e itens próximos do vencimento.
2. **Given** lançamentos de diferentes períodos, projetos e tipos, **When** aplica filtros,
   **Then** a tabela e os totais exibem somente os registros correspondentes.
3. **Given** uma doação concluída em `/doar`, **When** o financeiro consulta o livro-caixa,
   **Then** encontra o lançamento com origem pública claramente identificada.
4. **Given** autorização para lançar manualmente, **When** registra entrada ou saída válida,
   **Then** o lançamento é salvo e a ação registra o usuário responsável.

---

### User Story 4 - Receber e distribuir itens por lote (Priority: P1)

Como voluntário de estoque, quero registrar cada recebimento como lote e distribuir itens pelos
lotes que vencem primeiro, para reduzir perdas e manter rastreabilidade.

**Why this priority**: Doações físicas são parte central da operação social e exigem controle
por validade, quantidade e destino.

**Independent Test**: O voluntário cadastra dois lotes do mesmo item com validades distintas,
consulta o consolidado e registra uma distribuição que consome corretamente o lote elegível
com vencimento mais próximo.

**Acceptance Scenarios**:

1. **Given** um item já existente no estoque, **When** ocorre novo recebimento, **Then** um novo
   lote independente é criado sem misturar quantidade, validade ou doador.
2. **Given** lotes elegíveis com validades diferentes, **When** o voluntário inicia uma saída,
   **Then** o sistema sugere primeiro o lote com vencimento mais próximo e permite ajuste
   autorizado antes da confirmação.
3. **Given** uma saída maior que a quantidade de um lote, **When** há quantidade suficiente em
   outros lotes, **Then** a distribuição é dividida proporcionalmente e cada baixa é registrada.
4. **Given** um lote a 7 ou 30 dias do vencimento, **When** o estoque é consultado, **Then** o
   risco é destacado por cor e também por texto ou outro indicador não cromático.
5. **Given** um bem de maior valor, **When** o voluntário solicita o termo, **Then** recebe um
   documento com descrição, valor estimado, doador e vínculo ao lote.
6. **Given** itens vencidos ou impróprios em um lote, **When** o voluntário registra descarte
   parcial ou total com motivo, **Then** a quantidade disponível é reduzida, a ação é auditada e o
   lote recebe estado descartado somente quando todo o saldo é baixado dessa forma.

---

### User Story 5 - Informar itens aceitos para doação (Priority: P2)

Como administrador geral ou voluntário de estoque, quero definir quais itens são aceitos e
prioritários, para que doadores recebam orientação atualizada antes da entrega presencial.

**Why this priority**: A orientação reduz entregas inadequadas e direciona a solidariedade às
necessidades atuais, embora a operação possa iniciar com comunicação manual.

**Independent Test**: Um usuário autorizado altera aceitação e prioridade; a tela pública passa
a mostrar a mesma configuração e explica onde entregar, sem tentar cadastrar um lote.

**Acceptance Scenarios**:

1. **Given** um item marcado como aceito e prioritário, **When** o doador abre a doação de itens,
   **Then** vê o item destacado e a orientação de entrega presencial.
2. **Given** um item pausado, **When** a lista pública é exibida, **Then** ele não aparece como
   aceito no momento.
3. **Given** que o doador consulta itens, **When** termina a leitura, **Then** não é solicitado a
   informar peso, validade ou valor, pois o cadastro ocorre no recebimento pelo voluntário.

---

### User Story 6 - Gerir doadores e recorrências (Priority: P2)

Como administrador geral ou responsável financeiro, quero consultar o histórico dos doadores e
as contribuições recorrentes, para manter relacionamento e acompanhar compromissos ativos.

**Why this priority**: A visão consolidada apoia continuidade das receitas e atendimento ao
doador sem ser necessária para registrar a primeira contribuição.

**Independent Test**: Uma doação pública com contato cria ou associa um doador, aparece na linha
do tempo e pode ser consultada pelo responsável autorizado.

**Acceptance Scenarios**:

1. **Given** um doador sem registro anterior, **When** conclui uma doação identificada,
   **Then** um registro de doador é criado com origem pública e recebe a contribuição no histórico.
2. **Given** um doador já identificável por CPF/CNPJ ou, na ausência deste, por e-mail ou telefone
   normalizado sem conflito, **When** faz nova contribuição, **Then** o evento é associado ao
   registro existente sem criar duplicata evitável.
3. **Given** uma contribuição recorrente ativa, **When** o doador usa um link pessoal válido,
   **Then** pode consultar seu próprio histórico e editar valor, pausar ou cancelar a recorrência.
4. **Given** somente um CPF, CNPJ ou referência Pix, **When** alguém tenta consultar doações,
   **Then** nenhum histórico é revelado até que uma verificação adicional de posse seja concluída.

---

### User Story 7 - Prestar contas ao público (Priority: P2)

Como gestor da capela, quero gerar uma prestação de contas consolidada, e como doador quero ver
uma versão pública simples, para entender a destinação dos recursos e confiar no trabalho social.

**Why this priority**: Transparência reforça confiança e permite acompanhar dinheiro e bens na
mesma visão por projeto.

**Independent Test**: Um usuário autorizado gera o relatório de um período; uma pessoa sem
login acessa a visão pública derivada dos mesmos dados, sem visualizar informações pessoais.

**Acceptance Scenarios**:

1. **Given** doações financeiras e lotes valorados no período, **When** o relatório é gerado,
   **Then** os valores são consolidados por projeto com distinção entre dinheiro e bens.
2. **Given** itens parados, vencidos ou descartados, **When** o gestor consulta o relatório,
   **Then** vê indicadores de giro e perdas no período.
3. **Given** que um administrador publicou uma versão da prestação de contas, **When** alguém abre
   “Veja onde seu dinheiro vai”, **Then** visualiza a versão publicada mais recente, com números
   grandes e gráfico simples, sem autenticação nem dados pessoais.

---

### User Story 8 - Administrar usuários e projetos (Priority: P3)

Como administrador geral, quero criar e manter usuários e projetos, além de revisar acessos,
para preservar a governança da operação.

**Why this priority**: É essencial para a continuidade operacional, mas o MVP pode iniciar com
usuários e projetos previamente configurados.

**Independent Test**: Um administrador cria uma conta pendente, altera papel e status, reenvia
o convite, consulta o histórico de acesso e cria ou desativa um projeto.

**Acceptance Scenarios**:

1. **Given** dados válidos de nome, e-mail e papel, **When** o administrador cria um usuário,
   **Then** a conta fica pendente e recebe um link de definição de senha, nunca senha temporária.
2. **Given** um usuário existente, **When** o administrador desativa a conta, **Then** novas
   entradas são impedidas sem apagar o histórico associado.
3. **Given** tentativas de acesso registradas, **When** o administrador filtra por usuário e
   período, **Then** vê data, usuário ou e-mail tentado, endereço de origem, dispositivo e status.
4. **Given** um projeto sem uso futuro, **When** é desativado, **Then** deixa de aceitar novos
   vínculos e permanece visível nos registros históricos.
5. **Given** uma conta bloqueada por falhas de login, **When** um administrador geral a desbloqueia,
   **Then** a contagem de falhas é zerada e a conta ativa pode voltar a tentar entrar.

### Edge Cases

- Uma confirmação pública repetida por atualização, duplo toque ou perda de conexão não pode
  criar contribuições, doadores ou recorrências duplicadas.
- Valores livres iguais a zero, negativos, excessivos ou em formato inválido devem ser rejeitados
  antes da confirmação, com preservação dos dados válidos já informados.
- CPF/CNPJ inválido não impede uma doação anônima, mas impede a emissão do recibo identificado.
- Se a simulação de pagamento não for concluída, o lançamento permanece pendente ou não é criado,
  conforme o estado apresentado ao doador; nunca aparece como confirmado indevidamente.
- Uma recorrência pausada ou cancelada não pode gerar novas cobranças simuladas; cancelamento não
  apaga contribuições anteriores.
- E-mail ou telefone ausente impede o envio do link de acesso pessoal, mas não a doação avulsa.
- Links expirados, alterados ou revogados não podem revelar dados, alterar credenciais nem
  modificar uma recorrência.
- Uma saída de estoque não pode usar lote esgotado, descartado, vencido sem autorização explícita,
  ou quantidade superior ao total disponível.
- Itens sem validade devem ser ordenados depois dos lotes válidos com vencimento conhecido, salvo
  ajuste autorizado e auditado.
- Alterações simultâneas no mesmo lote não podem produzir quantidade disponível negativa.
- A desativação de usuário, projeto ou item não pode apagar nem tornar incoerente seu histórico.
- Uma conta bloqueada não pode entrar nem redefinir a contagem por nova tentativa; somente um
  administrador geral autenticado pode desbloqueá-la.
- Se os identificadores informados apontarem para doadores diferentes, o sistema deve criar uma
  pendência de revisão e não pode mesclar nem associar automaticamente a contribuição.
- Quando não houver dados no período, dashboards e relatórios devem mostrar estado vazio e totais
  zero, sem gráficos enganosos.
- Falha na geração de documento deve preservar o registro original e permitir nova tentativa sem
  criar recibos ou termos conflitantes.
- A indisponibilidade da leitura em voz alta não pode bloquear o fluxo; instruções visuais
  equivalentes devem permanecer disponíveis.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE manter `/doar` publicamente acessível sem exigir conta, senha ou
  autenticação em qualquer etapa de doação.
- **FR-002**: O sistema DEVE exigir autenticação válida para toda tela, dado e ação de `/admin` e
  aplicar permissões às operações, não apenas à visibilidade dos menus.
- **FR-003**: O sistema DEVE oferecer os papéis fixos administrador geral, financeiro e voluntário
  de estoque; administrador geral acessa todos os módulos, financeiro acessa finanças, doadores,
  recibos e relatórios, e voluntário acessa estoque, itens aceitos e termos de bens.
- **FR-004**: O sistema DEVE autenticar usuários internos por e-mail e senha e distinguir
  credenciais inválidas, conta inativa, conta pendente e conta bloqueada. Cinco falhas consecutivas
  devem bloquear a conta até que um administrador geral a desbloqueie; uma entrada válida antes do
  limite deve zerar a contagem.
- **FR-005**: O sistema DEVE registrar cada tentativa de entrada com instante, usuário ou e-mail
  tentado, endereço de origem, dispositivo e resultado, permitindo filtro por usuário e período.
- **FR-006**: O sistema DEVE permitir solicitação e conclusão segura de redefinição de senha sem
  revelar se o e-mail existe; a nova senha deve conter ao menos oito caracteres, uma letra e um
  número, e o link deve seguir a validade e revogação definidas em FR-046.
- **FR-007**: Somente o administrador geral DEVE poder criar, editar, desativar, reativar,
  desbloquear e reenviar convite de usuários; desbloquear deve zerar a contagem de falhas, e novos
  usuários devem definir a própria senha por link autorizado.
- **FR-008**: Cada usuário autenticado DEVE poder revisar seus dados básicos e trocar a própria
  senha mediante confirmação apropriada.
- **FR-009**: O sistema DEVE apresentar no dashboard mensal total arrecadado, total gasto, saldo em
  caixa, doadores ativos e itens próximos do vencimento, além de comparações por projeto e entre
  doações recorrentes e avulsas.
- **FR-010**: O sistema DEVE listar lançamentos financeiros com valor, data, doador ou anonimato,
  projeto, método, status e origem, com filtros por período, projeto e tipo.
- **FR-011**: Usuários financeiros autorizados DEVEM poder criar lançamentos manuais de entrada e
  saída, e cada criação deve registrar seu autor e instante.
- **FR-012**: Uma doação financeira concluída em `/doar` DEVE gerar uma única contribuição
  financeira visível no livro-caixa e nos indicadores, com origem pública identificada.
- **FR-013**: O fluxo financeiro público DEVE conter no máximo três passos: tipo e valor; método;
  destino, revisão e confirmação.
- **FR-014**: O doador DEVE poder escolher doação única ou mensal, valores sugeridos ou valor livre,
  Pix ou cartão, um projeto ativo ou “onde for mais necessário”.
- **FR-015**: Nesta entrega, Pix, cartão e recorrência DEVEM ser claramente apresentados como
  simulações e não podem efetuar ou aparentar cobrança real fora do estado demonstrativo.
- **FR-016**: O sistema DEVE exibir confirmação e resumo somente após uma simulação bem-sucedida e
  impedir duplicidade causada por repetição da mesma confirmação.
- **FR-017**: Uma doação identificada de pessoa ainda não registrada DEVE criar automaticamente um
  doador com origem pública. Para associar novas doações, o sistema deve buscar primeiro CPF/CNPJ
  exato; na ausência de documento, e-mail normalizado exato; e, por último, telefone normalizado
  exato. Nome isolado nunca autoriza associação, e qualquer conflito entre identificadores deve
  impedir a associação automática e gerar revisão manual.
- **FR-018**: Usuários autorizados DEVEM poder listar doadores, filtrar ou localizar registros e ver
  contato, vínculo e linha do tempo de contribuições.
- **FR-019**: Uma doação mensal concluída DEVE criar uma recorrência vinculada ao doador, contendo
  valor, estado, método, próxima referência de cobrança e destino.
- **FR-020**: O acesso público ao histórico próprio e à gestão de recorrência DEVE ocorrer por link
  pessoal vigente ou por consulta seguida de verificação adicional de posse; CPF, CNPJ ou referência
  Pix isolados não podem conceder acesso, e o link deve seguir FR-046.
- **FR-021**: Um doador autorizado DEVE poder alterar o valor futuro, pausar ou cancelar sua
  recorrência sem modificar o histórico financeiro já confirmado.
- **FR-022**: O sistema DEVE manter cadastro de projetos com nome e estado, permitindo ao
  administrador geral criar, editar, ativar e desativar projetos sem apagar vínculos históricos.
- **FR-023**: O sistema DEVE manter catálogo de itens com categoria, unidade e valor médio por
  unidade, aceitando quilograma, unidade e litro.
- **FR-024**: Cada recebimento físico DEVE criar um lote independente com item, quantidade recebida
  e disponível, entrada, validade opcional, doador, valor estimado, origem do valor e estado.
- **FR-025**: O valor estimado do lote DEVE poder ser informado manualmente ou calculado como
  quantidade multiplicada pelo valor médio vigente; o sistema deve preservar qual regra foi usada.
- **FR-026**: O estoque DEVE apresentar total consolidado por item e permitir detalhamento de lotes,
  quantidades, origens e validades.
- **FR-027**: Lotes a vencer em até 7 dias e entre 8 e 30 dias DEVEM ter níveis distintos de alerta
  perceptíveis sem depender exclusivamente de cor.
- **FR-028**: Ao distribuir itens, o sistema DEVE sugerir os lotes elegíveis com vencimento mais
  próximo, dividir a baixa entre lotes quando necessário e permitir ajuste manual autorizado.
- **FR-029**: Cada distribuição DEVE registrar quantidades por lote, data, projeto, observação e
  usuário responsável, sem permitir saldo negativo ou consumo de lote inelegível sem justificativa.
- **FR-030**: Usuários de estoque autorizados DEVEM poder definir cada item como aceito ou pausado e
  prioritário ou comum; a lista pública deve refletir a configuração vigente.
- **FR-031**: A doação pública de itens DEVE ser apenas informativa, apresentar itens aceitos e
  orientação presencial e não permitir que o doador crie um lote.
- **FR-032**: Usuários autorizados DEVEM poder gerar termo de doação de bens a partir de um lote,
  contendo descrição, valor estimado, doador, data e vínculo ao registro de origem.
- **FR-033**: Usuários autorizados DEVEM poder gerar prestação de contas por período e categoria,
  consolidando contribuições financeiras e valor estimado de bens por projeto e mostrando giro,
  itens vencidos e descartados.
- **FR-034**: O sistema DEVE publicar uma visão simplificada da prestação de contas, sem login e sem
  dados pessoais, com números legíveis e gráfico por projeto derivados dos mesmos registros; essa
  visão deve exibir somente a versão mais recente publicada explicitamente por um administrador.
- **FR-035**: Quando CPF ou CNPJ válido for informado em contribuição financeira, o sistema DEVE
  permitir gerar recibo contendo os dados da contribuição e vínculo ao registro original.
- **FR-036**: Recibos e termos DEVEM estar disponíveis em documento visualizável e exportável, e sua
  geração ou nova tentativa não pode alterar o registro de origem.
- **FR-037**: A rota `/doar` DEVE usar texto de corpo de ao menos 18 px, alto contraste, controles
  grandes com rótulos textuais, foco visível, navegação por teclado e uma ação principal por tela.
- **FR-038**: Toda tela de `/doar` DEVE manter “Chamar um voluntário” visível e oferecer leitura em
  voz alta ou instruções visuais passo a passo equivalentes.
- **FR-039**: O sistema DEVE preservar e exibir em `/admin` a origem de contribuições, doadores e
  demais registros recebidos da experiência pública.
- **FR-040**: Alterações confirmadas em doações, recorrências, configurações públicas e estoque
  DEVEM aparecer para seus usuários autorizados sem reconciliação ou recadastro manual.
- **FR-041**: Ações administrativas relevantes DEVEM registrar ator, instante, ação, registro
  afetado e resultado, incluindo lançamentos manuais, mudanças de usuário e distribuições.
- **FR-042**: O sistema DEVE preservar valores financeiros exatos, moeda, instantes inequívocos e
  invariantes que impeçam duplicações, quantidades negativas e atualizações parciais.
- **FR-043**: Informações pessoais, de acesso e documentos DEVEM ser exibidos somente a públicos
  autorizados e não podem aparecer em logs, relatórios públicos ou mensagens além do necessário.
- **FR-044**: `/admin` DEVE priorizar uso em desktop, e `/doar` DEVE priorizar tablet e celular;
  ambas as experiências devem permanecer funcionais nos demais tamanhos de tela suportados.
- **FR-045**: O sistema DEVE preservar cada versão publicada da prestação de contas com período,
  conteúdo, instante e administrador responsável, sem alterar versões anteriores quando os dados
  de origem ou publicações posteriores mudarem.
- **FR-046**: Links de convite, redefinição de senha e “Minha conta” DEVEM permanecer reutilizáveis
  por 30 dias desde a emissão, permitir revogação antes do vencimento e negar qualquer uso depois
  da expiração ou revogação.
- **FR-047**: Usuários de estoque autorizados DEVEM poder registrar descarte parcial ou total com
  quantidade, motivo, data e responsável. O descarte deve reduzir a quantidade disponível sem
  apagar o lote; quando consumir todo o saldo remanescente, deve mudar o lote para descartado.

### Key Entities *(include if feature involves data)*

- **Usuário**: Integrante interno identificado por nome e e-mail, com papel, estado ativo, pendente,
  inativo ou bloqueado, contagem de falhas, último acesso e credencial protegida; relaciona-se às
  ações administrativas realizadas.
- **Tentativa de Login**: Evento de entrada bem-sucedido ou falho, associado quando possível a um
  usuário e contendo instante, origem e identificação do dispositivo.
- **Doador**: Pessoa ou organização que doa dinheiro ou bens, com contato, documento opcional,
  vínculo, origem e histórico; CPF/CNPJ normalizado é único quando informado, e-mail e telefone
  são identificadores secundários na ausência de documento; não representa obrigatoriamente uma
  conta autenticada.
- **Recorrência**: Compromisso mensal de um doador, com valor, estado, método, próxima referência de
  cobrança e projeto de destino.
- **Lançamento Financeiro**: Entrada ou saída com valor, moeda, data, doador opcional, projeto,
  método, estado e origem; alimenta livro-caixa, dashboard, recibos e relatórios.
- **Projeto**: Destino ativo ou histórico das doações financeiras e distribuições físicas.
- **Item de Estoque**: Tipo de bem com nome, categoria, unidade e valor médio de referência.
- **Lote de Estoque**: Recebimento rastreável de um item, com quantidades recebida e disponível,
  entrada, validade opcional, doador, valoração, origem da valoração e estado.
- **Movimentação de Estoque**: Distribuição vinculada a um projeto e a um ou mais lotes, contendo
  quantidades, data, observação e usuário responsável.
- **Descarte de Estoque**: Baixa parcial ou total de um lote por vencimento, dano ou outra
  impropriedade, contendo quantidade, motivo, data e usuário responsável; alimenta os indicadores
  de perda sem apagar o histórico do lote.
- **Configuração de Item Aceito**: Estado público de aceitação e prioridade de cada item.
- **Recibo de Doação**: Documento financeiro vinculado a um lançamento e doador identificado.
- **Termo de Doação de Bens**: Documento vinculado a um lote, com descrição, valor e doador.
- **Publicação de Prestação de Contas**: Versão aprovada e imutável de um relatório, com período,
  conteúdo público, instante e administrador responsável; a publicação mais recente alimenta a
  página pública e as anteriores permanecem disponíveis para auditoria administrativa.
- **Link de Acesso**: Permissão secreta e revogável para convite, redefinição ou acesso pessoal,
  contendo finalidade, titular, emissão, expiração em 30 dias e eventual instante de revogação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pelo menos 90% dos participantes representativos, incluindo pessoas idosas com baixa
  familiaridade digital, concluem a doação financeira simulada na primeira tentativa, sem ajuda.
- **SC-002**: A mediana de conclusão da doação financeira é de até 3 minutos e nenhum caminho de
  sucesso exige mais de 3 passos ou criação de conta.
- **SC-003**: 100% das tentativas sem autenticação de acessar conteúdo administrativo são bloqueadas
  sem exposição de dados internos.
- **SC-004**: 100% das ações testadas para cada papel respeitam a matriz de permissões definida,
  inclusive quando a ação é tentada por acesso direto.
- **SC-005**: 100% das doações públicas concluídas aparecem uma única vez no livro-caixa e nos
  indicadores autorizados em até 5 segundos após a confirmação.
- **SC-006**: Em todos os cenários de teste com lotes elegíveis, a sugestão de distribuição começa
  pelo vencimento mais próximo e nenhuma operação produz quantidade negativa.
- **SC-007**: Totais dos relatórios reconciliam 99% com os lançamentos financeiros e valores de
  lotes incluídos no mesmo período e projeto.
- **SC-008**: Mudanças em itens aceitos aparecem para novos acessos à tela pública em até 5 segundos,
  sem intervenção ou recadastro do doador.
- **SC-009**: Recibos e termos válidos ficam disponíveis ao usuário autorizado em até 10 segundos
  em pelo menos 95% das solicitações de teste.
- **SC-010**: Todas as telas e fluxos essenciais de `/doar` passam por verificação de contraste,
  teclado, foco, rótulos, ampliação e alternativa à leitura em voz alta sem bloqueio crítico.
- **SC-011**: Pelo menos 90% dos participantes de teste conseguem identificar a destinação dos
  recursos e o projeto com maior valor na visão pública em até 30 segundos.
- **SC-012**: Nenhum teste de repetição de confirmação, concorrência de estoque ou nova tentativa de
  documento produz registro financeiro duplicado, saldo negativo ou documento conflitante.
- **SC-013**: Em 99% dos cenários de descarte, a redução do saldo do lote e o total de perdas no
  relatório reconciliam com as quantidades registradas nos descartes do período.

## Assumptions

- O escopo representa uma primeira entrega completa do produto descrito, incluindo “Minha conta”
  como jornada secundária, mas sem autenticação tradicional do doador.
- Pix, cartão e cobrança recorrente são simulados nesta entrega; integração com gateway e cobrança
  real permanecem fora de escopo.
- Os fluxos de convite, redefinição e acesso pessoal geram links reutilizáveis por 30 dias e
  revogáveis, além dos pedidos de envio; a entrega real por e-mail ou WhatsApp depende de provedor
  externo e pode ser simulada nesta fase.
- Um link pessoal vigente é o meio principal de acesso a “Minha conta”. Consulta por CPF, CNPJ ou
  referência Pix exige verificação adicional por um contato previamente associado.
- Doações anônimas são permitidas. A identificação é necessária para histórico pessoal,
  recorrência gerenciável e emissão de recibo nominal.
- O valor médio de um item é uma referência administrativa, não avaliação fiscal automática; o
  usuário autorizado pode registrar valor manual quando necessário.
- Para FIFO por validade, lotes sem validade conhecida são sugeridos depois de lotes elegíveis com
  vencimento conhecido; ajustes precisam de autorização e auditoria.
- Projetos, usuários, itens e registros com histórico são desativados, não apagados fisicamente no
  fluxo normal de negócio.
- A política detalhada de retenção e descarte de dados pessoais será definida antes da operação
  real, respeitando a finalidade, o acesso mínimo e as obrigações legais aplicáveis.
- O protótipo `Capela Vida Nova - Prototipo.dc.html` é referência de fluxo, textos e estados, mas
  não impõe estrutura técnica nem substitui os critérios desta especificação.
- Para os indicadores, saldo em caixa significa entradas confirmadas menos saídas confirmadas até
  o fim do período; doador ativo significa pessoa com recorrência ativa ou ao menos uma doação
  confirmada nos 12 meses anteriores à data de referência.

### Scope Boundaries

**Included**:

- Experiências completas de `/admin` e `/doar`, dados compartilhados, simulações financeiras,
  gestão de recorrências, estoque por lote, relatórios, recibos, termos e auditoria descritos aqui.
- Geração e validação dos links necessários aos fluxos de convite, redefinição e acesso pessoal,
  ainda que a entrega externa seja simulada.

**Excluded**:

- Cobrança real por Pix ou cartão e integração com gateway de pagamento.
- Envio efetivo por provedor de e-mail, WhatsApp ou notificação push.
- Cobrança automática real das contribuições recorrentes.
- Cadastro público de lotes ou coleta antecipada de peso, validade e valor dos bens pelo doador.
- Uso do protótipo como imposição de arquitetura ou como fonte de dados de produção.
