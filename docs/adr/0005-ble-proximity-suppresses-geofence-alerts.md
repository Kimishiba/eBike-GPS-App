# 5. BLE proximity of a paired User suppresses geofence alerts

## Status

Accepted

## Context

ADR 0004 defines a Board as "safe" (no geofence alert) whenever it is inside
at least one of its active Geofences. That's not the only situation where an
alert would be a false positive: if a paired User's phone is right next to
the Board — parked somewhere off the usual routes, or in the middle of
leaving a Geofence — there's no theft signal regardless of location, since
someone with legitimate access is physically present.

The Board already advertises over BLE for proximity auto-connect (#10, #11),
so a paired User's phone detecting that advertisement is an existing signal,
not a new capability to build.

## Decision

Extend the "safe" condition from ADR 0004: a Board is safe if it is inside
an active Geofence **or** any paired User's phone (Owner or Member — not
Owner-only) is within BLE range. Geofence alert evaluation checks both
conditions, not just Geofence membership.

## Consequences

- A Board parked entirely outside every configured Geofence generates no
  alert as long as a paired User's phone is nearby — this is deliberate, not
  a gap: presence is treated as at least as strong a safety signal as
  location.
- Member phones count equally with the Owner's. A future reader might expect
  Owner-only, given the Owner/Member asymmetry elsewhere (unpair, manage
  access) — this decision draws the line at "already-trusted proximity
  signal," not at "same permissions as the Owner."
- Geofence evaluation now depends on a second live input (BLE proximity
  state) alongside telemetry position — both must be considered, and either
  changing (a phone coming into/out of range, or a Temporary Geofence
  expiring) can flip the safe/not-safe state without a new telemetry
  message arriving.
