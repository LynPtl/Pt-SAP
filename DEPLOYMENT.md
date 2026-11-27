# Deployment

## Current topology

The current playable product is a private text Web UI and HTTP API. It supports
a shared PostgreSQL ghost pool and a single-process JSON fallback.

```text
Docker container
  -> src/game pure engine
  -> src/server HTTP API
  -> web/ responsive browser UI
  -> read-only reference/ content mount
  -> pt-sap-saves named volume (web sessions)
  -> PostgreSQL ghost_snapshots table
```

The container listens on port `3000`. Put Caddy, Nginx or the hosting platform
TLS proxy in front of it before public access.

## Build and play locally

```bash
docker compose up -d --build
curl http://127.0.0.1:3000/healthz
```

Open `http://server-address:3000`. To use a different host port:

```bash
PT_SAP_PORT=8080 docker compose up -d --build
```

The named volume `pt-sap-saves` preserves browser sessions under
`saves/web-sessions/`. The `postgres-data` volume preserves the shared ghost
pool. If `DATABASE_URL` is unset, the server falls back to
`saves/ghosts.json`.

## Linux server

1. Copy the repository, including the private and gitignored `reference/`
   directory, to the server.
2. Install Docker Engine with the Compose plugin.
3. Run `docker compose up -d --build`.
4. Open port `3000`, preferably only to a local reverse proxy.

Do not mount the Docker socket into the game container. Do not run the game
container as privileged.

When TLS terminates at a reverse proxy, set `PT_SAP_SECURE_COOKIE=1` so browser
session cookies are marked `Secure`.

Override the default private Compose database credentials before exposing the
service:

```bash
PT_SAP_PG_PASSWORD='change-this-database-password' \
PT_SAP_DATABASE_URL='postgres://pt_sap:change-this-database-password@postgres:5432/pt_sap' \
docker compose up -d
```

PostgreSQL is only on the Compose private network. It does not expose a host
port. The application creates the `ghost_snapshots` table and indexes on
startup.

For a private internet-facing deployment, also set HTTP Basic authentication:

```bash
PT_SAP_BASIC_AUTH='player:change-this-password' \
PT_SAP_SECURE_COOKIE=1 \
docker compose up -d
```

Basic authentication must still run behind TLS. `/healthz` remains available
without authentication for the container health check.

## Multiplayer persistence

When a web or WebSocket server is added, keep the battle and shop engine
independent of transport and persistence. The intended topology is:

```text
reverse proxy / TLS
  -> pt-sap-server (HTTP/WebSocket)
       -> pure game engine
       -> PostgreSQL
       -> ghost-snapshot table
```

PostgreSQL now provides the shared ghost pool across application instances.
Future WebSocket multiplayer can reuse it for snapshots, sessions and
idempotent commands. Redis is not needed for the first multiplayer version.
Database access belongs in a server repository layer, not inside
`resolveBattle()` or the run reducer.

The server deployment should use:

- a private Docker network,
- a PostgreSQL named volume,
- an explicit `DATABASE_URL`,
- non-root containers,
- health checks and migration-on-start,
- no public database port.

Current HTTP implementation has:

- per-browser UUID sessions,
- atomic session-file writes,
- serialized actions per session,
- content-versioned ghost snapshots,
- PostgreSQL ghost storage with per-turn/trophy/life pruning,
- request-size limits and security headers,
- health check at `/healthz`.
