# Deployment

## Current topology

The current playable product is a private text Web UI and HTTP API. It does not
need a database.

```text
Docker container
  -> src/game pure engine
  -> src/server HTTP API
  -> web/ responsive browser UI
  -> read-only reference/ content mount
  -> pt-sap-saves named volume (web sessions + ghost snapshots)
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

The named volume `pt-sap-saves` preserves `saves/run.json` and
`saves/ghosts.json`, plus browser sessions under `saves/web-sessions/`.

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

For a private internet-facing deployment, also set HTTP Basic authentication:

```bash
PT_SAP_BASIC_AUTH='player:change-this-password' \
PT_SAP_SECURE_COOKIE=1 \
docker compose up -d
```

Basic authentication must still run behind TLS. `/healthz` remains available
without authentication for the container health check.

## Future multiplayer

When a web or WebSocket server is added, keep the battle and shop engine
independent of transport and persistence. The intended topology is:

```text
reverse proxy / TLS
  -> pt-sap-server (HTTP/WebSocket)
       -> pure game engine
       -> PostgreSQL
       -> ghost-snapshot table
```

PostgreSQL becomes necessary when concurrent players need shared runs,
snapshots, sessions and idempotent commands. Redis is not needed for the first
multiplayer version. Database access belongs in a server repository layer, not
inside `resolveBattle()` or the run reducer.

The server deployment should use:

- a private Docker network,
- a PostgreSQL named volume,
- an explicit `DATABASE_URL`,
- non-root containers,
- health checks and migration-on-start,
- no public database port.

Current HTTP implementation already has:

- per-browser UUID sessions,
- atomic session-file writes,
- serialized actions per session,
- request-size limits and security headers,
- health check at `/healthz`.
