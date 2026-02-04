# modulys-pax-core-service

Microserviço **Core** do Modulys Pax: empresas, filiais, funcionários e perfis (roles). Os dados ficam no banco do tenant. Acesso via header `x-tenant-id`; a connection string do tenant é obtida na admin-api.

## Fluxo

- Cliente → **core-service** (header `x-tenant-id`) → core-service obtém connection do tenant na admin-api → consultas no banco do tenant.
- Todo tenant provisionado tem o schema core (companies, branches, employees, roles); não é necessário validar módulo.

## Variáveis de ambiente

| Variável        | Descrição                    | Exemplo                          |
|-----------------|------------------------------|----------------------------------|
| `SERVICE_PORT`  | Porta do serviço              | `9002`                           |
| `ADMIN_API_URL` | Base URL da admin-api         | `http://localhost:3000/api/admin` |
| `SERVICE_KEY`   | Chave para chamar a admin-api | (valor secreto)                   |

## Execução

```bash
npm install
npm run dev
```

## API

Todas as rotas exigem header **`x-tenant-id`** (ID do tenant).

- **Companies:** `GET /companies`, `GET /companies/:id`, `POST /companies`
- **Branches:** `GET /branches` (opcional: `?companyId=`), `GET /branches/:id`, `POST /branches`
- **Employees:** `GET /employees` (opcional: `?companyId=`, `?branchId=`), `GET /employees/:id`, `POST /employees`
- **Roles:** `GET /roles` (opcional: `?companyId=`), `GET /roles/:id`, `POST /roles`
- **Health:** `GET /health`

## Repositório

Pode ser versionado em um repositório próprio (ex.: `modulys-pax-core-service` no GitHub).
