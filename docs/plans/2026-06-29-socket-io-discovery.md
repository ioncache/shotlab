# Socket.IO Discovery Implementation Plan

**Goal:** Discover the Meticulous Socket.IO connection flow, confirm the real event surface, and add only the minimum client support needed for confirmed socket behavior.

**Architecture:** Keep this slice inside `@shotlab/meticulous-client` so the same package owns both REST and socket protocol discovery. Start with a low-level connection surface and event capture path, not a high-level brewing abstraction. Only promote payloads to stable types after they are observed on the real machine.

**Tech Stack:** TypeScript, Vitest, opt-in real-machine integration tests, GitHub-local docs, and one approved Socket.IO client dependency if needed after package research.

---

## Scope

This branch covers:

- confirming the actual Socket.IO/Engine.IO handshake behavior
- confirming how the machine upgrades from polling to WebSocket
- capturing real event names and raw payload shapes
- adding a low-level socket connection API in `@shotlab/meticulous-client`
- adding opt-in integration tests that observe socket traffic without starting a brew
- documenting confirmed behavior in the protocol docs and package README

This branch does **not** cover:

- live dashboard wiring
- brewing controls over socket
- profile execution logic
- final shared domain modeling for every socket payload

---

## Expected Files

### Existing files to modify

- `packages/meticulous-client/package.json`
  - Add any approved socket dependency and test script changes.
- `packages/meticulous-client/src/index.ts`
  - Keep the first socket client surface here unless the file becomes clearly unwieldy.
- `packages/meticulous-client/src/index.test.ts`
  - Add unit coverage for socket URL handling and event plumbing.
- `packages/meticulous-client/integration/read.integration.test.ts`
  - Reuse shared integration config patterns if that stays clean.
- `packages/meticulous-client/vitest.integration.config.ts`
  - Include the new socket integration file if needed.
- `packages/meticulous-client/README.md`
  - Document the confirmed socket API surface and any integration command.
- `docs/protocol.md`
  - Replace the current placeholder Socket.IO section with confirmed details.
- `docs/ROADMAP.md`
  - Check off `Socket.IO discovery` only if this branch fully completes that step.

### New files likely needed

- `packages/meticulous-client/integration/socket.integration.test.ts`
  - Opt-in real-machine socket verification.
- `docs/plans/2026-06-29-socket-io-discovery.md`
  - This plan.

### Files to avoid unless clearly necessary

- dedicated socket abstractions split across many files
- event-specific model files before the event surface is actually stable
- dashboard changes in `apps/web`

---

## Task 1: Lock The Discovery Surface

- [x] Re-read `docs/protocol.md`, `packages/meticulous-client/src/index.ts`, and the current integration test setup before editing anything.
- [x] Confirm what this branch must answer:
  - exact socket endpoint
  - transport sequence
  - namespace usage if any
  - connect/disconnect behavior
  - event names observed while idle
  - event names observed during safe actions only
- [x] Keep the branch outcome low-level:
  - connection helper
  - raw event subscription
  - documented observed payloads
- [x] Do **not** design a rich domain API yet.

**Exit criteria**

- the implementation target is explicitly limited to discovery and low-level client support
- no dashboard work is mixed into this branch

---

## Task 2: Dependency Gate For The Socket Client

- [x] Research the client options before adding a package.
- [x] Compare at least:
  - `socket.io-client`
  - lower-level `engine.io-client` only if it looks meaningfully simpler
- [x] Check for:
  - recent releases
  - maintenance activity
  - compatibility with Socket.IO v4 / Engine.IO v4
  - whether the package gives us raw enough hooks for discovery
- [x] Present the package comparison and recommendation before installation.
- [x] Only after approval, add the chosen dependency in `packages/meticulous-client/package.json`.

**Expected outcome**

- one approved dependency choice
- no custom socket protocol implementation

---

## Task 3: Add A Minimal Low-Level Socket Client API

- [x] Extend `packages/meticulous-client/src/index.ts` with the smallest useful socket surface.
- [ ] Keep the first version low-level, something in this shape:

```ts
export interface MeticulousSocketEvent {
  event: string;
  payload: unknown[];
}

export interface MeticulousSocketConnection {
  close(): Promise<void> | void;
  onAny(listener: (event: MeticulousSocketEvent) => void): void;
}
```

- [x] Add a client entrypoint that connects but does not invent semantics:

