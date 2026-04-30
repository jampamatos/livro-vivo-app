# Livro Vivo App

Cliente Expo/React Native do Livro Vivo.

## Estado atual

Implementado e ativo em `main`:

- Login/registro com JWT, refresh silencioso e logout.
- Reset de senha por e-mail.
- Login social Google no web e no Android beta, com deep link nativo `livrovivo://auth/callback`.
- Vinculo/desvinculo de contas sociais em Minha Conta.
- Aceite obrigatorio de documentos legais vigentes antes de liberar o uso da plataforma.
- Persistencia de sessao nativa com `expo-secure-store`; na web a sessao fica apenas em memoria.
- Shell principal com gating por tier (`essential` / `professional`) e bloqueios de moderacao.
- Biblioteca chapter-first com sumario, leitura, busca por capitulo, progresso local e cache offline parcial.
- Reader com rich text semantico, ajuste de fonte, anotacoes por selecao de texto, selecao mobile via `WebView`, copia com citacao ABNT e abertura segura de links externos.
- Busca global unificada entre biblioteca, jurisprudencia, comunidade, curso e banco de pecas, com roteamento direto para o destino correto.
- Jurisprudencia com busca, filtros, detalhe formatado, copia de ementa e abertura do acordao.
- Curso Profissional com feed de posts, detalhe rich text, materiais e lives/gravacoes.
- Banco de Pecas Profissional com lista, detalhe e download seguro via token temporario.
- Comunidade com feed, detalhe, novo post, comentario, denuncia e follow/unfollow de posts para notificacoes.
- Minha Conta com perfil, assinatura, resumo de moderacao, preferencias de notificacao, estado do push e fluxo LGPD (exportacao/exclusao).
- Banner in-app, registro de device para push nativo e endurecimento defensivo de URLs remotas no cliente.
- Build Android beta via EAS `preview` em formato APK para distribuicao fora da loja.
- Rotas criticas com baseline automatizada de a11y e telas-chave endurecidas contra falhas parciais de API.

## Status operacional beta

Ultima revisao documental validada em `2026-04-30`:

- App web beta publico: `https://livro-vivo-app.jampa-matos.workers.dev`.
- API beta publica: `https://api-178-104-197-8.nip.io`.
- Android beta distribuido por APK via LP com gate por codigo.
- Google login validado no Android beta com callback nativo.
- `npm` e o package manager canonico e `package-lock.json` e o lockfile oficial.

Checks de referencia antes de PR/deploy:

- `npm run typecheck`
- `npm test -- --runInBand --ci`
- `npm run validate:release-config`
- `npm run gate:predeploy` quando a mudanca afetar rotas criticas

## Stack

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- `@react-native-async-storage/async-storage`
- `expo-secure-store`
- `expo-notifications`
- `expo-device`
- `react-native-webview`
- Jest (`jest-expo`)

## Setup local

### 1) Dependencias

```bash
npm ci
```

### 2) Variavel de ambiente da API

Em dev, se ausente, o app usa `http://127.0.0.1:8000`.

Para configurar explicitamente:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Exemplos:

- Web local:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run web
```

- Emulador Android:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000 npm run android
```

- Celular na mesma rede:

```bash
EXPO_PUBLIC_API_BASE_URL=http://SEU_IP_LOCAL:8000 npm run start
```

## Rodar em desenvolvimento

### Expo start

```bash
npm run start
```

### Web

```bash
npm run web
```

### Export web estatico

```bash
npm run export:web
```

Output oficial:

- `dist/`

### Android (dev build)

```bash
npm run android
npx expo start --dev-client
```

### iOS (dev build)

```bash
npm run ios
npx expo start --dev-client
```

## Qualidade local

### Testes

```bash
npm test -- --runInBand --ci
```

### Gate critico de rotas

```bash
npm run test:critical-routes
```

### Gate local pre-deploy

```bash
npm run gate:predeploy
```

### Auditoria de dependencias

