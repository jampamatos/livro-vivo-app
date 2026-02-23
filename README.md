# Livro Vivo — App (MVP)

Aplicativo (Expo + React Native) do **Livro Vivo**.  
No MVP, o acesso é liberado via **entitlements** (direitos por usuário).

## Requisitos

- Node.js (LTS recomendado)
- npm
- Backend local rodando (`livro-vivo-api`)
- Android Studio (para rodar no emulador Android)

## Instalação

```bash
npm install
````

## Rodar em desenvolvimento

```bash
npx expo start
```

Atalhos úteis no terminal do Expo:

- `w` abre no navegador (web)
- QR Code abre no Expo Go (celular)

### Rodar no web

```bash
npx expo start --web
```

### Rodar no Android Studio (emulador)

```bash
npx expo run:android
```

> Dica: para testar **web e Android ao mesmo tempo**, use dois terminais:
> - Terminal 1: `npx expo start --web`
> - Terminal 2: `npx expo run:android`

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

### Exemplo (celular / Expo Go)

No celular, **NÃO use 127.0.0.1**, porque isso aponta para o próprio telefone.
Use o **IP da sua máquina na rede** (ex.: `http://10.0.0.153:8000`):

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.0.153:8000 npx expo start
```

> Dica: o IP “certo” costuma ser o da sua interface de rede (ex.: `10.x.x.x` / `192.168.x.x`).
> **Não** use IP de Docker (ex.: `172.17.0.1`) para acessar do celular.

## Backend: rodando para acesso pelo celular (ALLOWED_HOSTS)

Se você acessar `http://10.0.0.153:8000/health/` pelo celular e o Django reclamar:

`Invalid HTTP_HOST header ... add '10.0.0.153' to ALLOWED_HOSTS`

Faça duas coisas no `livro-vivo-api`:

1. Suba o server “exposto” na rede:

```bash
python manage.py runserver 0.0.0.0:8000
```

2. Garanta que o `ALLOWED_HOSTS` permita o IP/host usado no dev (ex.: `10.0.0.153`, `localhost`, `127.0.0.1`).

## CORS (somente Expo Web)

No **Expo Web**, o backend precisa permitir CORS para o origin do Expo (ex.: `http://localhost:8081`).

Além disso, o endpoint de download do PDF precisa aceitar o header `Authorization`
e permitir a origem do web (CORS + `Access-Control-Allow-Headers: Authorization`).

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
- `src/screens/` — telas:
  - `LoginScreen` — login via token (modo dev)
  - `AccountScreen` — mostra entitlements do usuário
  - `LibraryScreen` — lista livros/versões, busca, baixa PDF e abre no leitor
  - `PdfReaderScreen` — leitor embutido (mobile com `react-native-pdf`, web com `react-pdf`)
- `src/storage/` — cache local do PDF (download e verificação)

## Testes

Rodar os testes unitários:

```bash
npx jest
```

(Se você tiver um script `test` no `package.json`, pode usar `npm test`.)

Cobertura atual (unitária):
- `apiFetch` (cliente HTTP)
- APIs de livros
- cache/local storage de PDF
- token storage

Ainda não há testes de UI/integração/E2E.

## Env

É boa prática manter um `.env.example` **só com** a variável pública:

```bash
cat > .env.example <<'EOF'
# URL base da API usada pelo app (Expo)
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
EOF
```

E garantir que `.env` (de verdade) esteja no `.gitignore`.

## Repositórios

- App: [https://github.com/jampamatos/livro-vivo-app](https://github.com/jampamatos/livro-vivo-app)
- API: [https://github.com/jampamatos/livro-vivo-api](https://github.com/jampamatos/livro-vivo-api)
