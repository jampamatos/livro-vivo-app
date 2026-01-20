# Livro Vivo — App (MVP)

Aplicativo (Expo + React Native) do **Livro Vivo**.
> No MVP, o acesso é liberado via **entitlements** (direitos por usuário).

## Requisitos

- Node.js (LTS recomendado)
- npm
- API local rodando (`livro-vivo-api`)

## Instalação

```bash
npm install
```

## Rodar em desenvolvimento

```bash
npx expo start
```

Atalhos úteis no terminal do Expo:

- `w` abre no navegador (web)
- QR Code abre no Expo Go (celular)

## Configuração da API (Base URL)

Por padrão, o app tenta usar o endereço `http://127.0.0.1:8000`. Para configurar (o que é recomendado), defina `EXPO_PUBLIC_API_BASE_URL`.

Exemplo (web):

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npx expo start
```

Exemplo (celular / Expo Go): use o IP da sua máquina na rede, ex.: `http://10.0.0.153:8000`

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.0.153:8000 npx expo start
```

> Observação: no **Expo Web**, o backend precisa permitir CORS para o origin do Expo (ex.: `http://localhost:8081`).

## Estrutura (atual)

- `src/auth/` — armazenamento do token
- `src/api/` — client HTTP + chamadas de API
- `src/screens/` — telas (Login, Minha conta)

## Repositórios

- App: [https://github.com/jampamatos/livro-vivo-app](https://github.com/jampamatos/livro-vivo-app)
- API: [https://github.com/jampamatos/livro-vivo-api](https://github.com/jampamatos/livro-vivo-api)

### Extra

É uma boa prática criar um `.env.example` **só com** a variável pública:

```bash
cat > .env.example <<'EOF'
# URL base da API usada pelo app (Expo)
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
EOF
```

E garantir que `.env` (de verdade) esteja no `.gitignore` (por segurança mínima desde cedo)