```bash
npm audit --omit=dev --audit-level=moderate
```

### Typecheck

```bash
npm run typecheck
```

### Validacao de release config

```bash
npm run validate:release-config
```

Com validacao de build de release:

```bash
RELEASE_BUILD=true EXPO_PUBLIC_API_BASE_URL=https://api.example.com npm run validate:release-config
```

## Android beta APK

Perfil oficial:

```bash
npx eas-cli build --platform android --profile preview --non-interactive
```

Configuracao atual:

- `eas.json` perfil `preview` gera `apk`;
- `EXPO_PUBLIC_API_BASE_URL=https://api-178-104-197-8.nip.io`;
- `RELEASE_BUILD=true`;
- scheme nativo: `livrovivo://`;
- callback social nativo: `livrovivo://auth/callback`.

Checklist minimo apos gerar APK:

1. instalar em dispositivo Android real;
2. abrir app;
3. testar login por e-mail/senha;
4. testar login Google;
5. aceitar documentos legais se solicitado;
6. abrir livro/capitulo;
7. baixar uma peca;
8. registrar o link e a expiracao do artefato EAS na LP ou no runbook.

## Estrutura principal

- `src/api/`: `auth`, `books`, `annotations`, `caselaw`, `community`, `courses`, `entitlements`, `notifications`, `privacy`, `search`, `templatesBank`
- `src/auth/`: `tokenStorage`, `sessionBus`
- `src/layout/`: `AppShell`
- `src/screens/`: telas principais e submodulos auxiliares do reader/curso/biblioteca
- `src/screens/bookReader/`: bridge HTML/JS do reader nativo mobile
- `src/screens/course/`: helpers puros de UI e metadados do modulo de cursos
- `src/screens/library/`: helpers puros do modulo de biblioteca/anotacoes
- `src/notifications/`: `push.ts`, `useNotificationCenter.ts`
- `src/storage/`: `chapterCache.ts`, `readingProgress.ts`
- `src/utils/`: `avatarCrop`, `communityUi`, `externalUrl`, `richText`

## Integracao de API usada hoje

- `POST /auth/register/`
- `POST /auth/login/`
- `POST /auth/refresh/`
- `POST /auth/logout/`
- `GET /me/`
- `GET /me/entitlements/`
- `GET /me/data-export/`
- `POST /me/data-erasure/`
- `GET /me/notifications/`
- `POST /me/notifications/:dispatch_id/ack/`
- `POST /me/notifications/in-app/consume-latest/`
- `GET/PATCH /me/notification-preferences/`
- `GET/POST/DELETE /me/push-devices/` com `installation_id` estavel por instalacao para evitar duplicacao de device quando o token push rotaciona
- `GET /books/`
- `GET /books/:id/current-version/`
- `GET /books/:id/current-version/chapters/`
- `GET /books/:id/current-version/chapters/:slug/`
- `GET /books/:id/search/?q=...`
- `GET /annotations/`
- `POST /annotations/`
- `PATCH /annotations/:id/`
- `DELETE /annotations/:id/`
- `GET /search/global/?q=...`
- `GET /caselaw/?q=...&court=...`
- `GET /courses/posts/`
- `GET /courses/posts/:id/`
- `GET /courses/assets/`
- `GET /courses/lives/`
- `GET /templates-bank/templates/`
- `GET /templates-bank/templates/:id/`
- `GET /templates-bank/templates/:id/download-token/`
- `GET /templates-bank/templates/:id/download/?token=...`
- `GET /community/categories/`
- `GET/POST /community/posts/`
- `POST /community/posts/:id/follow/`
- `POST /community/posts/:id/unfollow/`
- `GET/POST /community/comments/`
- `POST /community/reports/`

## Fluxos principais

