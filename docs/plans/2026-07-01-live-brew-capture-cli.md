# Live Brew Capture CLI Implementation Plan

**Goal:** Upgrade the existing socket monitor into a small CLI that you can run manually to capture live brew data locally, save both raw and normalized outputs, and inspect recordings later without involving the agent in the live run.

**Architecture:** Keep this slice inside `@shotlab/meticulous-client` and build on top of the existing socket monitor behavior. Replace the hand-rolled argv parsing with `yargs`, keep one CLI entrypoint with subcommands, and write capture artifacts into timestamped session folders under `packages/meticulous-client/recordings/`.

**Tech Stack:** TypeScript, Node 24, `yargs`, existing `socket.io-client`, Vitest, repo-local JSON artifacts.

---

## Scope

This branch covers:

- replacing the current manual arg parsing with `yargs`
- turning the current monitor utility into a subcommand-based CLI
- keeping the existing live monitor behavior for quick inspection
- adding a `record` flow that saves raw and normalized brew data locally
- adding a `summarize` flow that reads a saved recording and prints a compact shape summary
- documenting how to run the CLI manually from the workspace

This branch does **not** cover:

- live chart UI work
- replaying a recording into the app
- automatic brew start/stop detection
- protocol modeling beyond light normalization needed for saved artifacts

---

## Expected Files

### Existing files to modify

- `packages/meticulous-client/package.json`
  - add `yargs`
  - rename or replace the current utility script entry with a socket CLI entry
- `packages/meticulous-client/README.md`
  - document the manual CLI capture workflow
- `packages/meticulous-client/utils/socket-monitor.ts`
  - replace with a `yargs`-driven CLI entrypoint, or reduce it to a thin entrypoint if helpers are split out

### New files likely needed

- `packages/meticulous-client/utils/socket-recording.ts`
  - recording folder creation, raw log persistence, normalized artifact writing
- `packages/meticulous-client/utils/socket-summary.ts`
  - summary printing for saved recordings
- `packages/meticulous-client/utils/socket-monitor.test.ts`
  - unit coverage for CLI parsing and artifact behavior if that is the cleanest place for it

### Runtime output location

- `packages/meticulous-client/recordings/<timestamp>-<label>/`
  - `raw-events.jsonl`
  - `normalized-timeline.json`
  - `chart-series.json`
  - optional small metadata file if useful

---

## Task 1: Convert The Utility Into A Small CLI

- [x] Re-read the current `packages/meticulous-client/utils/socket-monitor.ts` and `package.json` script wiring before editing.
- [x] Replace the current hand-rolled parser with `yargs`.
- [x] Keep the CLI shape minimal:
  - `monitor <baseUrl>`
  - `record <baseUrl>`
  - `summarize <recordingPath>`
- [x] Preserve the current `--samples` and `--depth` controls where they still make sense.
- [x] Add only the flags needed for the first capture slice:
  - `--out`
  - `--label`
  - `--samples`
  - `--depth`
- [x] Keep the default output root under `packages/meticulous-client/recordings/`.
- [x] Avoid a large command framework or extra abstraction layer.

**Exit criteria**

- the CLI can be run manually through a single package script
- argument parsing is handled by `yargs`, not custom code
- the command surface is small and obvious

---

## Task 2: Keep Monitor As The Pipeable Live View

- [x] Preserve the current monitor behavior as the quick interactive command.
- [x] Switch live monitor output to structured JSON logs through `pino`.
- [x] Make quit explicit with `q`.
- [x] Make sure the monitor command and the record command share the same base URL normalization behavior.
- [x] Decided not to keep the old end-of-session human summary.
  - Reason: `record` plus `summarize` supersede it, and it breaks `jq` pipelines.

**Exit criteria**

- `monitor` is still the easiest way to watch a live session in the terminal
- the output stays machine-readable all the way through

---

## Task 3: Add Recording Output For Manual Brew Sessions

- [x] Add a `record` command that connects to the machine and keeps capturing until manual quit.
- [x] On start, create a timestamped output directory under `packages/meticulous-client/recordings/` unless `--out` overrides it.
- [x] Save the raw socket stream as newline-delimited JSON so each event stays inspectable independently.
- [x] Include socket state transitions in the raw recording so connection issues are visible later.
- [x] Save a normalized event timeline file with one entry per received event and stable fields such as:
  - receive timestamp
  - event name
  - raw payload
  - derived machine/profile time fields only when confidently present
- [x] Save a separate chart-first normalized file that flattens confirmed time-series values for later UI work.
- [x] Do not guess missing values. Leave fields absent when they are not confirmed by the payload.
- [x] Print the output directory when recording starts and again when it ends.

**Exit criteria**

- you can run `record` yourself and stop it manually
- the command writes raw and both normalized outputs into one session folder
- saved data is honest to the observed payload shape

