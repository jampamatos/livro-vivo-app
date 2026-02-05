# Livro Vivo — App (MVP)

Aplicativo (Expo + React Native) do **Livro Vivo**.

## Estado atual do app

- Login por token (modo dev) com persistência em `AsyncStorage`.
- Tela "Minha conta" exibindo os entitlements do usuário.
- Biblioteca com lista de livros, versões e changelog.
- Busca dentro do livro (API) com abertura direta na página do resultado.
- Leitor de PDF embutido com navegação por páginas.
- Anotações por destaque (arraste, cor, nota opcional) salvas no backend.
- Jurisprudência v0: tela de lista + busca por palavra-chave.
- Comunidade: feed, post, comentários e denúncias.
- Web: renderização via `react-pdf` (worker carregado de `unpkg`).
- Mobile: `react-native-pdf` + cache local de PDFs (`expo-file-system`).

## Stack

- Expo SDK 54, React Native 0.81, React 19
- `react-native-pdf` (iOS/Android) e `react-pdf` (web)
- `expo-file-system`, `expo-sharing`, `expo-intent-launcher`
- `@react-native-async-storage/async-storage`

## Requisitos

- Node.js (LTS recomendado)
- npm ou pnpm
- Backend local rodando (`livro-vivo-api`)
- Android Studio e/ou Xcode (para builds nativas)
- Dev build do Expo (Expo Go **não** funciona por causa dos módulos nativos de PDF)

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

> Dica: com `npx expo start --dev-client` você pode abrir o web (`w`) e o dev build no mesmo Metro.

## Configuração da API (Base URL)

Por padrão, o app tenta usar:

- `http://127.0.0.1:8000` (bom para **web no mesmo PC**)

Para configurar (recomendado), defina `EXPO_PUBLIC_API_BASE_URL`.

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
Isso inclui o **download do PDF** e chamadas como `/books/:id/search/` e `/annotations/`.

## Integração com a API (atual)

- `GET /me/entitlements/`
- `GET /books/`
- `GET /books/:id/versions/`
- `GET /books/:id/versions/:versionId/download-url`
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

## Estrutura (atual)

- `src/auth/` — armazenamento do token
- `src/api/` — client HTTP + chamadas de API
- `src/config/` — configuração (API base URL)
- `src/screens/` — telas:

  - `LoginScreen` — login via token (modo dev)
  - `AccountScreen` — mostra entitlements do usuário
  - `LibraryScreen` — lista livros/versões, busca e abre no leitor
  - `PdfReaderScreen.native` — leitor mobile (`react-native-pdf`)
  - `PdfReaderScreen.web` — leitor web (`react-pdf`)
  - (Jurisprudência) — tela de lista + busca consumindo `GET /caselaw/`
  - (Comunidade) — `CommunityFeedScreen` e `CommunityPostScreen` (posts + comentários + denúncias)
- `src/storage/` — cache local de PDF + abertura externa
- `src/utils/` — helpers visuais

## Testes

Rodar os testes unitários:

```bash
npm test
```

Cobertura atual (unitária):

- `apiFetch` (cliente HTTP)
- APIs de livros
- cache/local storage de PDF
- token storage

Ainda não há testes de UI/integração/E2E.

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
