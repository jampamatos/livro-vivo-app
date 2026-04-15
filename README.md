# Livro Vivo App

Cliente Expo/React Native do Livro Vivo.

## Estado atual

Implementado e ativo em `main`:

- Login/registro com JWT, refresh silencioso e logout.
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
- Rotas criticas com baseline automatizada de a11y e telas-chave endurecidas contra falhas parciais de API.

## Status pre-deploy

Ultima varredura completa validada em `2026-04-15`:

- `npm audit` zerado para dependencias de producao e desenvolvimento.
- `npm run gate:predeploy` aprovado.
- `37` suites / `194` testes passando.
- Coverage global no gate: statements `67.6%`, branches `54.67%`, functions `68.8%`, lines `70.93%`.
- `npm` definido como package manager canonico e `package-lock.json` como lockfile oficial.

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
- `GET/POST/DELETE /me/push-devices/`
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
