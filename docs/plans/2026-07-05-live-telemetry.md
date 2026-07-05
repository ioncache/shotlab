# Live Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing socket-fed dashboard into a genuinely live brew view by feeding one shared chart/details surface from either live telemetry or shot history, while keeping both data sources available without stomping on each other.

**Architecture:** Reuse the existing `connectSocket()` path and the current chart/history UI instead of building a second live dashboard. Extract the socket-to-dashboard mapping out of `app.tsx`, build one synthetic "live shot" view model from confirmed `status` and `sensors` events, and let the existing chart/inspector components render either the live or history dataset through one shared chart surface. Keep the debug drawer and raw packet capture as-is.

**Tech Stack:** React, TypeScript, MUI, `@mui/x-charts`, `@shotlab/meticulous-client`, Vitest.

---

## Scope

This branch covers:

- promoting the current live socket stream from card updates into the main chart surface
- building a minimal live shot model from confirmed Socket.IO fields we already trust
- adding explicit source state for the shared chart/details surface: `Live` or `History`
- defaulting the shared chart/details surface to `Live` standby instead of auto-loading the most recent history shot
- preserving the existing history browser while keeping live telemetry buffered even when the user is looking at history
- surfacing the existing profile image when it is already present in profile/history data
- cleaning up stale roadmap/protocol assumptions if this branch depends on Socket.IO discovery being complete

This branch does **not** cover:

- new machine controls beyond the existing safe actions
- historical storage or export
- speculative telemetry fields that are not already present in the confirmed live event shapes
- a new image download/cache pipeline beyond rendering URLs already present in the payloads
- a large component split or app-wide state refactor

---

## Expected Files

### Existing files to modify

- `apps/web/src/app.tsx`
  - stop owning the live telemetry mapping inline
  - add chart source state and switch the shared chart/details surface between a live shot and history shots
- `apps/web/src/app.test.tsx`
  - add rendering coverage for the live shot path
- `apps/web/src/lib/dashboard-types.ts`
  - extend the dashboard shot model just enough to represent a live shot cleanly
  - add a small source discriminator type if that is the shortest clean path
- `apps/web/src/lib/dashboard-selectors.ts`
  - carry profile image URLs through the mapped history shot shape when present
- `apps/web/src/lib/dashboard-selectors.test.ts`
  - cover profile image mapping from nested profile payloads
- `apps/web/src/lib/shot-chart.ts`
  - keep the chart helpers working for both history shots and the synthetic live shot
- `apps/web/src/lib/shot-chart.test.ts`
  - add coverage for any live-shot chart formatting differences
- `docs/ROADMAP.md`
  - check off `Socket.IO discovery` if the repo should finally acknowledge the completed capture/type work
  - check off `Live telemetry` only if this branch leaves the dashboard meaningfully live
- `docs/protocol.md`
  - remove stale Socket.IO "current gaps" notes if they no longer match reality

### New files likely needed

- `apps/web/src/lib/live-telemetry.ts`
  - one focused home for socket event patching and live-shot accumulation
- `apps/web/src/lib/live-telemetry.test.ts`
  - fixture-style coverage for the confirmed event shapes and live-shot assembly

### Files to avoid unless clearly necessary

- new dependencies
- a second chart component just for live telemetry
- a new global state layer
- extra protocol model files for events we are not using in the dashboard yet

---

## Task 1: Lock The Shared Chart Target

- [x] Re-read the current live socket path in `apps/web/src/app.tsx`, the confirmed event types in `packages/meticulous-client/src/socket-types.ts`, and the current chart helpers before editing.
- [x] Keep the branch outcome narrow:
  - reuse the existing live cards
  - preserve the history table workflow
  - make the primary chart and selected-shot panel render either live or history data through one shared surface
- [x] Treat the chart/details surface state explicitly:
  - default source is `Live`
  - `Live` starts empty/standby until meaningful telemetry arrives
  - `History` keeps its own selected-shot state and can still default to the most recent saved shot
  - clicking a history row switches the source to `History`
  - live telemetry continues accumulating even while `History` is selected
  - a newly detected live session can auto-switch the source back to `Live`
  - packets from an already-running live session must not keep forcing the source back to `Live` after the user has switched to `History`
