# API de Inventário de TI

> **Status: completo.** API com autenticação JWT, CRUD de equipamentos, licenças, relatórios, documentação OpenAPI/Swagger, Docker Compose e CI/CD. Imagem Docker pronta para teste.

API REST para controle de equipamentos, licenças e movimentações entre filiais. Desenvolvida com Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod, JWT, Swagger UI e Docker.

## Demonstração

> **Demonstração:** [Localmente via Docker](#como-testar-localmente)

## Tecnologias

- **Runtime:** Node.js 20 (-alpine base)
- **Framework:** Express.js
- **ORM:** Prisma 6.x com PostgreSQL
- **Validação:** Zod
- **Autenticação:** JWT (HS256, 1 hora)
- **Documentação:** Swagger UI (OpenAPI 3.1)
- **Docker:** Docker Compose
- **CI/CD:** GitHub Actions (lint, testes)

## Requisitos e instalação

### Local (desenvolvimento)

Node.js 20 ou superior e PostgreSQL.

```sh
# 1. Copiar variáveis de ambiente
cp .env.example .env

# 2. Ajustar DATABASE_URL e JWT_SECRET no .env

# 3. Instalar dependências
npm ci --ignore-scripts

# 4. Gerar cliente Prisma
npx prisma generate

# 5. Executar migrations
npx prisma migrate dev --name init

# 6. Carregar dados iniciais (senha mínima 12 caracteres)
SEED_PASSWORD='sua-senha-ficticia-12345' npm run seed

# 7. Iniciar servidor
npm run dev
```

### Local (com Docker)

```sh
# 1. Ajustar variáveis no .env (JWT_SECRET, PORT)
# 2. Construir e subir containers
docker-compose up --build

# Ou sem rebuild:
docker-compose up
```

O PostgreSQL fica na porta 5432 e a API na porta 3000 (por padrão).

## Credenciais de teste

Após `npm run seed` ou `docker-compose up`:

| Email | Papel | Senha |
|-------|-------|-------|
| admin@example.com | ADMIN | valor de `SEED_PASSWORD` |
| tecnico@example.com | TECNICO | valor de `SEED_PASSWORD` |
| leitura@example.com | LEITURA | valor de `SEED_PASSWORD` |

## Endpoints

### Autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/login` | Autentica e retorna JWT |

### Filiais

| Método | Rota | Descrição | Papéis |
|--------|------|-----------|--------|
| GET | `/filiais` | Lista todas as filiais | ADMIN, TECNICO |
| POST | `/filiais` | Cria filial | ADMIN |

### Equipamentos

| Método | Rota | Descrição | Papéis |
|--------|------|-----------|--------|
| GET | `/equipamentos` | Lista com filtros e paginação | ADMIN, TECNICO, LEITURA |
| GET | `/equipamentos/:id` | Detalha equipamento | ADMIN, TECNICO, LEITURA |
| POST | `/equipamentos` | Cria equipamento | ADMIN, TECNICO |
| PUT | `/equipamentos/:id` | Atualiza equipamento | ADMIN, TECNICO |
| DELETE | `/equipamentos/:id` | Remove equipamento | ADMIN |
| POST | `/equipamentos/:id/movimentar` | Movimenta para nova filial | ADMIN, TECNICO |
| GET | `/equipamentos/:id/historico` | Histórico de movimentações | ADMIN, TECNICO, LEITURA |

### Licenças

| Método | Rota | Descrição | Papéis |
|--------|------|-----------|--------|
| GET | `/licencas` | Lista licenças (filtra por `dias` para vencendo) | ADMIN, TECNICO |
| GET | `/licencas/:id` | Detalha licença | ADMIN, TECNICO |
| POST | `/licencas` | Cria licença | ADMIN, TECNICO |
| PUT | `/licencas/:id` | Atualiza licença | ADMIN, TECNICO |
| DELETE | `/licencas/:id` | Remove licença | ADMIN |

### Relatórios

| Método | Rota | Descrição | Papéis |
|--------|------|-----------|--------|
| GET | `/relatorios/por-filial` | Relatório agregado por filial | ADMIN |

### Documentação

| Rota | Descrição |
|------|-----------|
| GET | `/docs` | Swagger UI com OpenAPI docs |

## Autenticação

O token JWT é retornado após login e deve ser enviado no header:

```
Authorization: Bearer <token>
```

O token expira em 1 hora. O limitador de login permite 10 tentativas a cada 15 minutos.

## Tratamento de erros

Todos os erros seguem o padrão:

```json
{
  "error": {
    "code": "CÓDIGO",
    "message": "Mensagem descritiva",
    "details": { ... } // Apenas para erros de validação
  }
}
```

| Código | Status HTTP | Condição |
|--------|-------------|----------|
| NAO_AUTENTICADO | 401 | Token ausente ou inválido |
| PROIBIDO | 403 | Papel insuficiente |
| DADOS_INVALIDOS | 422 | Validação Zod falhou |
| NAO_ENCONTRADO | 404 | Recurso não existe |
| CONFLITO | 409 | Patrimônio duplicado |
| ERRO_INTERNO | 500 | Erro inesperado |

## Swagger / OpenAPI

A API expõe documentação completa em `/docs` com a possibilidade de testar endpoints diretamente:

- Especificação OpenAPI 3.1 em `/docs/swagger.json`
- Interface interativa em `/docs`

## Docker Compose

O `docker-compose.yml` configura:

- **postgres**: PostgreSQL 16-alpine
- **api**: API Node.js com PM2

O container da API depende do PostgreSQL estar saudável (`healthcheck`).

## CI/CD

O workflow em `.github/workflows/ci.yml` executa:

1. Lint com ESLint
2. Build TypeScript
3. Testes com Vitest
4. Auditar dependências com `npm audit`

## Como testar localmente

### Testes automatizados

```sh
# Executar todos os testes
npm test

# Executar com watch (desenvolvimento)
npm run test:watch

# Coverage
npm run test:coverage
```

### Testes manuais com Docker

**Comando exato para testar a imagem Docker no PC:**

```sh
# 1. Copiar .env.example e ajustar JWT_SECRET
cp .env.example .env
# Editar .env e colocar um JWT_SECRET de 32+ caracteres

# 2. Subir os containers (constrói a imagem se necessário)
docker-compose up --build -d

# 3. Verificar se a API está saudável
curl http://localhost:3000/health

# 4. Testar login (use a senha definida em SEED_PASSWORD no .env ou no docker-compose.yml)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","senha":"sua-senha-ficticia-12345"}'

# 5. Ver logs se precisar depurar
docker-compose logs -f api

# 6. Parar quando terminar
docker-compose down
```

**Notas:**
- O `docker-compose.yml` já define `JWT_SECRET` e credenciais do PostgreSQL. Se quiser sobrescrever, use o `.env` local.
- A API roda na porta 3000, PostgreSQL na 5432.
- O seed cria usuários de teste: `admin@example.com`, `tecnico@example.com`, `leitura@example.com` (senha definida em `SEED_PASSWORD`).
- Para testar endpoints autenticados, use o token JWT retornado no login no header `Authorization: Bearer <token>`.

### Testes no PostgreSQL real

1. Subir PostgreSQL localmente ou em container
2. Executar migrations
3. Executar seed
4. Rodar serviços manualmente ou com `npm run dev`

```sh
npx prisma migrate dev
SEED_PASSWORD='teste123' npm run seed
npm run dev
```

## Estrutura de pastas

```
api-inventario-ti/
├─ src/
│  ├─ app.ts              # Middlewares e rotas principais
│  ├─ server.ts           # Entry point
│  ├─ middlewares/
│  │  └─ erros.ts         # Tratamento de erros
│  ├─ docs/
│  │  └─ swagger.ts       # Configuração OpenAPI
│  └─ modules/
│     ├─ auth/            # Login e JWT
│     ├─ equipamentos/    # CRUD de equipamentos
│     ├─ licencas/        # CRUD de licenças
│     └─ relatorios/      # Relatórios agregados
├─ prisma/
│  ├─ schema.prisma      # Schema do banco
│  ├─ seed.ts            # Dados iniciais
│  └─ migrations/
├─ tests/
│  ├─ api.test.ts        # Testes de fronteiras
│  ├─ integracao.test.ts # Testes de integração
│  ├─ licencas.test.ts   # Testes de licenças
│  └─ relatorios.test.ts # Testes de relatórios
├─ Dockerfile
├─ docker-compose.yml
├─ .github/workflows/ci.yml
├─ .env.example
└─ README.md
```

## Dados fictícios

Todos os dados são fictícios e gerados com valores aleatórios. Não existem dados reais de clientes, empresas ou CNPJs no projeto.

## Próximos passos

- Monitoramento em produção
- Logs estruturados
- Documentação de API adicional
- Testes de carga

## Autor

Pablo Dilio · [Portfólio](https://hey-pablo.github.io/pablo-dilio-portfolio/) · [LinkedIn](https://www.linkedin.com/in/pablo-dilio-4063991b2)