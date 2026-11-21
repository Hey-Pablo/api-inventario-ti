# API de Inventário de TI

> **Status: em desenvolvimento.** Autenticação, inventário e movimentações disponíveis; licenças, relatórios e documentação OpenAPI ainda serão implementados.

API REST para inventário fictício de equipamentos entre filiais. Desenvolvida com Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod e JWT.

## Requisitos e instalação

Node.js 20 ou superior e PostgreSQL. Copie `.env.example` para `.env`, ajuste `DATABASE_URL` e defina `JWT_SECRET` aleatório com pelo menos 32 caracteres. Não use os exemplos como segredos reais.

```sh
npm ci --ignore-scripts
npx prisma generate
npx prisma migrate deploy
SEED_PASSWORD='escolha-uma-senha-local-forte' npm run seed
npm run dev
```

A carga cria duas filiais e três usuários fictícios: `admin@example.com`, `tecnico@example.com` e `leitura@example.com`. Todos recebem a senha fornecida por `SEED_PASSWORD` (mínimo 12 caracteres). A carga atualiza as senhas quando executada novamente. Não utilize a carga em produção.

## Uso

Envie `POST /auth/login` com `{"email":"admin@example.com","senha":"..."}`. Nas demais rotas use `Authorization: Bearer <token>`. O token expira em uma hora. O limitador de login mantém contadores em memória: para múltiplas instâncias, use um armazenamento compartilhado antes de publicar.

- `GET /filiais`: lista filiais.
- `GET /equipamentos`: filtros opcionais `nome` e `filialId`, paginação `pagina` e `limite` (máximo 100).
- `GET /equipamentos/:id`, `POST /equipamentos`, `PUT /equipamentos/:id`, `DELETE /equipamentos/:id`.
- `POST /equipamentos/:id/movimentar`: corpo `{"destinoId":"UUID"}`. Atualiza a filial e grava histórico na mesma transação.
- `GET /equipamentos/:id/historico`: lista movimentações.

Criação recebe `nome`, `patrimonio` e `filialId`; atualização recebe `nome` e `patrimonio`. Para alterar filial, use a movimentação. Administrador e técnico podem criar, atualizar e movimentar; apenas administrador pode excluir. Leitura pode consultar. Equipamento com histórico não pode ser excluído.

Erros seguem `{"error":{"code":"...","message":"...","details":{}}}`; detalhes aparecem na validação. Token ausente ou inválido retorna 401, papel insuficiente 403 e entrada inválida 422. Patrimônio duplicado retorna 409.

## Verificação

```sh
npm test
npm run build
npm run lint
npm audit
```

Os testes HTTP usam Vitest, Supertest e PGlite em memória, com a migração real. Isso não substitui testar a migração e a concorrência em um PostgreSQL real. Teste no computador com PostgreSQL: instalação, migração, carga, login, operações e movimentação, inclusive solicitações simultâneas. Não há dados reais no projeto.

## Próximas etapas

Licenças, relatórios, OpenAPI, Docker e CI pertencem a etapas futuras. Nenhuma publicação foi realizada.

## Autor

Pablo Dilio · [Portfólio](https://hey-pablo.github.io/pablo-dilio-portfolio/) · [LinkedIn](https://www.linkedin.com/in/pablo-dilio-4063991b2)
