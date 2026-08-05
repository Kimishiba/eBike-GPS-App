# 6. Silent auto-disarm on BLE proximity, relay-attack mitigation deferred to firmware

## Status

Accepted

## Context

BLE proximity auto-connect (#10, #11) lets a paired phone disarm a Board's
alarm just by being nearby, using the HMAC challenge-response design in the
tracker repo's PR #30. The alternative to silent auto-disarm is requiring an
explicit confirmation tap in the app before disarming.

Proximity-based auto-disarm is generally vulnerable to relay attacks — an
attacker relays the challenge-response in real time between a device near
the Board and one near the owner's phone, tricking the Board into disarming
without the owner being physically present. This is the same class of attack
known from car keyless-entry systems. Distance-bounding (verifying the phone
is actually close, not just relayed) is a protocol/hardware-level mitigation,
not something the app's UX can add after the fact.

## Decision

Auto-disarm happens silently, with no confirmation step — a silent local
notification confirms it after the fact, per-board, independently for each
Board in range. The relay-attack risk is accepted at the app-UX level and
flagged as a residual risk for the firmware's HMAC challenge-response design
(PR #30) to address, if it chooses to; this ticket does not mitigate it.

## Consequences

- Matches the "walk up, it's ready" convenience goal — no friction is added
  to the common case.
- The relay-attack risk is real and unmitigated at this layer. A future
  reader auditing security (after the hardening baseline in #7) might expect
  this to already be covered — it isn't; distance-bounding or similar
  mitigation, if ever added, is `eBike-GPS-Tracker` firmware work, not a
  change to this app.
- Multiple Boards in range disarm independently with independent
  notifications — no cross-board coordination logic exists or is needed,
  since each Board's BLE connection and credentials (#3) are already fully
  separate.
