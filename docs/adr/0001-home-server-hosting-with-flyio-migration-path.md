# 1. Home-server hosting for v1, with Fly.io as the defined migration path

## Status

Accepted

## Context

The backend/listener (MQTT broker, WebSocket server, REST API, Postgres) needs
somewhere to run. Two options were on the table:

- The operator's existing home server — already running, no new vendor
  relationship, but reachability from the internet depends on home-router
  port forwarding (separately being fixed for other ports; not a blocker here
  since the MQTT/WebSocket/HTTPS ports need their own forwarding rules
  regardless).
- Fly.io — a platform the operator already has an account and familiarity
  with. Confirmed to support everything this architecture needs: raw TCP
  services (`protocol = "tcp"` in `fly.toml`) for the MQTT broker, native
  WebSocket support, and Fly Managed Postgres for durable storage. Raw TCP
  requires a dedicated IPv4 (`fly ips allocate-v4`, $2/mo) since the free
  shared IPv4 only proxies HTTP(S)/TLS.

## Decision

Run v1 on the home server. Use self-hosted PostgreSQL (Docker) there, with
the live-state cache kept in-process (no separate cache store needed at
single-instance scale).

Fly.io is fully specified as the migration target for when home-server
hosting is no longer sufficient: Fly Managed Postgres for the database
(same engine as the home-server Postgres, so migration is a
`pg_dump`/`pg_restore`), a dedicated IPv4 + raw TCP service for the MQTT
broker, and the WebSocket/REST API on the free shared IPv4 with Fly's
automatic TLS termination.

## Consequences

- No new vendor relationship or spend for v1; reuses infrastructure already
  operated.
- The path off the home server is pre-decided, not an open question when the
  time comes — schema and engine choice (Postgres) are shared across both,
  so the migration is operational, not a redesign.
- A future reader might expect "already uses Fly.io" to mean "hosted there
  from day one" — it doesn't; the home server was chosen first for v1
  specifically to avoid new cost/setup, with Fly.io deliberately deferred
  rather than adopted immediately.
