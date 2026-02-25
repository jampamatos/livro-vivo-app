# Livro Vivo App

Cliente Expo/React Native do Livro Vivo.

## Estado atual

Implementado e ativo em `main`:

- Login/registro com JWT e renovacao de sessao.
- Persistencia de sessao com `expo-secure-store`.
- Main com gating por tier (`essential` / `professional`).
- Biblioteca chapter-first (sumario, leitura, busca por capitulo, progresso).
- Reader com rich text semantico e base de acessibilidade.
- Anotacoes por selecao de texto (cor, nota, exclusao) com sync em API.
- Jurisprudencia com detalhe formatado, copia de ementa e abertura de acordao.
- Comunidade com feed, detalhe, comentario e denuncia.
- Minha Conta com assinatura, modulos liberados e preferencias de notificacao.
- Cache local de capitulos/progresso (offline parcial para conteudo ja sincronizado).

## Stack

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- `@react-native-async-storage/async-storage`
- `expo-secure-store`
- `react-native-webview`

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
npm test
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

- `src/api/`: clients de API (`auth`, `books`, `annotations`, `caselaw`, `community`, `entitlements`, `notifications`)
- `src/screens/`:
  - `LoginScreen`
  - `MainScreen`
  - `LibraryScreen`
  - `BookReaderScreen`
  - `CaseLawScreen`
  - `CommunityFeedScreen`, `CommunityPostScreen`, `CommunityNewPostScreen`
  - `AccountScreen`
- `src/storage/`:
  - `chapterCache.ts`
  - `readingProgress.ts`
  - `tokenStorage.ts`
- `src/utils/`:
  - parser/render de rich text

## Integracao de API usada hoje

- `POST /auth/register/`
- `POST /auth/login/`
- `POST /auth/refresh/`
- `POST /auth/logout/`
- `GET /me/`
- `GET /me/entitlements/`
- `GET/PATCH /me/notification-preferences/`
- `GET /books/`
- `GET /books/:id/current-version/`
- `GET /books/:id/current-version/chapters/`
- `GET /books/:id/current-version/chapters/:slug/`
- `GET /books/:id/search/?q=...`
- `GET/POST/PATCH/DELETE /annotations/`
- `GET /caselaw/`
- `GET /community/categories/`
- `GET/POST /community/posts/`
- `GET/POST /community/comments/`
- `POST /community/reports/`

## Fluxo de leitura (estado atual)

- Abertura por livro e versao atual.
- Navegacao por capitulo com progresso salvo localmente.
- Busca por trecho com abertura no capitulo/offset encontrado.
- Anotacao por selecao no texto renderizado.
- Links externos no conteudo abrem com protecao (`noopener/noreferrer`).

## Limites conhecidos

- Offline de autenticacao completa ainda nao esta fechado: o app depende de sessao valida e dados previamente sincronizados.
- Os modulos Curso e Banco de Pecas ainda nao estao implementados no produto.

## CI

Workflow app (`.github/workflows/ci.yml`) executa:

- `npm ci`
- `npm run typecheck`
- `npm test -- --runInBand --ci`
- validacao de release config
- export web de sanity

## Backlog atual

As pendencias pre-deploy (novos epics) estao em:

- `docs/BACKLOG_EXECUTAVEL_2026-02-22.md`
