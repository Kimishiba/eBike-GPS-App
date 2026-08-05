# Tracker system audit + telemetry opportunities

Research for issue #9. Source repo: `Kimishiba/eBike-GPS-Tracker`, read at the
commit checked out locally under `firmware/src/main.cpp`, `backend/server.js`,
`backend/public/index.html`, `features_backlog.md`, `architecture.md`,
`firmware/WIRING_ADXL345.md` and `firmware/src/recovery.h`. All line numbers
below refer to that snapshot; treat them as approximate if the tracker repo has
moved on.

This is the fixed integration surface the new `eBike-GPS-App` backend has to
build against (Part 1), plus a survey of hardware capability that exists on
the board but isn't wired into telemetry yet (Part 2), for the MVP-feature and
data-model tickets to draw on.

---

## 1. Existing integration surface

### 1.1 MQTT topics

The broker is Aedes, embedded in `backend/server.js` (`aedes()` at line 2,
listening on port 1883, `backend/server.js:12,85-88`). Auth is a single
username/password pair (`TRACKER_USER`/`TRACKER_PASS`, aliased to
`brokerUser`/`brokerPass`), checked in `aedes.authenticate`
(`backend/server.js:196-208`) via `express-basic-auth`'s
`safeCompare` for timing-safety. This must match `MQTT_USER`/`MQTT_PASS` in
firmware's `secrets.h` (`firmware/src/main.cpp:32-33`).

| Topic | Direction | Publisher / Subscriber | Payload | Source |
|---|---|---|---|---|
| `bike/telemetry/location` | firmware → backend | Firmware publishes (`mqtt.publish(topicTelemetry, payload.c_str())`); backend subscribes via its own local MQTT client (`localClient.subscribe('bike/telemetry/location')`) | JSON object, see 1.2 below | `firmware/src/main.cpp:34,632,725`; `backend/server.js:247,276-297` |
| `bike/config/interval` | backend → firmware (firmware also subscribes to receive its own echoes/CLI commands) | Firmware subscribes in `setup()` and reconnect logic in `loop()` (`mqtt.subscribe(topicConfig)`); backend publishes from three call sites | Multiplexed string, see 1.2 below | `firmware/src/main.cpp:35,203-245,585,677`; `backend/server.js:164-174,177-186,269,320` |
| `bike/alarm` | firmware → backend | Firmware publishes only when `isAlarmState` is true; backend subscribes via `localClient.subscribe('bike/alarm')` | Plain string, e.g. `"🚨 THEFT ATTEMPT IN PROGRESS!"` | `firmware/src/main.cpp:36,639-641`; `backend/server.js:248,300-302` |

**`bike/telemetry/location` payload** (built as a hand-assembled JSON string
in both `setup()` at boot and `loop()` in `DEV_MODE_WIFI`,
`firmware/src/main.cpp:620-632` and `:713-726`):

```json
{
  "lat": 52.367600,
  "lon": 4.904100,
  "speed": 0.0,
  "alarm_triggered": false,
  "bike_on": false,
  "battery_voltage": 4.05,
  "battery_percent": 82,
  "rail_voltage": 4.18,
  "gps_fixed": true,
  "sats_used": 7,
  "sats_view": 11
}
```

Field notes:
- `lat`/`lon`: 6 decimal places (`String(lat, 6)`); `0.0` when no fix has ever
  been acquired this boot — the backend/dashboard treats `lat===0 && lon===0`
  as "no location yet" (`backend/public/index.html:689,699`), not as a valid
  coordinate.
- `speed`: km/h. TinyGSM's `getGPS()` returns knots (Speed Over Ground from
  `+CGNSINF`); firmware multiplies by `KNOTS_TO_KMH = 1.852` before publishing
  (`firmware/src/main.cpp:47,608,700`).
- `alarm_triggered` / `bike_on`: only ever `true` on the boot cycle that woke
  from the corresponding `ext1` pin (motion or power-sense); in the
  `DEV_MODE_WIFI` periodic loop path `bike_on` is hardcoded `true` and
  `alarm_triggered` hardcoded `false` (`firmware/src/main.cpp:714-715`) — i.e.
  these are wake-reason flags for that single report, not a live/polled
  power-line state (see 2.7).
