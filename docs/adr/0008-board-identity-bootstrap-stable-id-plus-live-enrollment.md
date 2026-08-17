# 8. Board identity bootstrap: stable factory ID + live cellular enrollment, not per-board flash-time secrets

## Status

Proposed — amends [ADR-0007](0007-board-claiming-via-cellular-self-registration-not-ble-pin.md), pending feasibility review on the `eBike-GPS-Tracker` firmware side (tracked there as issue #28).

## Context

ADR-0007 decided that a Board is provisioned at flash time with a `hardware_id`, a `device_secret`, and a `claim_code`, all registered backend-side as unclaimed before the Board ever ships.

That means every unit needs an interactive, per-unit secure-flashing step at manufacture time — a programming rig burns a unique secret into each board, one at a time. As Board volume grows, this is the throughput bottleneck in manufacturing, and it's the part of ADR-0007 this proposal targets: not the claim flow itself, just how and when the Board first gets a `device_secret`.

The idea on the table: a User logs in and creates an account before pairing any Board, and if the Board is unclaimed, the phone fetches provisioning details from the server rather than the Board needing to already hold a factory-flashed secret. Two problems came up when we examined that literally:

1. **Claim-jacking.** The `claim_code` sticker is what proves physical possession — it doesn't exist anywhere discoverable until it ships on that specific unit. If the phone can instead just ask the server for "the unclaimed Board's" provisioning details, anything that lets an attacker identify an unclaimed `hardware_id` (warehouse BLE scanning, sequential ID enumeration) lets them claim it before the real Owner ever opens the box.
2. **The phone as secret courier.** If the Board has no credentials until the phone delivers them, the only available transport is BLE — reintroducing the "is this really the Board, or an attacker's nearby device" problem, over exactly the BLE-onboarding model ADR-0007 rejected in favor of cellular self-registration.

Both problems trace back to the same fix, though: keep secret *transport* off the phone entirely, and keep a physical-possession proof for claiming. Only move *when* the secret is generated.

## Decision

Split "Board identity" from "Board secret," and generate the secret later than flash time:

1. **Flash time**: every unit gets the same firmware image. The only per-unit value burned in is `hardware_id` — ideally the MCU's built-in unique ID, needing no per-unit programming step at all, rather than something a flashing rig has to write. No `device_secret` exists yet.
2. **Packaging time**: a `claim_code` is generated per unit and printed on the box/sticker, and `hardware_id → claim_code` pairs are bulk-registered with the backend (batch import), not provisioned one at a time through a live per-unit session. This is what ADR-0007's claim-jacking defense actually depends on — it stays unchanged and is now cheaper to produce (a printed label vs. a secure flash write).
3. **First cellular boot**: the Board self-enrolls with the backend directly — no phone involved. The backend authenticates the enrollment request, mints `device_secret` at that point, stores only its hash, and marks the Board `unclaimed`.
4. **Claiming**: unchanged from ADR-0007 — the User scans/enters the `claim_code`, the app calls the claim endpoint with the User's JWT, the backend binds `hardware_id → user_id` and burns the code. The phone never sees, transports, or handles `device_secret` at any point.

**Open question, not resolved by this ADR:** step 3 needs the backend to authenticate a Board it's never seen before, with no shared secret pre-provisioned. Two candidates worth evaluating on the `eBike-GPS-Tracker` side:
- A manufacturer-signed batch attestation (a CA cert shared per production batch, not per unit) the Board uses to prove it's genuine at first enrollment.
- The cellular SIM's own identity (ICCID/IMSI) as the trust anchor — it's already unique and tamper-resistant per unit, issued by the carrier at zero incremental manufacturing cost, so the backend could bind `hardware_id` to a known-good SIM identity instead of requiring anything new be flashed.

This is firmware/backend trust-bootstrap design, not an app decision — left as fog for `eBike-GPS-Tracker`#28 to resolve, same way ADR-0007 left the unpair-vs-reset DISARMED question as fog there.

## Consequences

- The factory step shrinks to "apply a printed label" (or nothing at all, if `hardware_id` is read from an MCU-unique ID) — the interactive secure-flashing bottleneck ADR-0007 implied is gone.
- The claim-jacking defense is preserved unchanged: a `claim_code` is still required and is still tied to physical possession of the shipped unit.
- The phone's role stays exactly what ADR-0007 already specified — claim-time binding only. This proposal doesn't touch the app; no `eBike-GPS-App` code changes are implied by it. It does retroactively confirm that issue #24's assumption (the claim response might one day carry a `deviceSecret`) is wrong under this design too, not just the current one — the secret never leaves Board ↔ backend.
- `eBike-GPS-Tracker`#28 needs to pick a first-boot enrollment authentication mechanism before this can be implemented; until then this stays Proposed, not Accepted.
