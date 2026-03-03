# Livro Vivo App

Cliente Expo/React Native do Livro Vivo.

## Estado atual

Implementado e ativo em `main`:

- Login/registro com JWT, refresh silencioso e logout.
- Persistencia de sessao com `expo-secure-store`.
- Main/Home com gating por tier (`essential` / `professional`) e bloqueios de moderacao.
- Biblioteca chapter-first (sumario, leitura, busca por capitulo, progresso e cache offline parcial).
- Reader com rich text semantico, ajuste de fonte, links seguros e baseline de acessibilidade.
- Anotacoes por selecao de texto (cor, nota, exclusao) com sync em API.
- Jurisprudencia com busca/filtros, detalhe formatado, copia de ementa e abertura do acordao.
- Curso Profissional com feed de posts, detalhe rich text, materiais e lives/gravacoes.
- Banco de Pecas Profissional com lista, detalhe e download seguro via token temporario.
- Comunidade com feed, detalhe, novo post, comentario, denuncia e follow/unfollow de posts para notificacoes.
- Minha Conta com perfil, assinatura, resumo de moderacao da conta, preferencias de notificacao e estado do push no dispositivo.
- Banner in-app e groundwork de push nativo com Expo Notifications.

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
npm install
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

- `src/api/`: `auth`, `books`, `annotations`, `caselaw`, `community`, `courses`, `entitlements`, `notifications`, `templatesBank`
- `src/screens/`:
  - `LoginScreen`
  - `MainScreen`
  - `LibraryScreen`
  - `BookReaderScreen`
  - `CaseLawScreen`
  - `CourseScreen`
  - `TemplatesBankScreen`
  - `CommunityFeedScreen`, `CommunityPostScreen`, `CommunityNewPostScreen`
  - `AccountScreen`
- `src/notifications/`:
  - `push.ts`
  - `useNotificationCenter.ts`
- `src/storage/`:
  - `chapterCache.ts`
  - `readingProgress.ts`
  - `tokenStorage.ts`
- `src/utils/`:
  - `richText.ts`
  - `colors.ts`

## Integracao de API usada hoje

- `POST /auth/register/`
- `POST /auth/login/`
- `POST /auth/refresh/`
- `POST /auth/logout/`
- `GET /me/`
- `GET /me/entitlements/`
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
- Conteudo Profissional: acesso a Curso e Banco de Pecas com gating consistente por tier.
- Comunidade e notificacoes: follow de posts, banner in-app, preferencias por categoria e registro de device para push nativo.

## Limites conhecidos

- Busca global unificada cross-modulo ainda nao existe no app.
- LGPD (exportacao/exclusao de dados) ainda nao existe no produto.
- Offline de autenticacao completa ainda nao esta fechado: o app depende de sessao valida e dados previamente sincronizados.
- Push nativo depende de dispositivo fisico e `EXPO_PUBLIC_EAS_PROJECT_ID`; sem isso o app continua com banner in-app, mas sem registro nativo.
- A auditoria formal de a11y das rotas criticas ainda nao foi concluida.

## CI

Workflow app (`.github/workflows/ci.yml`) executa:

- `npm ci`
- `npm run typecheck`
- `npm test -- --runInBand --ci`
- validacao de release config
- export web de sanity

## Backlog atual

As pendencias pre-deploy estao em:

- `docs/BACKLOG_EXECUTAVEL_2026-02-25.md`
