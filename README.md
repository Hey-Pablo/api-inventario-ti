# API de Inventário de TI

> **Status: em desenvolvimento.** O código entra aos poucos; abaixo está o planejamento do projeto.

## O que é

API REST para controlar equipamentos (computadores e periféricos), licenças e movimentações entre filiais, com autenticação, papéis, documentação e testes.

## O que prova

Back-end com Node.js: modelagem, validação, transações, testes de integração, documentação e integração contínua.

## Stack

Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod, JWT, Vitest, Supertest, OpenAPI com Swagger UI, Docker Compose e GitHub Actions. Publicação em Render com banco Neon ou Supabase.

## Estrutura

```
api-inventario-ti/
├─ src/
│  ├─ app.ts
│  ├─ server.ts
│  ├─ modules/
│  │  ├─ auth/             # rotas, controller, service, schema
│  │  ├─ equipamentos/
│  │  ├─ filiais/
│  │  ├─ movimentacoes/
│  │  ├─ licencas/
│  │  └─ relatorios/
│  └─ middlewares/         # autenticacao.ts, papeis.ts, validar.ts, erros.ts
├─ prisma/                 # schema.prisma, migrations, seed.ts
├─ tests/
├─ docker-compose.yml
├─ Dockerfile
├─ .github/workflows/ci.yml
└─ README.md
```

## Rotas principais

`POST /auth/login`; `GET`, `POST`, `PUT` e `DELETE` em `/equipamentos`, com filtros e paginação; `POST /equipamentos/:id/movimentar`; `GET /equipamentos/:id/historico`; `GET /licencas/vencendo?dias=30`; `GET /relatorios/por-filial`.

## Plano

1. Projeto TypeScript com ESLint e scripts de execução.
2. Esquema Prisma, migrações e carga inicial.
3. Login com senha em hash, token JWT e papéis (administrador, técnico e leitura).
4. CRUD de equipamentos com validação Zod, filtros e paginação.
5. Movimentação em transação: muda a filial do equipamento e grava o histórico juntos.
6. Licenças com alerta de vencimento e relatórios agregados.
7. Erros padronizados (código, mensagem, detalhes) e registro de requisições.
8. Testes de integração dos fluxos principais.
9. Documentação OpenAPI em `/docs`.
10. Docker Compose, pipeline de testes e publicação.

## Como deve funcionar

- Requisição sem token recebe 401; papel sem permissão recebe 403; dado inválido recebe 422 com o campo apontado.
- Movimentar um equipamento atualiza a filial e cria o registro de histórico. Se uma parte falhar, nada é gravado.
- `/docs` permite testar todas as rotas no navegador.
- O pipeline roda os testes a cada push.

## Prazo

2 semanas.

## Autor

Pablo Dilio · [Portfólio](https://hey-pablo.github.io/pablo-dilio-portfolio/) · [LinkedIn](https://www.linkedin.com/in/pablo-dilio-4063991b2)