- [x] Treat these fields as the first-class live input surface unless implementation proves otherwise:
  - `status.payload[0].profile_time`
  - `status.payload[0].profile`
  - `status.payload[0].loaded_profile`
  - `status.payload[0].state` / `status.payload[0].status` / `status.payload[0].name`
  - `status.payload[0].sensors.{f,g,p,t,w}`
  - `sensors.payload[0].weight_pred`
- [x] Avoid creating a "perfect telemetry domain model." One synthetic `DashboardShot`-shaped live view is enough for this branch.
- [x] Treat profile images as opportunistic UI enrichment only:
  - use `profile.display?.image` or equivalent already-present mapped data
  - do not create a second fetch path just to resolve missing images

**Exit criteria**

- the plan is anchored on one chart with two data sources, not "re-wire cards again"
- the implementation target is a single branch-sized UI slice

---

## Task 2: Add Profile Imagery To The Existing History-Driven UI

- [x] Extend `apps/web/src/lib/dashboard-types.ts` just enough to carry an optional `profileImage` URL on `DashboardShot`.
- [x] Update `apps/web/src/lib/dashboard-selectors.ts` to map `profile.display?.image` through history shots when that URL already exists in the payload.
- [x] Do not add any new image fetch path. If the URL is absent, leave the field undefined.
- [x] Update the history table UI in `apps/web/src/app.tsx` to add a small leading image/icon column for shots that have a profile image.
- [x] Update the chart header/details area in `apps/web/src/app.tsx` to render a larger profile image beside the existing profile/title block when present.
- [x] Keep the layout text-only when no image exists.

**Exit criteria**

- history shots can carry profile image URLs through the current selectors
- the existing history-driven UI can render profile imagery before any live-telemetry changes begin

---

## Task 3: Stop Auto-Loading The First History Shot

- [x] Update `apps/web/src/app.tsx` so the top-level chart/details surface no longer auto-selects the first history shot on load.
- [x] Keep the history table data loaded and browseable, but leave the shared chart/details surface in an explicit empty or standby state until the user picks a history shot or switches to a source that has data.
- [x] Remove any selection effect that automatically falls back to `snapshot.shots[0]` as the displayed chart source.
- [x] Keep the history selection logic simple:
  - no selected history shot by default
  - clicking a row selects that history shot
  - when the selected history shot disappears from a refreshed snapshot, clear the history selection rather than silently jumping to another row

**Exit criteria**

- the dashboard no longer opens by showing the most recent history shot in the main chart
- history remains available without auto-driving the chart surface

---

## Task 4: Add Explicit `Live` And `History` Source State To The Shared Chart Surface

- [x] Update `apps/web/src/app.tsx` to store:
  - the selected history shot id
  - the active chart source: `live` or `history`
- [x] Make `Live` the default source for the shared chart/details surface.
- [x] Show a clear standby empty state when `Live` is selected but meaningful live telemetry has not started yet.
- [x] Add the smallest clear source toggle in the chart/details area:
  - `Live`
  - `History`
- [x] Keep `History` browseable at all times. Clicking a history row should:
  - select that history shot
  - switch the shared chart/details surface to `History`
- [x] Update the selected-shot/details panel so the operator can tell whether the current surface is showing live telemetry or a stored history shot.
- [x] Make the UI language honest:
  - remove copy that says the chart is "history now and live streaming later"
  - add a small source indicator or toggle only where it clarifies the current dataset
- [x] Keep the debug drawer behavior unchanged apart from any imports that move.

**Exit criteria**

- the shared chart/details surface can switch cleanly between `Live` and `History`
- the dashboard defaults to `Live` standby instead of auto-selecting history

---

## Task 5: Extract The Live Telemetry Mapper Out Of `app.tsx`

- [x] Create `apps/web/src/lib/live-telemetry.ts`.
- [x] Move the current socket patching helpers there rather than inventing a second path:
  - `applyLiveSocketEvent`
  - `patchMachineFromStatusEvent`
  - `patchMachineFromSensorsEvent`
  - `patchSettingsFromSettingsEvent`
  - `patchLastProfileFromProfileEvent`