- `battery_voltage`: the LiPo cell voltage read from `BAT_ADC_PIN` (35) via
  `getCellVoltage()`, 16-sample averaged, corrected for the 100k/100k divider
  (`firmware/src/main.cpp:114-134`).
- `battery_percent`: `batteryPercentFromVolts()` interpolating the 21-point
  open-circuit `BAT_CURVE[]` table (`firmware/src/main.cpp:152-177`) — a
  nonlinear LiPo discharge curve, not a linear 3.2–4.2V map.
- `rail_voltage`: the SIM7000's own regulated VBAT rail via `AT+CBC`
  (`modem.getBattVoltage()`, `firmware/src/main.cpp:138-140`). Kept
  deliberately alongside `battery_voltage` so rail-vs-cell divergence (a
  known failure signature, see the `#34` comment block at
  `firmware/src/main.cpp:97-123`) stays visible. Older firmware omits this
  field — backend guards it with `data.rail_voltage !== undefined`
  (`backend/server.js:287`).
- `gps_fixed` / `sats_used` / `sats_view`: `sats_used` (`usat`) and
  `sats_view` (`vsat`) come from `modem.getGPS()`'s output params
  (`firmware/src/main.cpp:593-599,693-697`); no HDOP or numeric accuracy value
  is included even though one is available (see 2.4).
- No `timestamp`/`device_id` field in the payload itself — the backend
  stamps its own `ts` (ISO 8601, server-side receipt time, not GPS time) when
  persisting (`backend/server.js:41-49,139-145`), and there is exactly one
  hardcoded MQTT client id (`"ESP32_Tracker"`,
  `firmware/src/main.cpp:575,675`), so today's system supports exactly one
  bike.

**`bike/config/interval` payload** — a single topic multiplexing three
unrelated command shapes, parsed in `mqttCallback()`
(`firmware/src/main.cpp:203-245`):

| Payload | Effect | Publisher |
|---|---|---|
| A bare positive integer string, e.g. `"30000"` | Sets `reportingIntervalMs` (RTC-retained across deep sleep via `RTC_DATA_ATTR`) | `POST /api/config/interval` (`backend/server.js:168`); the backend's interactive CLI prompt (`backend/server.js:320`); `sendEmergencyAlert()` auto-boosts to `"5000"` on any alarm (`backend/server.js:269`) |
| `"ALARM:ON"` / `"ALARM:OFF"` | Sets `alarmArmed` (also RTC-retained) | `POST /api/config/alarm` (`backend/server.js:180`) — note this handler publishes to the **same** `bike/config/interval` topic, not a separate alarm-command topic |
| `"SLEEP:<seconds>"` | Immediately powers off the modem and enters deep sleep for `<seconds>`, woken only by motion/power-sense pins or the timer | Not currently issued by any code in `backend/server.js` or the dashboard — a firmware-side command with no caller yet |

Important gap for the new app's backend to know about: **there is no
acknowledgement path.** Arming/disarming and interval changes are fire-and-forget
MQTT publishes; the firmware only logs the new state to `Serial`
(`firmware/src/main.cpp:212-216,239-241`) and never publishes a confirmation.
The web dashboard's arm/disarm buttons just alert "Command Sent!"
immediately on HTTP 200 from the backend, with no confirmation that the board
actually received or applied it (`backend/public/index.html:766-780`).

**`bike/alarm` payload**: a plain (non-JSON) string, currently always the
literal `"🚨 THEFT ATTEMPT IN PROGRESS!"` (`firmware/src/main.cpp:640`). The
backend treats receipt of *any* message on this topic as reason to fire
`sendEmergencyAlert()` (`backend/server.js:300-301`) — it does not branch on
payload content.

### 1.2 REST / SSE endpoints (`backend/server.js`, Express app)

All routes are behind a single global `express-basic-auth` middleware
(`DASHBOARD_USER`/`DASHBOARD_PASS`) registered before every route, deliberately
including the SSE endpoint (`backend/server.js:94-113`) — the code comment
there explicitly warns against moving it, since an unauthenticated
`/api/events` would leak live bike location without even a page load. Static
dashboard assets (`GET /`, `/index.html`, etc., via `express.static`) sit
behind the same guard.

