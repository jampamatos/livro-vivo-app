# Auditoria funcional de rotas criticas do app (B1-01)

## Metadados
- ID: `B1-01`
- Byte alvo: `UX-B1.1`
- Estimativa: `M`
- Ciclo: `UI/UX 2026-03-09`
- Data da auditoria: `2026-03-11`
- Base de revisao:
  - `App.tsx`
  - `src/screens/*.tsx` (rotas principais)
  - `docs/` (registro e checklist)

## Contexto
Este diagnostico foi executado apos o fechamento do bloco pre-deploy para orientar o ciclo de UX estrutural antes do refinamento visual.

## Objetivo
Mapear friccoes de navegacao e execucao de tarefa nas rotas principais, com priorizacao objetiva para as issues `B1-02` e `B1-03`.

## Escopo auditado
- Login
- Main
- Library/Reader
- CaseLaw
- Community (feed, post, novo post)
- Course
- Templates
- Conta
- Casos transversais de navegacao (shell/voltar/sair)

## Metodo
- Leitura funcional ponta a ponta de `App.tsx` e rotas criticas.
- Revisao de estados de carregamento/erro/vazio.
- Revisao de clareza de tarefa principal por tela.
- Revisao de baseline de acessibilidade e consistencia de navegacao.
- Validacao local de estabilidade: `typecheck` e `test`.

## Mapa de fluxos criticos (ponta a ponta)
1. Autenticacao e sessao:
   `Login -> sucesso -> Main -> navegacao por modulos -> logout -> Login`.
2. Leitura:
   `Main -> Biblioteca -> abrir livro -> abrir capitulo -> busca interna -> anotar -> navegar capitulo`.
3. Jurisprudencia:
   `Main -> Jurisprudencia -> filtro/busca -> detalhe -> copiar ementa -> abrir acordao`.
4. Comunidade:
   `Main -> Comunidade -> abrir post -> comentar/seguir/denunciar -> voltar feed`.
5. Curso:
   `Main -> Curso -> lista de posts/lives -> detalhe de post -> abrir material/live`.
6. Pecas:
   `Main -> Banco de Pecas -> detalhe -> gerar token -> iniciar download`.
7. Conta:
   `Main -> Conta -> preferencias notificacao -> exportacao LGPD -> exclusao (DELETE)`.
8. Busca global:
   `Main -> Busca Global -> abrir resultado -> deep link para Library/CaseLaw/Community`.

## Friccoes registradas por tela/fluxo

| ID | Tela/Fluxo | Friccao | Severidade | Impacto |
|---|---|---|---|---|
| F-01 | Navegacao global | Navegacao manual por estado local em `App.tsx` gera alto acoplamento de rotas e comportamento de voltar heterogeneo entre modulos. | Media | Aumenta ambiguidade de navegacao e custo de evolucao. |
| F-02 | Navegacao global | Fallback de `communityPost` faz `setRoute` durante render quando `selectedPost` e nulo. | Alta | Pode causar flicker/comportamento inesperado de transicao em bordas de estado. |
| F-03 | Main | Falha ao carregar entitlements derruba acesso por regra de "Sem assinatura" sem diferenciar indisponibilidade temporaria de API. | Alta | Bloqueio funcional indevido do usuario. |
| F-04 | Main | Ausencia de acao de retry explicita para revalidar permissao no proprio contexto da tela. | Media | Usuario fica preso sem caminho claro de recuperacao. |
| F-05 | Main/Planejamento | Busca Global ja e rota principal, mas nao estava contemplada no recorte oficial da auditoria/checklist anterior. | Media | Gap entre planejamento e estado real do app. |
| F-06 | Library | `LibraryScreen` concentra muitas responsabilidades (carga, busca, reader, anotacoes, modais, progresso). | Alta | Dificulta manutencao e aumenta risco de regressao em ajustes UX. |
| F-07 | Library | Mensagens de erro tecnicas (incluindo payload JSON) em texto de interface. | Media | Aumenta carga cognitiva e reduz clareza para usuario final. |
| F-08 | Reader | Paineis de busca, indice e anotacao podem coexistir e competir por atencao no mesmo contexto. | Media | Leitura perde linearidade e foco de tarefa principal. |
| F-09 | Reader (mobile) | Fluxo de anotacao por long press/fallback e pouco descobrivel sem onboarding explicito. | Alta | Funcionalidade central pode parecer "inexistente". |
| F-10 | Community Feed | Fluxo fica preso na categoria `Geral` (fallback), sem seletor de categoria no app. | Media | Limita navegabilidade por tema e escala de comunidade. |
| F-11 | Community Feed/Novo Post | Padrao de acessibilidade e microcopy de acoes e menos consistente que nas rotas auditadas com teste dedicado. | Media | Inconsistencia de usabilidade entre modulos. |
| F-12 | Community Post | Envio de comentario executa recarga completa de post+comentarios. | Baixa | Custo de resposta percebida maior em rede lenta. |
| F-13 | Course | Nao ha mecanismos de filtro/pesquisa por tipo/tag nas listas principais. | Media | Dificulta achar conteudo quando volume crescer. |
| F-14 | Templates | Nao ha filtro/sort por categoria/tags/versao no fluxo principal. | Media | Reduz eficiencia para tarefa de encontrar peca certa. |
| F-15 | Conta | Secao "Ajustes da conta" mostra acoes desabilitadas (editar perfil/alterar senha) no fluxo principal. | Baixa | Frustracao e ruido de interface em tela de alta densidade. |
| F-16 | Cross-modulo | Padrao visual/estrutural ainda depende de estilos hardcoded por tela, sem fundacao unificada de tokens/componentes base. | Media | Retrabalho esperado na transicao para UI-B2. |
| F-17 | Cross-modulo | Estados de erro/vazio/carregamento seguem linguagem e estrutura diferentes por modulo. | Media | Experiencia menos previsivel e menos aprendivel. |
| F-18 | Documentacao operacional | Registro anterior de auditoria e README nao refletem integralmente o estado funcional atual do app. | Media | Planejamento perde precisao e rastreabilidade. |

