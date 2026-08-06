# 7. Board claiming via cellular self-registration and a claim code, not BLE + a shared PIN

## Status

Accepted — supersedes the mechanism recorded in [Board pairing mechanism](https://github.com/Kimishiba/eBike-GPS-App/issues/3)

## Context

Ticket #3 decided: a User claims a Board by discovering it over BLE proximity
and entering a shared 5-digit PIN (`13579`, identical across every Board);
the backend then generates a unique Board ID and per-board MQTT credentials
and relays them to the Board over that BLE link.

Since then, `eBike-GPS-Tracker`'s own provisioning design (`provisioning-design.md`,
tracked there as issue #28) settled the equivalent decision on the firmware
side, and it conflicts with #3 on both points that matter:

**Transport.** The Board carries an LTE modem and is online over cellular
before a phone is ever involved — BLE onboarding exists to solve "the device
has no internet until the phone gives it Wi-Fi," which isn't this Board's
problem. The firmware design inverts the flow: the Board self-registers over
cellular on first boot and the phone only *claims* an already-online device.

**Secret.** A 5-digit PIN shared identically across every Board (`13579`) is
not a secret at all — any User could claim any unclaimed Board. The firmware
design uses a per-Board, one-time, expiring, rate-limited `claim_code`
(8-character base32, printed as a QR sticker at flash time), burned on
successful claim.

Credentials also don't get issued *during* claiming. They're generated at
**flash-time provisioning** — before the Board ever ships — stored hashed
server-side, and simply already exist on an unclaimed Board. Claiming binds
ownership; it does not create the Board's identity.

## Decision

Supersede #3's mechanism with the tracker's design:

1. At flash time, a Board is provisioned with a `hardware_id` (UUID, not
   MAC), a `device_secret`, and a `claim_code` — registered backend-side as
   **unclaimed**.
2. The Board boots, connects over cellular using its own MQTT credentials,
   and publishes an `unclaimed` status (retained, with a Last-Will-and-
   Testament of `offline`).
3. The Owner scans a QR code (or types the code) in the app; the app calls
   the claim endpoint with the Owner's JWT, which binds `hardware_id` to
   `user_id` and burns the code.
4. An unclaimed Board accepts no command except claim — it does not track,
   arm, or honor a sleep command from anyone.
5. BLE is **not** used for claiming. It remains reserved for the
   already-decided BLE proximity auto-disarm feature
   ([#10](https://github.com/Kimishiba/eBike-GPS-App/issues/10),
   [#11](https://github.com/Kimishiba/eBike-GPS-App/issues/11)), which this
   decision does not change.

**Unpairing vs. factory reset.** These are two different operations, which
#3's original resolution treated as one:

- **Unpair** (app-initiated, remote): the Owner removes a Board from their
  account. This is a backend-side ownership removal — ownership binding is
  cleared, the Board's existing credentials are otherwise untouched, and it
  returns to claimable state.
- **Factory reset** (firmware-gated, physical): wipes the Board's owner
  state entirely and issues a fresh claim code. The firmware design requires
  the Board to be in the DISARMED state to allow this — disarming already
  needs owner authentication, so a thief who cannot disarm cannot unbind
  either. An armed Board that sees a reset attempt treats it as tamper.

Whether an app-initiated remote unpair should *also* require the Board to be
DISARMED (matching factory reset's precondition) is **not yet decided** —
left as fog for the `eBike-GPS-Tracker` map, since it's a firmware/backend
behavior question, not an app-UX one.

## Consequences

- The app's onboarding flow changes: no BLE handshake, no PIN entry screen —
  instead a QR-scan/manual-code-entry screen, plus a live "Board is online"
  confirmation the moment it's scanned, since the Board is already reachable
  over cellular.
- Per-Board credentials exist before an app is ever involved; the app has no
  role in credential issuance, simplifying the app↔backend security surface
  #3 originally assumed.
- "Remote-resets the board to stock" (#3's original unpair behavior) was
  inaccurate — reconciled above into two distinct operations with different
  security properties. A future reader expecting one unified "unpair and
  wipe" action should read this ADR, not #3's original resolution comment.