| Method + path | Auth | Request | Response | Behavior | Source |
|---|---|---|---|---|---|
| `GET /api/events` | Basic Auth | none (EventSource, same-origin, browser reuses cached credentials) | `text/event-stream`, three named events (below) | Registers the response as a long-lived SSE client; broadcasts every `log`/`telemetry`/`alarm` event to all connected clients | `backend/server.js:148-161` |
| `POST /api/config/interval` | Basic Auth | JSON body `{ "interval": <number> }` | `200 {"success":true,"message":"Interval updated to <n>ms"}` or `400 {"success":false,"error":"Invalid interval value"}` | Validates `parseInt(interval,10) > 0`, publishes the number as a string to `bike/config/interval` | `backend/server.js:164-174` |
| `POST /api/config/alarm` | Basic Auth | JSON body `{ "command": "ALARM:ON" \| "ALARM:OFF" }` | `200 {"success":true}` or `400 {"success":false,"error":"Invalid command"}` | Publishes the literal command string to `bike/config/interval` | `backend/server.js:177-186` |

**SSE event types**, all sent via `sendSseEvent(type, data)`
(`backend/server.js:121-125`):

- `event: log`, `data: { timestamp, tag, message }` — every `logEvent()` call
  throughout the backend (broker connect/disconnect/auth-fail, config
  commands sent, telemetry summaries, server start/stop) is mirrored here.
  `tag` values seen in the code: `Server`, `Config`, `Backend`, `Broker`,
  `Telemetry`, `Raw Data`, `Error` (client-side only) — the dashboard derives
  a CSS class from `tag.toLowerCase()` (`backend/public/index.html:648`).
- `event: telemetry`, `data: <parsed bike/telemetry/location JSON, unmodified>`
  — sent every time the backend receives and successfully `JSON.parse()`s a
  telemetry message (`backend/server.js:294`). If parsing fails, it's logged
  under tag `Raw Data` instead and no `telemetry` event fires
  (`backend/server.js:295-297`).
- `event: alarm`, `data: { message, timestamp }` — sent from
  `sendEmergencyAlert()` on any `bike/alarm` message
  (`backend/server.js:263`).

There is no `GET` endpoint to fetch current/last-known telemetry, device
status, or arm state as a plain request/response — the only way to learn the
bike's current state today is to hold open an SSE connection (or read the
JSONL log described below). A new app backend that needs "get current status"
semantics (e.g. to answer a mobile app's cold-start query) has nothing to call
today; it would need to either keep its own SSE listener running and cache
the latest event, or read `bike/telemetry/location` itself as an MQTT
subscriber.

### 1.3 Event history persistence

Every `logEvent()` call also appends a JSONL record via `persistEvent()`
(`backend/server.js:41-49,139-145`), one file per UTC calendar day:
`~/.ebike-tracker/logs/events-<YYYY-MM-DD>.jsonl` (overridable via `LOG_DIR`
env var, `backend/server.js:25`). Each line is
`{ "ts": "<ISO8601>", "type": "<tag>", "message": "<string>", ...extraFields }`;
telemetry records additionally carry the full parsed payload under `data`
(`backend/server.js:293`, passed as `extraFields`). This is explicitly called
out in the code as an interim measure pending a real database (issue `#19`
referenced at `backend/server.js:19-20`) — there is no query API over this
history today, only the flat files.

### 1.4 Auth model recap

Two independent credential pairs, deliberately kept apart
(`backend/server.js:56-59,80-82`):
- `TRACKER_USER`/`TRACKER_PASS`: MQTT broker credentials, compiled into
  firmware (`secrets.h`, gitignored) — a stolen/dumped board's flash exposes
  only this pair.
- `DASHBOARD_USER`/`DASHBOARD_PASS`: HTTP Basic Auth for the entire Express
  app (dashboard + REST + SSE). The backend refuses to start if any of the
  four env vars is missing (`backend/server.js:67-78`) and warns at startup
  if the two passwords happen to match (`backend/server.js:80-82`).

### 1.5 What the existing dashboard actually renders (cross-check)

`backend/public/index.html` confirms the backend surface above is sufficient
for, and limited to: a Leaflet map marker driven by `lat`/`lon`; a speed
readout; a battery percentage bar and voltage readout (`battery_percent`,
`battery_voltage`); a "searching for GPS" badge when `lat===0 && lon===0`; a
scrolling log panel fed by the `log` SSE event; a full-width alarm banner on
the `alarm` event (auto-hides after 10s); and two plain forms posting to
`/api/config/interval` and `/api/config/alarm`. It does not surface
`rail_voltage`, `sats_used`/`sats_view`, or `gps_fixed` anywhere in the UI even
though they're in the payload — confirming those fields currently only exist
for logs/diagnostics, not for end-user display.

### 1.6 Not yet part of this surface (open PRs, unmerged)

`gh pr list --repo Kimishiba/eBike-GPS-Tracker --state open` shows PR #43
("Encrypt MQTT and dashboard traffic") adding parallel TLS-only ports
(`MQTT_TLS_PORT`, default 8883; `HTTPS_PORT`, default 3443) alongside the
existing plaintext ones, and binding the plaintext ports to `127.0.0.1` only.
Topic names and payload shapes are unchanged by that PR — only transport. It
is unmerged as of this audit, so the plain `mqtt://`/`http://` surface
documented above is what to build against today; revisit if #43 lands. PR #30
(BLE proximity auto-disarm, design-only, Android) and PR #29 (SoftAP recovery
portal) don't add or change telemetry topics/endpoints.

