# Auditoria de Rotas Criticas (Issue #30)

## Objetivo

Fechar baseline de acessibilidade e regressao funcional nas rotas criticas antes de deploy.

## Rotas auditadas

- Login
- Main (hub principal)
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
npm test -- --runInBand --ci __tests__/App.test.tsx __tests__/MainScreen.test.tsx __tests__/AccountScreen.test.tsx __tests__/CommunityPostScreen.test.tsx __tests__/LoginScreen.test.tsx __tests__/CaseLawScreen.test.tsx __tests__/CourseScreen.test.tsx __tests__/TemplatesBankScreen.test.tsx
npm test -- --runInBand --ci
```
