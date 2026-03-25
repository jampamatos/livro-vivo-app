# Pre-Deploy Smoke Test

Checklist manual para homologação do app antes do primeiro deploy do ciclo `Pré Deploy`.

## Ambiente

- [ ] app abre em `web` e `mobile` sem warnings críticos visíveis
- [ ] modo `claro` e `escuro` carregam sem regressão visual
- [ ] safe area respeitada no topo e na barra inferior do mobile
- [ ] teclado não cobre ações principais em `Login`, `Novo post` e `Minha conta`

## Sessão

- [ ] login com credenciais válidas funciona
- [ ] login inválido mostra erro legível
- [ ] cadastro funciona e cria sessão válida
- [ ] logout fecha a sessão e volta para login
- [ ] refresh de token mantém a sessão viva após `401`
- [ ] sessão inválida força retorno controlado para login

## Home

- [ ] cards principais carregam sem travar
- [ ] módulos abrem a rota correta
- [ ] atualizações recentes aparecem ou exibem estado vazio adequado
- [ ] card de próxima aula só aparece quando existir live `scheduled` ou `live`

## Biblioteca e leitor

- [ ] lista de livros carrega
- [ ] último livro aberto aparece primeiro
- [ ] leitor abre capítulo corretamente
- [ ] navegação anterior/próxima funciona
- [ ] swipe entre páginas no mobile está fluido
- [ ] modo escuro do leitor está legível
- [ ] busca no capítulo não quebra o fluxo do leitor

## Jurisprudência

- [ ] busca retorna resultados
- [ ] filtros por tribunal funcionam
- [ ] ordenação e carregamento incremental funcionam
- [ ] estado vazio aparece quando não há resultados

## Comunidade

- [ ] feed carrega com paginação automática
- [ ] abrir post funciona
- [ ] comentários carregam automaticamente ao descer
- [ ] criar novo post funciona
- [ ] curtir/descurtir post funciona
- [ ] curtir/descurtir comentário funciona
- [ ] seguir/desseguir notificações do post funciona
- [ ] denunciar post/comentário funciona
- [ ] posts removidos continuam destacados
- [ ] avatar e nome aparecem corretamente em posts e comentários
- [ ] menções `@nome composto` destacam corretamente

## Banco de Peças

- [ ] busca por título, descrição e tag funciona
- [ ] filtros por categoria funcionam
- [ ] changelog abre e fecha no card
- [ ] download do modelo dispara corretamente
- [ ] modo escuro mantém contraste no CTA principal

## Curso

- [ ] live `Ao vivo` aparece antes de `Agendada`
- [ ] destaque visual de live `Ao vivo` está mais forte que `Agendada`
- [ ] feed filtra por tipo
- [ ] posts de conteúdo abrem detalhe
- [ ] post com live relacionada respeita status:
  - [ ] `scheduled` -> `Em breve`
  - [ ] `live` -> `Entrar ao vivo`
  - [ ] `finished` -> `Assistir gravação`

## Minha Conta

- [ ] resumo da conta abre no menu do avatar
- [ ] editar nome e profissão funciona
- [ ] upload de avatar funciona
- [ ] cropper permite zoom e arraste sem jitter
- [ ] avatar atualizado aparece no topo e na comunidade
- [ ] alterar senha funciona
- [ ] notificações salvam corretamente
- [ ] exportar dados responde com estado correto
- [ ] fluxo de exclusão mostra confirmação adequada

## Busca Global

- [ ] busca abre sem topbar redundante
- [ ] estado inicial orienta o usuário
- [ ] erro de busca permite retry
- [ ] resultados abrem o módulo correto

## Regressão visual

- [ ] nenhuma tela auxiliar exibe botões antigos redundantes de `Voltar` e `Sair`
- [ ] CTAs principais têm contraste suficiente em claro e escuro
- [ ] nenhum texto importante fica cortado no mobile
- [ ] barra inferior mobile não cobre conteúdo acionável

## Gate final

- [ ] smoke test completo sem bloqueio `P0`
- [ ] migrations aplicadas em homologação
- [ ] variáveis de ambiente revisadas
- [ ] build candidata a deploy aprovada
