# Gate Final de Regressao Pre-Deploy

Checklist operacional versionada para fechamento do ciclo UI/UX antes de homologacao/deploy.

## Objetivo

Consolidar em um unico lugar:

- suite minima de regressao critica do app;
- comandos de reproducao local;
- checklist manual de smoke test;
- criterio de saida para release candidata.

## Suite minima de regressao critica

Executada no CI e reproduzivel localmente via:

```bash
npm run test:critical-routes
```

Cobertura minima:

- `__tests__/App.test.tsx`
- `__tests__/MainScreen.test.tsx`
- `__tests__/AccountScreen.test.tsx`
- `__tests__/CommunityPostScreen.test.tsx`
- `__tests__/LoginScreen.test.tsx`
- `__tests__/CaseLawScreen.test.tsx`
- `__tests__/CourseScreen.test.tsx`
- `__tests__/TemplatesBankScreen.test.tsx`
- `__tests__/LibraryScreen.test.tsx`
- `__tests__/BookReaderScreen.test.tsx`

## Gate local completo

Execucao curta para regressao pre-deploy:

```bash
npm run gate:predeploy
```

Esse comando executa:

1. `npm run typecheck`
2. `npm run test:critical-routes`
3. `npm test -- --runInBand --ci`
4. `npm run test:coverage`
5. `npm run validate:release-config`

Checks adicionais recomendados antes de marcar build candidata:

```bash
RELEASE_BUILD=true EXPO_PUBLIC_API_BASE_URL=https://api.example.com npm run validate:release-config
EXPO_PUBLIC_API_BASE_URL=https://api.example.com npm run export:web
```

## Smoke test manual

Usar a checklist versionada em:

- [PRE_DEPLOY_SMOKE_TEST_CHECKLIST_2026-03-25.md](./PRE_DEPLOY_SMOKE_TEST_CHECKLIST_2026-03-25.md)

## Criterio de saida

O gate final passa quando:

- [ ] `npm run gate:predeploy` passa sem falha
- [ ] validacao de release config para ambiente remoto passa
- [ ] export web de sanity passa
- [ ] smoke test manual nao encontra bloqueio `P0`
- [ ] nenhuma tela critica voltou a exibir navegacao redundante antiga
- [ ] claro/escuro e web/mobile seguem consistentes

## Nota sobre API/Admin

Nenhum ajuste adicional no CI da API e necessario por causa deste gate do app.

Dependencias operacionais da API continuam tratadas nas issues de `Pré Deploy` da API (`#60`, `#61` e correlatas).