---

## Task 4: Add Offline Summary For Saved Recordings

- [x] Add a `summarize` command that reads a saved recording path rather than connecting live.
- [x] Keep summarize path resolution tolerant of invocation cwd so repo-root-relative paths keep working.
- [x] Print a compact report that is useful before deeper manual inspection:
  - event counts
  - first/last timestamps
  - distinct event names
- [ ] Decided not to include representative payload shapes in the first summary output.
  - Reason: the saved raw and normalized artifacts already preserve them, and the compact summary should stay terse.

**Exit criteria**

- a saved recording can be inspected later without rerunning the machine
- the summary is compact enough to use as the default first read

---

## Task 5: Tests And Docs

- [x] Add focused unit coverage around:
  - `yargs` command parsing
  - base URL normalization
  - recording directory naming and artifact writing
  - summary reading for a small fixture recording
- [x] Keep tests local to the utility code rather than creating a broad new test harness.
- [x] Update `packages/meticulous-client/README.md` with:
  - the new socket CLI script
  - the `monitor`, `record`, and `summarize` commands
  - the default recordings location
  - the expectation that you run `record` manually and then hand the saved files back for analysis

**Exit criteria**

- the CLI behavior is covered by small local tests
- the manual workflow is documented in one obvious place

---

## Verification Checklist

- [x] `yarn workspace @shotlab/meticulous-client test`
- [x] `yarn workspace @shotlab/meticulous-client build`
- [ ] Decided not to treat CLI help text as a release gate for this slice.
  - Reason: the command tests and runtime smoke checks matter more than the generated help surface right now.
- [x] run a non-live smoke check for `summarize` against a small saved fixture or generated sample

---

## Follow-Up For The Next Branch Slice

- [x] Export dedicated live socket payload types separately from REST/history types.
  - Reason: the live event wire format uses distinct names and value shapes, so only the genuinely shared setpoint fields are reused through a small base type.

After this branch, the next step can consume the saved brew recordings to:

- inspect the real brew-time telemetry/event shape
- decide which normalized fields are stable enough for the live chart
- update the dashboard to render the live stream honestly

That UI step stays separate on purpose so the capture format is driven by real observed data first.

---

## Task 6: Terminal Console

This task was originally planned as a follow-up branch slice. Decision change: keep it in the same branch and add it as a separate `console` surface instead of replacing `monitor`.

Changed direction:

- [x] Decided not to replace `monitor` with the TUI.
  - Reason: `monitor` needs to stay pipeable for `jq`/`pino-pretty`.
- [ ] Add a separate `console <baseUrl>` command for the TUI.
- [x] Add a separate `console <baseUrl>` command for the TUI.
- [x] Build the TUI on `terminal-kit`.

Planned layout:

- top left: summary/status panel
- top right: scrolling live stream panel
- bottom: command entry and help/output panel

Planned interaction model:

- hotkeys for frequent actions
- typed commands for the full surface

- [x] Implement the first TUI command targets:

- `help`
- `clear`
- `pause`
- `resume`
- `reconnect`
- `disconnect`
- `record start [label]`
- `record stop`
- `quit`

- [x] Add machine action commands that exist in the first TUI slice but remain explicit stubs:

- `tare`
- `preheat`
- `raise`
- `purge`
- `stop`

Stub behavior:

- help output lists them
- invoking them prints `not yet implemented`
- no machine-side action is sent yet

Current status:

- [x] 3-panel console shell exists
- [x] `help` output includes the stub action commands
- [x] hotkeys exist for `q`, `h`, `c`, `p`, `r`, and `:`
- [x] typed commands execute for observer/record/reconnect flow
- [x] Decided not to keep help confined to the bottom panel.
  - Reason: the help text overflows the command panel and is not readable there.
- [x] Add a fullscreen help overlay that exits with `Esc` or `q`.
- [x] Reduce flicker during live updates.
- [x] Decided not to keep stream-row selection in this branch.
  - Reason: in the live sensor flow the rows move too quickly for the current up/down cursor model to be useful or understandable.
- [x] Decided not to keep selected-row detail in the bottom panel in this branch.
  - Reason: the panel height clips the payload, and the current selection model does not provide a stable inspection workflow.
- [x] Improve event row readability with concise formatting and visual emphasis instead of only raw JSON lines.
- [x] Re-check the web UI socket event model before tightening stream row formatting.
  - Current explicit UI-handled events: `status`, `sensors`, `settings`, `profile`, and `heater_status`.
  - Other observed/discovered events still relevant to console readability: `button` and `profileHover`.
- [x] Use a fixed-width event-name column in stream rows so the metric columns align across known event names.
- [x] Use fixed-width metric fields and ANSI-aware truncation so colored rows stay aligned and panel borders remain stable.
