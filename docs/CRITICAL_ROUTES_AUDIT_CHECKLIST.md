# Auditoria de Rotas Criticas (Issue #30)

## Objetivo

Fechar baseline de acessibilidade e regressao funcional nas rotas criticas antes de deploy.

## Rotas auditadas

- Login
- Main (hub principal)
- Library
- Reader
- Jurisprudencia
- Comunidade (post)
- Curso
- Banco de Pecas
- Conta

## Checklist curta

- [x] Botões primarios de navegação com `accessibilityRole` e `accessibilityLabel`.
- [x] Acoes criticas (logout, retry, abrir detalhe, download, envio) com label semantica.
- [x] Reader com baseline de semantica para titulos/listas/links e ajuste de fonte.
- [x] Teste de regressao cobrindo navegação de rotas criticas no `App`.
- [x] Gate de CI executando suite dedicada de rotas criticas.

## Como reproduzir localmente

```bash
npm run typecheck
npm run test:critical-routes
npm run test:coverage
npm test -- --runInBand --ci
```

## CI

O gate de regressao critica do app fica em `.github/workflows/ci.yml` e usa o mesmo comando versionado localmente:

```bash
npm run test:critical-routes
```

O gate critico inclui explicitamente:

- `__tests__/LibraryScreen.test.tsx`
- `__tests__/BookReaderScreen.test.tsx`
