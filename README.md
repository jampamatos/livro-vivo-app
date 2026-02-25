# Livro Vivo — App (MVP)

Aplicativo (Expo + React Native) do **Livro Vivo**.

## Estado atual do app

- Login/registro reais (email + senha) com sessão JWT (`access`/`refresh`).
- Persistência segura de sessão nativa em `expo-secure-store` (Keychain/Keystore).
- Tela "Minha conta" exibindo os entitlements do usuário.
- Biblioteca com lista de livros, versões e changelog.
- Busca chapter-first com abertura direta no trecho/capítulo.
- Leitor chapter-first com rich text semântico e anotações por seleção.
- Anotações por destaque (arraste, cor, nota opcional) salvas no backend.
- Jurisprudência v0: tela de lista + busca por palavra-chave.
- Comunidade: feed, post, comentários e denúncias.

## Stack

- Expo SDK 54, React Native 0.81, React 19
- `react-native-webview` (trechos específicos do app web/mobile)
- `expo-secure-store`

## Requisitos

- Node.js (LTS recomendado)
- npm ou pnpm
- Backend local rodando (`livro-vivo-api`)
- Android Studio e/ou Xcode (para builds nativas)
- Dev build do Expo (recomendado para validar integrações nativas)

## Instalação

```bash
npm install
````

## Rodar em desenvolvimento

```bash
npm run start
```

Atalhos úteis no terminal do Expo:

- `w` abre no navegador (web)
- `a` abre o Android (dev build instalado)

> Dica: para mobile, prefira `npm run start -- --dev-client` (ou `npx expo start --dev-client`).

### Rodar no web

```bash
npm run web
```

### Rodar no Android (dev build)

```bash
npm run android
npx expo start --dev-client
```

### Rodar no iOS (dev build)

```bash
npm run ios
npx expo start --dev-client
```

> Dica: para testar **web e Android ao mesmo tempo**, use dois terminais:
>
> - Terminal 1: `npx expo start --web`
> - Terminal 2: `npx expo run:android`

## Configuração da API (Base URL)

Em dev/test, se a variável não existir, o app usa:

- `http://127.0.0.1:8000` (bom para **web no mesmo PC**)

Para configurar (recomendado), defina `EXPO_PUBLIC_API_BASE_URL`.
Em build de produção, essa variável é obrigatória.

### Exemplo (web)

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npx expo start
```

### Exemplo (Android Studio / emulador)

O emulador usa `10.0.2.2` para acessar o localhost da sua máquina:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000 npx expo run:android
```

### Exemplo (celular / dev build)

No celular, **não** use `127.0.0.1`, porque isso aponta para o próprio telefone.
Use o **IP da sua máquina na rede** (ex.: `http://10.0.0.153:8000`):

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.0.153:8000 npx expo start --dev-client
```

> Dica: o IP "certo" costuma ser o da sua interface de rede (ex.: `10.x.x.x` / `192.168.x.x`).
> **Não** use IP de Docker (ex.: `172.17.0.1`) para acessar do celular.

### Build de produção (pré-release)

Use URL pública da API com HTTPS:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.seudominio.com npx expo export --platform web
```

## Engine do leitor nativo

O app suporta seleção da engine nativa de leitura por variável de ambiente:

```bash
EXPO_PUBLIC_NATIVE_READER_ENGINE=webview_pdfjs
```

Valores suportados:

- `webview_pdfjs`: modo compatível atual.

Para usar mudanças nativas no leitor, gere novamente o dev build Android:

```bash
npm run android
```

## Backend: rodando para acesso pelo celular (ALLOWED_HOSTS)

Se você acessar `http://10.0.0.153:8000/health/` pelo celular e o Django reclamar:

`Invalid HTTP_HOST header ... add '10.0.0.153' to ALLOWED_HOSTS`

Faça duas coisas no `livro-vivo-api`:

1. Suba o server "exposto" na rede:

```bash
python manage.py runserver 0.0.0.0:8000
```

2. Garanta que o `ALLOWED_HOSTS` permita o IP/host usado no dev (ex.: `10.0.0.153`, `localhost`, `127.0.0.1`).

## CORS (somente Expo Web)

No **Expo Web**, o backend precisa permitir CORS para o origin do Expo (ex.: `http://localhost:8081`).