```ts
connectSocket(options?: {
  onAny?: (event: MeticulousSocketEvent) => void;
}): Promise<MeticulousSocketConnection>
```

- [x] Keep URL construction aligned with the existing `baseUrl` normalization.
- [x] Support the real machine origin without requiring callers to know `/socket.io/` details.
- [x] Make cleanup explicit and idempotent.
- [x] Avoid event-specific helpers in this branch.

**Unit test targets**

- [x] socket URL is derived from the normalized base URL
- [x] `onAny` events are forwarded in the observed raw shape
- [x] `close()` is safe to call after connect

**Exit criteria**

- the package can establish a socket connection and stream raw events
- the API is still obviously discovery-oriented, not a final abstraction

---

## Task 4: Add Opt-In Real-Machine Socket Verification

- [x] Create `packages/meticulous-client/integration/socket.integration.test.ts`.
- [x] Keep it opt-in and separate from default unit tests.
- [x] Reuse the existing integration env/config pattern.
- [x] The integration test should:
  - connect to the machine socket
  - confirm the connection succeeds
  - capture a bounded sample of raw events
  - verify we receive at least the connection/session activity we expect
  - optionally trigger only safe actions if needed to stimulate traffic
- [x] If a safe action is used:
  - never start brewing
  - return the machine to a neutral state before the test exits
- [x] Bound the run so it does not hang forever waiting for events.
- [x] Save assertions around behavior, not around one giant snapshot dump.