- [x] Add the smallest new helper surface needed for this branch, likely in the shape of:

```ts
export interface LiveTelemetryState {
  lastProfile: LastProfileResponse;
  liveShot?: DashboardShot;
  machine: JsonObject;
  settings: Settings;
}

export function applyLiveSocketEvent(
  input: ApplyLiveSocketEventInput,
): LiveTelemetryState
```

- [x] Keep the source of truth boring:
  - `status` events update machine/profile/session timing/core metrics
  - `sensors` events only backfill fields that `status` does not keep current enough
- [x] Do not create a class, reducer framework, or event bus here.

**Exit criteria**

- `app.tsx` stops owning live telemetry mapping details inline
- one small helper file contains the live patch logic and live-shot accumulation

---

## Task 8: Finish Refactoring The Web App Surface Into Separate Components

- [x] Finish the extraction pass so `apps/web/src/app.tsx` is a coordinator instead of a rendering dump again.
- [x] Keep the current extracted surfaces as the baseline:
  - shared chart surface
  - selected-shot/live-details panel
  - history table
  - actions
  - socket debug drawer
- [x] Finish the remaining cleanup mechanically:
  - keep existing props/state flow
  - do not redesign the data model during extraction
  - move any remaining component-local rendering logic out of `app.tsx`
  - trim prop shapes only where obvious
- [x] Keep tests close to the extracted pieces where that improves clarity without broadening this branch.
- [x] Update the plan checkboxes to reflect the extraction work that is already real instead of leaving stale unchecked items behind.

**Exit criteria**

- `app.tsx` returns to being a coordinator instead of the home for all dashboard rendering
- the chart, details, history, and adjacent dashboard surfaces can evolve without continuing to bloat one file

---

## Task 10: Add The Profiles Card And Carousel Slice

- [x] Add a new card under the existing actions card with the title `Profiles`.
- [x] Keep this as a separate vertical surface rather than mixing profile browsing into the actions card itself.
- [x] Build the profile browser as a vertical carousel that shows 3 profiles at a time.
- [x] Treat carousel implementation as a package-level decision:
  - first check whether the existing installed stack already provides a suitable vertical carousel
  - if it does not, stop and research package options before implementation
  - do not hand-roll carousel behavior
  - do not add a new dependency without explicit approval
- [x] Keep the carousel behavior minimal:
  - scrolling up/down rotates through the available profiles
  - no alternate grid/list mode
  - no drag behavior unless the existing stack already gives it to us for free
- [x] The selected/loaded/live-brew profile should always occupy the middle visible row of the 3.
- [x] Visually treat the center row as the active one:
  - active profile icon uses the full-colour asset
  - the profile above and below use greyed-out styling
- [x] Add a placeholder `Load profile` button under the carousel.
- [x] Keep that button disabled for now, matching the current placeholder-control approach used elsewhere in the dashboard.
- [x] Clicking a profile should select it and render that profile's details below the button.
- [x] When a live brew is happening, the details panel should show the brew profile details rather than a separate idle selection.
- [x] Ensure the `Load profile` button still does not do anything during a live brew.
- [x] Treat this as a new component set, not another expansion of `app.tsx`:
  - profile card container
  - carousel/list surface
  - profile details surface
- [x] Keep the first pass read-only:
  - no live load action yet
  - no optimistic state

## Task 13: Add History Shot Replay Controls To The Shared Chart

- [x] Keep replay on the existing shared chart surface instead of building a second chart mode.
- [x] Add minimal replay controls for history shots:
  - `Start`
  - `Play/Pause`
  - `End`
  - slider scrubber under the chart
- [x] Make replay drive the same active point used by the chart details so the top metrics move as if the shot were live.
- [x] Reset replay when the selected history shot changes:
  - stop playback
  - load the final point as the default displayed state
- [x] Keep live brews non-replayable while the brew is still active.
- [x] Keep replay timing tied to real wall-clock elapsed time instead of chained point-by-point timers so browser render delay does not stretch the total shot duration.
- [x] Keep the full chart domain stable during replay and mask future data points instead of shrinking the axis down to the visible slice.
- [x] Keep hover preview separate from replay state:
  - hovering a visible point previews that point without moving replay
  - empty future replay space shows no tooltip, no hover line, and no future point details