Além disso, os endpoints protegidos precisam aceitar o header `Authorization`.
Isso inclui chamadas como `/books/:id/current-version/`, `/books/:id/search/` e `/annotations/`.

## Integração com a API (atual)

- `GET /me/entitlements/`
- `GET /books/`
- `GET /books/:id/versions/`
- `GET /books/:id/current-version/`
- `GET /books/:id/current-version/chapters/`
- `GET /books/:id/current-version/chapters/:slug/`
- `GET /books/:id/search/?q=...`
- `GET /annotations/?book_version=...`
- `POST /annotations/`
- `GET /caselaw/?q=...`
- `GET /community/categories/`
- `GET /community/posts/`
- `POST /community/posts/`
- `GET /community/comments/?post=...`
- `POST /community/comments/`
- `POST /community/reports/`

## Plano de migração PDF -> texto nativo (E3-02)

Objetivo: habilitar leitura chapter-first sem quebrar o fluxo atual em produção.

### Feature flag de rollout no app

- `EXPO_PUBLIC_BOOK_CONTENT_MODE`: `pdf` | `hybrid` | `chapters`
  - `pdf` (default): app usa leitor legado de PDF.
  - `hybrid`: app prioriza reader de capítulos e faz fallback para PDF quando necessário.
  - `chapters`: app opera somente no reader de capítulos (sem fallback para usuário final).

### Compatibilidade temporária com backend

- `pdf`: consome apenas endpoints legados de versão/página/download.
- `hybrid`: consome endpoints chapter-first quando disponíveis, mantendo fallback em endpoints legados.
- `chapters`: assume contrato chapter-first como padrão de produto.

### Runbook de staging (reproduzível)

1. Publicar build com flag em `pdf` (sem mudança de comportamento).
2. Após backend em `hybrid`, subir build com app também em `hybrid`.
3. Executar smoke test:
   - livro com capítulos -> reader nativo por capítulo
   - livro sem capítulos -> fallback PDF
4. Validar sessão, busca e anotações sem regressão.
5. Promover para `chapters` no beta founder e depois para 100%.

### Rollback operacional

- Rollback rápido: voltar `EXPO_PUBLIC_BOOK_CONTENT_MODE=pdf`.
- Se necessário, reverter build do app mantendo dados/schemas já migrados no backend.

## Estrutura (atual)

- `src/auth/` — armazenamento do token
- `src/api/` — client HTTP + chamadas de API
- `src/config/` — configuração (API base URL)
- `src/screens/` — telas:

  - `LoginScreen` — login/registro reais (JWT)
  - `AccountScreen` — mostra entitlements do usuário
  - `LibraryScreen` — lista livros/versões e abre a leitura
  - `BookReaderScreen` — leitor chapter-first (rich text + a11y)
  - (Jurisprudência) — tela de lista + busca consumindo `GET /caselaw/`
  - (Comunidade) — `CommunityFeedScreen` e `CommunityPostScreen` (posts + comentários + denúncias)
- `src/storage/` — cache local de capítulos e progresso de leitura
- `src/utils/` — helpers visuais

## Testes

Rodar os testes unitários:

```bash
npm test
```

Rodar checagem de tipos (sanity de build):

```bash
npm run typecheck
```

Cobertura atual (unitária):

- `apiFetch` (cliente HTTP)
- APIs de livros
- cache/local storage de PDF
- token storage

Ainda não há testes de UI/integração/E2E.

CI mínimo de qualidade: `.github/workflows/ci.yml` (typecheck + testes + export web).

Validação de configuração de release (bundle/package ids):

```bash
RELEASE_BUILD=true npm run validate:release-config
```

> Esse comando falha se `app.json` ainda estiver com `com.anonymous.*`.

## Env

É boa prática manter um `.env.example` **só com** a variável pública:

```bash
cat > .env.example <<'ENV_EOF'
# URL base da API usada pelo app (Expo)
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
ENV_EOF
```

E garantir que `.env` (de verdade) esteja no `.gitignore`.

## Repositórios

- App: [https://github.com/jampamatos/livro-vivo-app](https://github.com/jampamatos/livro-vivo-app)
- API: [https://github.com/jampamatos/livro-vivo-api](https://github.com/jampamatos/livro-vivo-api)