**Likely command**

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
yarn workspace @shotlab/meticulous-client test:integration
```

If a separate script is cleaner, add one such as:

```bash
yarn workspace @shotlab/meticulous-client test:integration:socket
```

**Exit criteria**

- a real machine connection is proven
- discovery is repeatable without manual browser sniffing

---

## Task 5: Capture And Document Confirmed Event Shapes

- [x] Replace the placeholder Socket.IO section in `docs/protocol.md` with confirmed findings:
  - endpoint
  - transport behavior
  - namespace behavior
  - connection lifecycle
  - observed event names
  - representative payload notes
- [x] Keep payload documentation honest:
  - confirmed names only
  - representative fields only when observed
  - unknown fields remain unknown
- [x] Update `packages/meticulous-client/README.md` with the new socket API usage.
- [x] Note any intentionally unresolved questions that remain after this branch.

**Exit criteria**

- protocol docs are more specific than “TBD”
- package README shows how to connect and observe events

---

## Task 6: Close The Roadmap Step If Fully Complete

- [ ] Re-check the roadmap definition for `Socket.IO discovery`:
  - reverse engineer the connection and event flow
  - capture event names, payloads, and connection behavior
  - add client support only for confirmed events
- [ ] Only mark it complete in `docs/ROADMAP.md` if all three are satisfied by this branch.
- [x] If one part remains incomplete, leave the roadmap unchecked and note the exact gap in the PR.

Current gap:

- only idle socket traffic is documented so far; safe-action event bursts still need sampling before the roadmap step should be checked off

---

## Verification Checklist

- [x] unit tests for the socket client surface pass
- [x] real-machine socket integration test passes
- [ ] `yarn workspace @shotlab/meticulous-client build`
- [x] `yarn workspace @shotlab/meticulous-client test`
- [x] updated docs match the real observed machine behavior

---

## Open Questions To Answer During The Branch

- Does the machine use only the default namespace?
- Does it emit useful idle telemetry without any action?
- Which safe action produces the smallest useful event burst for testing?
- Does the machine require polling first, or can the client upgrade directly?
- Does `history/current` or any REST endpoint correlate with socket events in a useful way?

## Confirmed REST Shape Notes

- `GET /settings` includes `heating_timeout`, which should drive the temporary preheat countdown label in the dashboard instead of inferring a timer from socket events.
- `GET /profile/last` returns a wrapper object with `load_time` and nested `profile`; it is not a bare profile object.
- `GET /profile/list` returns rich profile objects with metadata such as `name`, `id`, `author`, `author_id`, `previous_authors`, `display`, `temperature`, `final_weight`, `variables`, and `last_changed`.
- `GET /machine` returns machine identity/build fields such as `name`, `hostname`, `serial`, `firmware`, `software_version`, `image_version`, `image_build_channel`, `build_date`, and nested `repository_info`.
- `GET /history/last` returns a shot envelope with keys such as `id`, `db_key`, `time`, `file`, `name`, nested `data[]` points, and nested `profile` metadata.
- `GET /history/last.data[]` points include nested `shot`, `sensors`, `time`, `profile_time`, and `status` fields; the `shot.setpoints` object is part of the observed payload.

---

## Dashboard Debug Stream Handling Follow-Up

The current debug drawer is good enough to prove the socket is alive, but not good enough for sustained high-frequency telemetry. A flat packet list scrolls too quickly to inspect, selected entries disappear as old rows are trimmed, and per-packet React updates will not scale once we wire more of the dashboard to live data.

### Goals

- keep the debug drawer usable under sustained high event rates
- preserve a stable selection while new packets continue to arrive
- bound memory use and rendered component count
- stop socket collection when the drawer is closed
- keep the shape compatible with the long-term design where the main dashboard owns the socket connection and passes processed data into the drawer

### Agreed Approach

- replace the primary flat packet list with a grouped event browser
- group by event name and show aggregate summaries first
- keep bounded per-event raw history in ring buffers
- buffer socket ingestion outside React state and flush into the UI on a fixed cadence
- keep browser-local time in the main dashboard and raw machine timestamps in the debug drawer

### Proposed Drawer Shape

- summary list of event groups, not every packet
- each row shows event name, total count since open, recent activity rate, last seen time, and a short payload preview
- selecting a group opens a detail pane with bounded recent raw packets for that event name
- the drawer remains fixed width and fixed height with internal scroll areas

### Data Handling Rules

- open drawer: start a socket session and clear volatile debug data
- close drawer: close the socket and stop collecting events
- keep one aggregate record per event name plus one bounded ring buffer per event name
- do not keep an unbounded global packet timeline in memory
- keep selection attached to the event group so it does not disappear when old raw packets are evicted
- if a timeline view is needed later, make it a secondary filtered view rather than the primary rendering model

### React Implementation Notes

- ingest packets into mutable refs or another non-rendering buffer first
- publish UI state on a throttle/flush interval, starting at `250ms`
- render summaries by event group instead of one React row per incoming packet
- selection state should reference the stable event group, not an evictable packet row

### Deferred Until We See More Real Data

- the final per-event history cap
- whether very noisy telemetry should be coalesced further for the main dashboard
- whether the main dashboard needs a second sampled or debounced live-data path separate from the raw debug view
- tests for this drawer behavior

This is intentionally a dashboard follow-up to the discovery branch, not a reason to widen the low-level `@shotlab/meticulous-client` API before the event surface is actually understood.

---

## Live Dashboard Cards Follow-Up

The dashboard now has enough confirmed socket evidence to begin using the live stream for the machine-status cards. This branch will keep the original REST calls only for bootstrap, then treat socket events as the live source of truth for the card state.

### Scope

This follow-up covers:

- one shared socket connection owned by `App`
- patching live dashboard state from confirmed socket events
- updating the existing machine-status cards from live socket-backed state
- moving the debug drawer to consume the shared socket event stream instead of owning its own connection

This follow-up does not cover:

- live idle chart updates
- live brew chart updates
- automatic REST refresh if the socket disconnects and cannot recover
- action wiring for dashboard buttons
- speculative normalization of every socket payload

### Confirmed Event Inputs

The live card wiring may use these confirmed events:

- `status`
- `sensors`
- `settings`
- `profile`
- `profileHover`
- `heater_status`
- `button`

Not every confirmed event should drive the cards directly. `status` is the primary live source for card state. The others should patch only the specific fields they clearly own.

### State Model

`App` keeps the existing bootstrap state objects:

- `machine`
- `settings`
- `history`
- `lastProfile`

After bootstrap, socket events patch `machine`, `settings`, and `lastProfile` directly in React state. There is no second overlay state object.

This keeps one evolving in-memory state for the dashboard:

- REST gives the first snapshot
- socket updates rewrite the same state objects over time
- cards always read the latest in-memory state

`history` remains REST-backed in this slice. The selected-shot chart and history table stay unchanged until we explicitly wire live brew behavior later.

### Socket Ownership

`App` owns one shared Socket.IO connection when `METICULOUS_BASE_URL` is configured.

That shared connection is responsible for:

- patching live dashboard state
- feeding the grouped debug event stream data

The debug drawer becomes a pure consumer:

- receives socket connection state as props
- receives grouped debug event data as props
- keeps only local UI state such as open/closed and selected event group
- does not open or close its own socket connection

### Event Mapping Rules

#### `status`

`status` is the primary live machine-state event.

It updates these machine-facing fields:

- machine status from `state` and `name`
- loaded profile from `loaded_profile` or `profile`
- live weight from `sensors.w`
- live temperature from `sensors.t`
- live setpoint activity from `setpoints`

This event should be treated as the main source for the dashboard cards whenever those fields are present.

#### `sensors`

`sensors` is richer telemetry and should only patch fields that are clearly confirmed.

For this slice it may update:

- weight-like values when `status.sensors.w` is absent
- heater-related power/current details if needed to support the live pre-heat display

It should not cause the main chart to stream while the machine is idle.

#### `heater_status`

`heater_status` is the confirmed live signal that heating output is active.

For this slice:

- `heater_status > 0` means the `Pre-heat` card should show `On`
- `heater_status === 0` means the `Pre-heat` card should show `Off`

If this event has not yet been seen, the card may remain `Unknown` until a confirmed live heating signal arrives.

#### `profile`

The confirmed observed payload shape includes:

```json
{
  "change": "load",
  "profile_id": "<id>"
}
```

For this slice, `profile` should only support the confirmed `change: "load"` case. It may patch `lastProfile` conservatively, but should not invent semantics for other profile changes until they are observed.

#### `settings`

The observed `settings` event may be an empty object.

Rules:

- never clear known settings state from an empty payload
- only patch keys that are actually present
- do not treat empty `{}` as authoritative reset data

#### `profileHover`

This event is useful for discovery and debug visibility, but it should not drive the dashboard cards in this slice.

Observed samples now include `from: "dial"` in addition to the earlier backend-origin sample.

#### `button`

This event appears when using the machine controls directly.

Confirmed observed payload shape:

```json
{
  "type": "ENCODER_PUSH",
  "time_since_last_event": 10000
}
```

Observed `type` values in this session:

- `ENCODER_PRESSED`
- `ENCODER_RELEASED`
- `ENCODER_PUSH`

For this slice, `button` should stay discovery/debug-only. Do not map it to dashboard behavior yet.

### Card Semantics

#### Machine Status

Read from live `status` first.

Use:

- `state` as the main machine-state label
- `name` as supporting internal context if needed

#### Weight

Read from live `status.sensors.w` first.

Only if that is absent may the implementation fall back to a confirmed live sensor-derived weight field.

#### Temperature

Read from live `status.sensors.t` first.

Only if that is absent may the implementation fall back to another confirmed live temperature field.

#### Last Loaded Profile

Read from the latest live status/profile data:

- prefer `status.loaded_profile`
- then `status.profile`
- then any conservative confirmed `profile`-event update

#### Pre-heat

`Pre-heat` is a live heating-activity card, not a boot-time settings card.

Use:

- `heater_status` as the primary live signal
- `status.setpoints.active === "temperature"` as supporting evidence when useful

Do not map unrelated settings such as `heat_on_boot` to this card.

### Failure Behavior

This slice does not add REST re-fetch fallback.

If the socket disconnects:

- keep the last in-memory live state visible
- keep the socket connection status visible in the debug drawer
- do not add automatic REST refresh yet

If a socket payload is partial:

- patch only the confirmed fields present in that payload
- do not wipe unrelated fields

### Expected File Changes

- `apps/web/src/app.tsx`
  - move socket ownership into `App`
  - patch live state objects from socket events
  - pass grouped debug data and socket status into the drawer
- `apps/web/src/lib/dashboard-selectors.ts`
  - keep selectors aligned with live-updated state semantics
  - ensure `Pre-heat` reflects confirmed live heating signals rather than guessed settings aliases
- `apps/web/src/lib/dashboard-types.ts`
  - add only the minimum extra types needed for shared debug/socket props if that keeps `app.tsx` readable

This work remains in the current worktree and branch even though it extends beyond the original narrow discovery roadmap step. The branch now also records the first live dashboard card wiring from confirmed socket data.

---

## Definition Of Done

This branch is done when:

- the real machine socket connection is confirmed and repeatable
- the package exposes a low-level socket discovery API
- at least one opt-in integration test proves the connection against the real machine
- the protocol docs capture confirmed event names and connection behavior
- the roadmap step can honestly be checked off, or the remaining gap is explicit