---

## 2. Telemetry opportunities

Hardware actually present on the board, per `firmware/src/main.cpp` and
`firmware/WIRING_ADXL345.md`: ESP32 (LilyGO T-SIM7000G), SIM7000G modem
(TinyGSM, cellular + GNSS), ADXL345 accelerometer (I2C), a battery-sense ADC
pin, a power-sense GPIO, and a buzzer (fitted in some units). Everything below
is a capability of that existing hardware/library stack that the firmware
reads but doesn't publish, or could read cheaply — nothing here proposes new
hardware.

| Signal | Comes from | Why it'd help the app |
|---|---|---|
| **Raw/graded impact magnitude (crash vs. tamper)** | ADXL345, `configureADXL345()` (`firmware/src/main.cpp:346-391`). Today there's exactly one AC-coupled activity threshold (`ADXL_THRESH_ACT = 12` → 750 mg) used only as a binary wake/no-wake gate — the chip never reports *how hard* it was hit, and the firmware discards the actual accelerometer sample. A second, higher threshold (the ADXL345 also has separate `THRESH_FF`/free-fall and could support a distinct high-g band) would let firmware distinguish a knock/shove from a genuine crash. | `features_backlog.md` ticket EBT-08 ("Crash Detection & SOS") is an explicit unimplemented want; today's telemetry has no way to tell a violent crash from a light bump, which the MVP/data-model tickets will need to decide whether to support. |
| **Post-wake orientation (tilt)** | Same ADXL345, via `accel.getEvent()` (already linked, currently unused for anything but the interrupt registers) — could read X/Y/Z once awake to compute tilt angle. | EBT-08's crash criterion is explicitly "abnormal tilt or horizontal orientation for >30s"; the sensor to support it is already on the board and I2C bus, just not read for this purpose. |
| **Motion-event count / intensity over time** | Same ADXL345 activity interrupt (`ADXL_REG_INT_SOURCE`, cleared in `motionInterruptClear()`, `firmware/src/main.cpp:400-414`) — currently only used to decide whether it's safe to arm the wake source, then discarded. | A running "N tamper triggers since last check-in" or "last-trigger severity" counter would give the app a much richer tamper history than today's single `alarm_triggered` boolean, which only survives one report cycle. |
| **GPS fix accuracy / HDOP** | `modem.getGPS()` already accepts and fills an `accuracy` output parameter (`float accuracy`, declared and passed at `firmware/src/main.cpp:593,599,693,697`) — it's computed by TinyGSM but never copied into the JSON payload. | Lets the app show a literal confidence radius on the map instead of a bare fixed/not-fixed flag — cheap since the value is already being computed and thrown away. |
| **GPS signal-to-noise (C/N0 max)** | `modem.getGPSraw()` field 19 of `+CGNSINF`, already parsed by `cgnsinfField(raw, 19)` — but only in the `logNoFix()` diagnostic path (`firmware/src/main.cpp:270-294`), i.e. only printed to `Serial` when there's *no* fix. Never published, and never read when a fix does succeed. | Distinguishes "no fix, weak antenna" from "no fix, cold start" for support/diagnostics, and even on a good fix gives a continuous fix-quality trend (e.g. to notice a slowly failing GPS antenna before it fails outright). |
| **Cellular signal strength (RSSI/CSQ)** | TinyGSM's `modem.getSignalQuality()` — a standard TinyGSM method for the SIM7000 family. Confirmed by `grep` across `main.cpp`/`recovery.cpp` that it is never called anywhere in this firmware today. | Would let the app flag "this bike is in a dead zone" instead of just "hasn't reported in N minutes" — directly relevant to a data-model ticket deciding how to represent staleness/connectivity health. |
| **Battery rail/cell divergence as a field, not just a serial warning** | `warnOnBatteryDivergence()` (`firmware/src/main.cpp:181-193`) already computes `|railVolts - cellVolts| >= 0.25V` — the exact signature of the regressed-battery-reporting bug documented at `firmware/src/main.cpp:97-123` — but only ever `Serial.printf`s it; it's dropped before reaching MQTT. | Surfacing this as a boolean/flag in telemetry would let the backend detect a degrading or miswired battery sensor remotely, instead of only from a live serial console — useful for a fleet of boards sealed inside frames. |
| **Long-run battery trend (voltage/percent history)** | `battery_voltage`/`battery_percent` are already published every cycle, but only as instantaneous point values — no on-device or backend aggregation exists yet (no DB; see 1.3). | Not a new sensor reading, but worth flagging for the data-model ticket: charge-cycle/aging trends (e.g. "curve slope is flattening, cell is aging") need this history retained somewhere, which today's JSONL-per-day files don't make queryable. |
| **Live bike-power-line state, polled every cycle** | `POWER_SENSE_PIN` (GPIO 32) is only read as a one-shot wake-reason check (`digitalRead(POWER_SENSE_PIN)` inside `enterDeepSleep()`, `firmware/src/main.cpp:435`) and via the `ext1` wakeup-cause bitmask at boot (`firmware/src/main.cpp:508-511`). The periodic `DEV_MODE_WIFI` loop path hardcodes `bike_on:true` rather than sampling the pin (`firmware/src/main.cpp:715`). | A continuously-sampled "is the bike currently switched on" flag (rather than only "did powering on wake us this cycle") would let the app show live ignition state, not just a historical wake event. |
| **On-device boot-health / recovery-portal state** | `recovery::noteBoot()`/`markHealthy()` (`firmware/src/recovery.h:19-26`) track a consecutive-boot-failure counter used to decide when to raise the SoftAP recovery portal — entirely internal to the firmware today, never published. | Reporting this counter (or just "reached the broker last N boots: Y/N") would let the app warn "this board may need a physical rescue soon" before it goes fully silent, rather than the app only inferring trouble from missed reports. |
| **Fine-grained wake-reason field** | `esp_sleep_get_wakeup_cause()` / `esp_sleep_get_ext1_wakeup_status()` already distinguish timer wake vs. motion-pin wake vs. power-pin wake vs. both (`firmware/src/main.cpp:498-514`), but the JSON payload only exposes this indirectly through the two derived booleans `alarm_triggered`/`bike_on`. | An explicit `wake_reason` enum (`timer`/`motion`/`power_on`/`both`) would be a strictly richer, more future-proof field for the data model than reverse-engineering it from two booleans that are only meaningful on the triggering cycle. |

Explicitly **not** proposed: nothing about tire pressure, cadence/wheel-speed
sensors, temperature, or NFC/BLE presence detection — none of that hardware
exists in this firmware today (BLE proximity is a design doc only, PR #30,
with no code merged; NFC is only a backlog ticket, EBT-05).

---

## Summary

- **Part 1**: two multiplexed MQTT topics for commands (`bike/config/interval`
  carries interval/alarm/sleep commands, no ack path) plus one telemetry topic
  and one alarm topic; three HTTP routes (`GET /api/events` SSE with
  `log`/`telemetry`/`alarm` events, `POST /api/config/interval`,
  `POST /api/config/alarm`) all behind a single dashboard Basic Auth pair
  distinct from the broker's; no query API over history, only daily JSONL
  files.
- **Part 2**: the ADXL345, GNSS, and cellular modem all already compute more
  than they publish (impact/orientation, fix accuracy/C-N0, signal quality),
  and two internal firmware states (boot-health counter, live power-pin
  reading) exist but never leave the device — all cheap additions since the
  data is already being computed or trivially readable, none requiring new
  hardware.
