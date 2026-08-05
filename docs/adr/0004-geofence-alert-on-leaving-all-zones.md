# 4. Geofence alerts fire on leaving all zones, not on leaving any one zone

## Status

Accepted

## Context

A Board can have multiple Geofences (Home, Office, Gym, plus Temporary
ones). The naive semantic — alert whenever the Board exits *any* configured
Geofence — breaks down immediately with more than one permanent zone: riding
from Home to the Gym would fire a "left Home" alert on every single trip,
since leaving one zone to enter another is completely normal, not a theft
signal.

## Decision

An alert fires only when the Board's reported position is inside **none**
of its currently-active Geofences (Permanent, plus any unexpired Temporary
one) — i.e. Geofences collectively define "recognized as safe," and the
alert is "no longer in a safe place," not "left a specific place."

## Consequences

- Moving between recognized zones (Home → Gym → Office) generates zero
  alerts, which is the whole point of supporting more than one Geofence.
- There is no per-zone "left Home" or "arrived at Gym" notification in this
  model — only the aggregate safe/not-safe signal. A future reader expecting
  per-zone entry/exit events (a reasonable naive reading of "geofencing")
  will find that's a different feature, not what's built here; per-zone
  events could be added later as a distinct, additive feature without
  reworking this alert.
- A Temporary Geofence's expiry (its duration running out) can flip the
  Board from "safe" to "not safe" with no location change at all — the
  alert-evaluation logic must react to time passing, not just to new
  telemetry arriving.