## Priorizacao por impacto x esforco (backlog de UX estrutural)

### Prioridade P0 (atacar primeiro)
| ID | Acao recomendada | Friccoes alvo | Impacto | Esforco | Destino |
|---|---|---|---|---|---|
| O-01 | Corrigir fallback de navegacao sem side effect em render e padronizar transicoes de volta entre rotas criticas. | F-01, F-02 | Alto | P | B1-02 |
| O-02 | Ajustar Main para estado degradado de entitlements (erro != sem assinatura) com CTA de retry. | F-03, F-04 | Alto | P | B1-02 |
| O-03 | Refatorar `LibraryScreen` em camadas (orquestrador + subfluxos reader/search/annotation). | F-06 | Alto | M | B1-03 |
| O-04 | Tornar modo anotacao descobrivel no mobile (hint inicial contextual e confirmacao de gesto). | F-09 | Alto | P | B1-03 |

### Prioridade P1
| ID | Acao recomendada | Friccoes alvo | Impacto | Esforco | Destino |
|---|---|---|---|---|---|
| O-05 | Definir exclusividade/ordem de foco entre paineis do Reader (indice, busca, anotacao). | F-08 | Medio | P | B1-03 |
| O-06 | Padronizar contrato UX para estados async (loading/erro/vazio) em todas as rotas criticas. | F-07, F-17 | Medio | M | B1-03 |
| O-07 | Incluir seletor de categoria na Comunidade e melhorar findability de feed. | F-10 | Medio | M | B1-03 |
| O-08 | Incluir filtros basicos em Course e Templates (categoria/tag/tipo). | F-13, F-14 | Medio | M | B1-03 |

### Prioridade P2
| ID | Acao recomendada | Friccoes alvo | Impacto | Esforco | Destino |
|---|---|---|---|---|---|
| O-09 | Limpar placeholders desabilitados de Conta ou mover para estado "Em breve" menos intrusivo. | F-15 | Baixo | P | B1-03 |
| O-10 | Atualizar docs operacionais para refletir baseline real do app e escopo de rotas. | F-05, F-18 | Medio | P | B1-02 |
| O-11 | Iniciar fundacao de tokens/componentes base para preparar UI-B2 sem retrabalho. | F-16 | Medio | M | B2-01 |

## Pacote recomendado para as proximas issues

### Para B1-02 (Main + entrada de modulos)
1. O-01
2. O-02
3. O-10

### Para B1-03 (secoes criticas)
1. O-03
2. O-04
3. O-05
4. O-06
5. O-07
6. O-08
7. O-09

## Checklist operacional de validacao funcional

### Gate de fluxo critico
- [x] Login com credenciais validas leva a Main.
- [x] Logout encerra sessao local e retorna ao fluxo de autenticacao.
- [x] Main aplica gating de modulo por tier e bloqueios de moderacao.
- [x] Busca Global abre resultado e navega para modulo esperado.
- [x] Biblioteca abre livro/versao atual, carrega capitulo e preserva progresso local.
- [x] Reader executa navegacao anterior/proximo, busca no livro e fluxo de anotacao.
- [x] Jurisprudencia permite filtrar, abrir detalhe, copiar ementa e abrir acordao.
- [x] Comunidade permite abrir post, comentar, denunciar e seguir/desseguir.
- [x] Curso permite abrir detalhe de post, materiais e lives relacionadas.
- [x] Templates permite detalhe e download via token temporario.
- [x] Conta permite alternar preferencias, exportar dados e solicitar exclusao.

### Gate de consistencia UX estrutural
- [x] Cada rota critica tem acao principal visivel.
- [x] Cada rota critica possui estado de carregamento/erro/vazio.
- [x] Acoes destrutivas/sensiveis possuem confirmacao ou guardrail.
- [x] Labels de botoes principais sao orientados a tarefa.
- [x] Fluxos de voltar/sair sao reproduziveis sem beco sem saida.

### Gate tecnico de regressao
- [x] `npm run typecheck`
- [x] `npm test -- --runInBand --ci`
- [x] Checklist de rotas criticas permanece versionado em `docs/`.

## Resultado da auditoria (conclusao)
- Criterio 1: **friccoes registradas por tela/fluxo** -> concluido.
- Criterio 2: **oportunidades priorizadas por impacto/esforco** -> concluido.
- Criterio 3: **checklist de validacao funcional definido** -> concluido.

Pronto para iniciar `B1-02` com recorte P0 e em seguida `B1-03` com pacote estrutural priorizado.