- [x] Defer the finished-live handoff decision:
  - do not invent a live-to-history auto-switch in this branch
  - revisit replay controls for a finished live shot once that handoff behavior is decided

**Exit criteria**

- history shots can be replayed through the shared chart surface without a new data model
- switching shots returns the UI to the final-shot state and stops replay
  - no new dependency unless the existing stack clearly cannot cover the interaction
- [x] Prefer the approved installed carousel library over hand-rolled rotation math.

**Exit criteria**

- the dashboard has a separate `Profiles` card below `Actions`
- 3 profiles are visible at a time in a vertical rotating browser
- the active selected/loaded/live-brew profile stays centered in the middle row
- selecting a profile shows its details below the disabled `Load profile` button
- live brew state shows brew-profile details without enabling profile loading

---

## Task 6: Build A Synthetic Live Shot That Reuses The Existing Chart Model

- [x] Extend `apps/web/src/lib/dashboard-types.ts` only as far as needed to distinguish a live shot from a history shot. Prefer a tiny discriminator over a second parallel type tree.
- [x] Build the live shot in `apps/web/src/lib/live-telemetry.ts` as a normal `DashboardShot`-shaped object with:
  - stable `id` such as `live-shot`
  - a `profile` label from the best confirmed live profile field
  - a `profileImage` URL when the active profile already exposes one
  - point rows appended from confirmed live metrics over `profile_time`
  - `durationSeconds` from the latest point time
  - `yieldGrams` from the latest trustworthy weight field
- [x] Keep point deduplication simple:
  - if a new event does not advance the live timeline meaningfully, patch the latest point instead of appending a duplicate
  - otherwise append a new point
- [x] Reset or replace the live shot when the machine clearly returns to a non-brewing idle state and the session is no longer useful.
- [x] Reuse the existing chart fields:
  - `pressure`
  - `flow`
  - `gravimetricFlow`
  - `weight`
  - `second`
- [x] Only add temperature to the selected-point details if it falls out cleanly from the existing model work.

**Exit criteria**

- the live shot can travel through the existing chart helpers with little or no UI branching
- the branch does not fork the dashboard into separate live and history chart implementations

---

## Task 7: Wire The Live Telemetry Into The Shared Source Model

- [x] Update `apps/web/src/app.tsx` to store the synthetic live shot alongside the existing machine/settings/profile state and the new chart-source state.
- [x] Keep live telemetry accumulation running in the background even while `History` is selected.
- [x] Feed the shared chart/details surface from the live shot when the active source is `Live` and the live shot has meaningful data.
- [x] Keep the `Live` source in standby when no live shot exists yet.
- [x] Detect the start of a new live session explicitly, using the smallest reliable session boundary already present in the confirmed telemetry.
- [x] Auto-switch the active source to `Live` when a **new** live session starts.
- [x] Do not let ongoing packets from the **current** live session override a manual switch to `History`. The source toggle remains the source of truth after that one-time session-start transition.
- [x] Preserve the existing live cards and debug drawer while moving the mapping code to the shared live-telemetry helper.

**Exit criteria**

- live telemetry is wired into the new source model without stomping on `History`
- switching back to `Live` reveals the in-memory live session if it is still active
- a later new session start can bring the operator back to `Live` once, but the current session cannot keep stealing focus

---

## Task 9: Extract UI Copy Into A Localization Layer

- [ ] Stop adding new raw user-facing strings directly in React components once the current telemetry behavior is stable.
- [ ] Pick the localization approach intentionally before implementation:
  - review existing repo/frontend patterns first
  - if a new package is needed, research options and get approval before adding it
  - `i18next`/`react-i18next` is a likely candidate, but do not assume it by default
- [ ] Create the first English translation file and move current UI copy into translation keys instead of inline strings.
- [ ] Start with the surfaces already touched in this branch:
  - chart header/title/subtitle text
  - empty-state messages
  - selected-shot/live-details labels
  - history table labels
  - action labels and common status copy
- [ ] Keep the first pass mechanical:
  - preserve current wording unless the branch already changed it intentionally
  - replace string literals with translation lookups

