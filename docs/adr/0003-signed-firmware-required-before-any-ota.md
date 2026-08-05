# 3. No firmware OTA mechanism ships without cryptographic signature verification

## Status

Accepted

## Context

The current `eBike-GPS-Tracker` firmware has no over-the-air update
mechanism at all (confirmed by the tracker system audit, #9 — only a SoftAP
recovery portal for Wi-Fi re-provisioning exists, `firmware/src/recovery.h`).
Whether and how OTA gets built is still open (tracked as fog: "Firmware OTA
update flow"). This ticket only sets the security baseline that any future
OTA design must satisfy.

Without signature verification, an OTA channel is a direct remote-code-
execution path onto every paired board: whoever can reach the update
mechanism (a compromised backend, a MITM'd update server, a leaked signing
credential used incorrectly) can push arbitrary firmware to devices with
physical access to a bike's electrical system and battery.

## Decision

Whenever an OTA update mechanism is designed, it must ship with the board
verifying a cryptographic signature over the firmware image before flashing
it. No update path is acceptable that flashes unsigned or unverified images,
regardless of transport (MQTT, HTTP, BLE, USB/serial recovery).

## Consequences

- Rules out the simplest possible OTA implementation (backend pushes a raw
  binary, board flashes it) as a starting point — signing/verification must
  be designed in from the first version, not bolted on later.
- Retrofitting signing onto boards already in the field that shipped without
  it would require a firmware update to add the verification logic itself —
  which is the exact update path being secured. Deciding this now, before any
  OTA exists, avoids ever needing that retrofit.
- A future reader might ask "why not ship OTA fast and add signing once it's
  proven useful" — the SoftAP recovery portal already provides a
  physical-access fallback for provisioning, so there's no urgency pressure
  to ship an insecure OTA path first.
