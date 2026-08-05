# 2. Per-board MQTT credentials verified dynamically against Postgres, not a static password file

## Status

Accepted

## Context

Board pairing (#3) issues each board a unique MQTT username/password at claim
time and revokes it on unpair. Mosquitto (the chosen broker) supports two
common ways to check credentials: a static password file (`mosquitto_passwd`,
read at startup / reload) or a dynamic authentication plugin that queries an
external source per connection attempt (e.g. `mosquitto-go-auth`).

## Decision

Use a dynamic authentication plugin that checks each connecting board's
credentials directly against the `boards` table in Postgres, where the
per-board password is stored bcrypt-hashed. No static password file is
maintained.

## Consequences

- Revocation on unpair takes effect on the *next* connection attempt with no
  broker reload step — a static file would require rewriting the file and
  either restarting or signalling the broker to reload it on every single
  pairing/unpairing event, which is exactly the kind of extra moving part
  that goes stale silently (a missed reload leaves a revoked board still
  able to connect).
- Adds a runtime dependency from the MQTT broker to Postgres — if the
  database is unreachable, no board can authenticate, even ones that were
  already connected before the outage in some plugin configurations. This is
  an accepted trade-off given the backend already treats Postgres as a hard
  dependency for everything else.
- A future reader might expect a small, fixed board fleet to be simple enough
  for a static file — the dynamic-plugin choice is specifically about
  revocation *immediacy*, not fleet size.
