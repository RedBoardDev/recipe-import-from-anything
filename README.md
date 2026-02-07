# Recipe Import Service

Import recipes from URLs or raw text and normalize them to `schema.org/Recipe` JSON-LD.

## What It Does

- Accepts URL or text inputs and creates import jobs
- Processes jobs asynchronously with a worker (BullMQ)
- Tracks job lifecycle and step progress
- Emits real-time updates over WebSocket
- Normalizes results to a consistent JSON-LD schema

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Server │────▶│  PostgreSQL │
│             │     │  (Fastify)  │     │             │
│             │     └──────┬──────┘     └─────────────┘
│             │            │
│             │     ┌──────▼──────┐     ┌─────────────┐
│             │     │   Worker    │────▶│    Redis    │
│             │     │  (BullMQ)   │     │  (BullMQ)   │
│             │     └─────────────┘     └─────────────┘
└─────────────┘
        │
        ▼
 WebSocket for real-time updates
```

## Docker (Dev + Prod)

```bash
# Build and start full stack (API + worker + infra)
docker compose up -d --build

# Logs
docker compose logs -f

# Stop
docker compose down -v
```

## Tests (Docker)

```bash
# Run unit tests in a container
docker compose --profile test run --rm test
```

## Environment Variables

Defaults are defined in `.env.example`.

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `recipe_import_user` | Database user |
| `POSTGRES_PASSWORD` | `recipe_import_password` | Database password |
| `POSTGRES_DB` | `recipe_import` | Database name |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `PORT` | `3000` | API server port |
| `HOST` | `0.0.0.0` | API bind host |
| `MAX_CONCURRENT_JOBS` | `2` | Worker concurrency |
| `BULLMQ_LOCK_DURATION_MS` | `60000` | BullMQ lock duration |
| `BULLMQ_REMOVE_ON_COMPLETE` | `100` | Completed jobs kept in Redis |
| `BULLMQ_REMOVE_ON_FAIL` | `100` | Failed jobs kept in Redis |
| `BULLMQ_RATE_LIMIT_MAX` | unset | Optional rate limit max |
| `BULLMQ_RATE_LIMIT_DURATION_MS` | unset | Optional rate limit window |
| `BULLMQ_STALLED_INTERVAL_MS` | unset | Optional stalled check interval |
| `BULLMQ_MAX_STALLED_COUNT` | unset | Optional max stalled count |
| `DEBUG` | `false` | Persist debug artifacts |
| `ARTIFACTS_PATH` | `./artifacts` | Artifact storage path |
| `JWT_SECRET` | `dev-secret` | JWT HMAC secret |
| `JWT_ISSUER` | `recipe-import` | JWT issuer |
| `JWT_AUDIENCE` | `recipe-import-api` | JWT audience |

## API Overview

- `POST /import`
- `POST /inputs`
- `GET /jobs/:id`
- `GET /jobs/:id/result`
- `POST /jobs/:id/cancel`
- `GET /health`
- `WS /ws`

Full details: `docs/reference/api.md`.

## WebSocket Overview

```javascript
const ws = new WebSocket("ws://localhost:3000/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "auth",
    headers: { "x-user-id": "user-123" }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message);
};
```

Subscribe with:

```javascript
ws.send(JSON.stringify({ type: "subscribe", jobId: "<job-id>" }));
```

## Job Lifecycle

```
CREATED → QUEUED → RUNNING → (SUCCEEDED | FAILED | CANCELED)
                        ↑
                   CANCELING
```

Steps:
- `queued`
- `collecting`
- `extracting`
- `finalizing`
- `done`

## Linting and Formatting (Biome)

```bash
# Lint + format check
yarn lint

# Fix issues
yarn format
```

## Troubleshooting

- Postgres: `docker compose logs -f postgres`
- Redis: `docker compose logs -f redis`
- Queue depth: `docker exec recipe-import-redis redis-cli llen /bullmq:recipe-import-jobs`

## Documentation

- Tutorial: `docs/tutorials/getting-started.md`
- How-to: `docs/how-to/websocket-updates.md`
- How-to: `docs/how-to/cancel-job.md`
- How-to: `docs/how-to/add-pipeline.md`
- Reference: `docs/reference/api.md`
- Reference: `docs/reference/configuration.md`
- Explanation: `docs/explanation/architecture.md`