- Leitura: abertura por livro e versao atual, navegacao por capitulo, busca por trecho, progresso local e anotacoes sincronizadas.
- Leitura e copia: web com selecao DOM; mobile com reader via `WebView`; copia de livro e curso com citacao ABNT anexada.
- Busca global: consulta unica em biblioteca, jurisprudencia, comunidade, curso e banco de pecas com deep-link para o modulo correto.
- Conteudo Profissional: acesso a Curso e Banco de Pecas com gating consistente por tier.
- Comunidade e notificacoes: follow de posts, banner in-app, preferencias por categoria e registro de device para push nativo.
- Privacidade/LGPD: exportacao de dados, solicitacao de exclusao e encerramento de sessao apos fluxo destrutivo.

## Limites conhecidos

- Na web, a sessao nao persiste apos hard refresh; por decisao de seguranca, os tokens ficam apenas em memoria.
- Offline de autenticacao completa ainda nao esta fechado: o app depende de sessao valida e dados previamente sincronizados.
- Push nativo depende de dispositivo fisico e `EXPO_PUBLIC_EAS_PROJECT_ID`; sem isso o app continua com banner in-app, mas sem registro nativo.
- A baseline automatizada de a11y das rotas criticas cobre labels, roles e estados interativos; smoke manual com leitor de tela continua recomendado antes de grandes mudancas visuais.

## CI

Workflow app (`.github/workflows/ci.yml`) executa:

- `npm ci`
- `npm run typecheck`
- `npm run test:critical-routes`
- `npm test -- --runInBand --ci`
- `npm run test:coverage`
- validacao de release config
- export web de sanity

## Deploy beta web no Cloudflare Workers & Pages

Configuracao oficial deste repo para beta:

- provider: `Cloudflare Workers & Pages`
- modo atual: Worker com Static Assets, publicado em `workers.dev`
- branch publicada: `main`
- build command: `npm run export:web`
- output directory: `dist`
- variavel obrigatoria: `EXPO_PUBLIC_API_BASE_URL=https://api.seu-dominio-ou-url-temp`

Dominio alvo quando existir:

- `app.vitorguglinski.jur.br`

Arquivos operacionais incluidos no export:

- `public/_headers`: headers de seguranca e cache para assets do export
- o fallback SPA deve continuar validado no deploy estatico atual, sem `_redirects`, para evitar loop de roteamento

Checklist minimo no Cloudflare:

1. conectar a repo `livro-vivo-app` em Workers & Pages
2. apontar production branch para `main`
3. configurar `EXPO_PUBLIC_API_BASE_URL`
4. validar que o deploy publica `dist`
5. testar hard refresh em rota interna do app
6. so depois conectar dominio customizado

Observacao operacional:

- o Android beta continua fora do deploy web automatico; builds mobile seguem manuais via `eas build --platform android --profile preview`

## Monitoramento beta

Fonte da verdade:

- `livro-vivo-api/docs/FONTE_DA_VERDADE_MONITORAMENTO_BETA_2026-04-30.md`

Decisao atual:

- Grafana Cloud sera o painel unico do beta.
- App web e LP devem usar Grafana Faro quando a fase de frontend observability for implementada.
- Android beta deve enviar telemetria leve para a API via endpoint proprio planejado, evitando Sentry como painel separado neste ciclo.

Convencao operacional:

- `npm` e o package manager canonico deste app.
- `package-lock.json` e o lockfile de referencia para CI/deploy.

Threshold global atual de cobertura no Jest:

- statements: `>= 62%`
- branches: `>= 50%`
- functions: `>= 60%`
- lines: `>= 65%`

## Documentacao operacional

Arquivos uteis para regressao e homologacao:

- `docs/CRITICAL_ROUTES_AUDIT_CHECKLIST.md`
- `docs/GUX-01_GATE_FINAL_REGRESSAO_PRE_DEPLOY_2026-03-25.md`
- `docs/PRE_DEPLOY_SMOKE_TEST_CHECKLIST_2026-03-25.md`
- `docs/B1-01_AUDITORIA_FUNCIONAL_ROTAS_APP_2026-03-11.md`