---

## Task 14: Add Temporary Brand Assets For Header And Favicon

- [x] Replace the placeholder app icon with a simple warm SVG favicon/app icon for ShotLab.
- [x] Add a matching horizontal SVG logo for the dashboard header.
- [x] Keep the first branding pass intentionally simple:
  - flat vector art
  - espresso glass with crema
  - warm palette
  - easy to replace later
- [x] Wire the header to use the shared logo asset instead of plain text-only branding.
- [x] Remove developer-facing descriptive copy from the header so the branding stays UI-facing only.

**Exit criteria**

- the favicon request resolves to a real ShotLab SVG asset
- the dashboard header uses the temporary shared ShotLab logo system
  - avoid mixing localization work with broader UI redesign
- [ ] Leave room for later language expansion without requiring another sweep through component files.

**Exit criteria**

- user-facing UI copy is keyed instead of hard-coded in the main component tree
- the first English translation file exists and is wired into the web app
- any new dependency for localization was researched and explicitly approved before installation

---

## Task 11: Tighten Tests Around The Real Live Path

- [ ] Add focused unit coverage in `apps/web/src/lib/live-telemetry.test.ts` for:
  - `status` events creating or advancing a live shot
  - `sensors` events backfilling live weight without breaking the latest point
  - idle/non-useful events not creating junk chart points
  - profile load events patching the live profile label correctly
- [ ] Update `apps/web/src/lib/dashboard-selectors.test.ts` so at least one fixture proves history shots carry through a profile image URL when it exists in nested profile data.
- [ ] Update `apps/web/src/app.test.tsx` so render coverage proves:
  - the app starts in `Live` standby rather than auto-loading history into the chart
  - clicking a history row switches the shared chart/details surface to `History`
  - live socket events can populate the live dataset without breaking the stored history selection
  - a newly started live session auto-switches the source to `Live`
  - additional packets from that same running session do not yank the UI back from a manual `History` selection
- [ ] Add render coverage for the profile imagery:
  - history rows show a small leading icon/image when present
  - the chart header/details area shows the larger image when present
- [ ] Update `apps/web/src/lib/shot-chart.test.ts` only if the live-shot discriminator changes formatting or summary behavior.
- [ ] Keep tests fixture-sized and local. No browser E2E harness for this branch.

**Exit criteria**

- the live telemetry path has direct tests at the mapper layer and one app-level smoke test
- chart/history regressions stay easy to catch

---

## Task 12: Close The Paper Trail Only If The UI Outcome Is Real

- [ ] Re-check `docs/ROADMAP.md` against the repo state before editing:
  - `Socket.IO discovery` should be checked off if the prior capture/type work plus current docs now make that step honestly complete
  - `Live telemetry` should be checked off only if this branch leaves the web app meaningfully live for daily use
- [ ] Update `docs/protocol.md` only for stale statements that are now plainly false. Do not turn this into a second protocol-discovery branch.
- [ ] If implementation exposes one clearly useful extra live field we already have, add it. Otherwise skip it.

**Exit criteria**

- roadmap state matches reality
- docs changes stay small and evidence-based

---

## Verification Checklist

- [x] `yarn workspace @shotlab/web test`
- [x] `yarn workspace @shotlab/web build`
- [ ] manual smoke check against the real machine:
  - the live cards still update
  - the shared chart/details surface starts in `Live` standby
  - the live dataset appears during an active session
  - selecting a history row switches the shared chart/details surface to `History`
  - switching back to `Live` shows the still-running live session if it is still active
  - a later newly started session returns the source to `Live` once
  - history rows and the chart header show profile imagery when the active profile includes an image URL
- [ ] if the manual smoke check reveals a directly available high-signal metric that the dashboard should already show, decide in-branch whether to add it or explicitly skip it

---

## Follow-Up

After this branch, the next useful dashboard slice should be whichever of these remains true:

- if live telemetry is solid but controls are still missing, move to `Machine controls`
- if live telemetry exposes gaps in the protocol notes, do a tiny docs-only cleanup rather than reopening discovery
- if the live chart proves the need for persisted session playback, that belongs in the later storage/history phases, not here
