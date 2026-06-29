# ShotLab Roadmap

## Guiding Principles

The roadmap is intentionally outcome-focused rather than date-focused.

The priority is to build a solid protocol implementation before expanding features.

---

## Phase 1 - Protocol Discovery

### Phase 1 Steps

Each step should be roughly one PR or one branch/worktree of work.

- [x] `meticulous-client` REST foundation
  - Confirm the REST endpoints we already know about.
  - Build the minimal `@shotlab/meticulous-client` package around `GET /machine` and `POST /action/tare`.
  - Add the first real machine smoke test and package docs.
- [x] REST endpoint expansion
  - Discover the remaining REST endpoints.
  - Add client methods only for confirmed endpoints.
  - Document request/response shapes as they become known.
- [ ] Socket.IO discovery
  - Reverse engineer the Socket.IO connection and event flow.
  - Capture event names, payloads, and connection behavior.
  - Add client support only for confirmed events.
- [ ] Protocol modeling
  - Turn confirmed payloads into TypeScript types and shared models.
  - Replace loose protocol shapes where the schema is now known.
  - Keep compatibility with the live machine behavior already discovered.
- [ ] Protocol stabilization
  - Tighten tests around the discovered surface.
  - Fill documentation gaps in the protocol notes and package README.
  - Verify the client is stable enough for day-to-day use.

### Phase 1 Success Criteria

- [ ] Complete protocol documentation
- [ ] Stable client library
- [ ] Basic communication with the machine

---

## Phase 2 - Web Dashboard

### Phase 2 Steps

Each step should be roughly one PR or one branch/worktree of work.

- [x] App shell and connection state
  - Build the dashboard shell.
  - Show connection status and basic machine identity.
- [ ] Live telemetry
  - Stream live machine state into the UI.
  - Render the main values needed for daily use.
- [ ] Machine controls
  - Add safe control surfaces for the confirmed actions.
  - Reuse the client package rather than duplicating protocol code.
- [ ] Profile browser
  - Browse stored profiles and related machine metadata.
- [ ] Settings viewer
  - Show the relevant machine and app settings needed for normal operation.

### Phase 2 Success Criteria

- [ ] The web UI can replace the official application for common daily use.

---

## Phase 3 - Historical Storage

### Phase 3 Steps

Each step should be roughly one PR or one branch/worktree of work.

- [ ] Storage foundation
  - Choose the first durable storage layer.
  - Add the schema or persistence primitives needed for history.
- [ ] Automatic shot recording
  - Capture shot events as they happen.
  - Store the minimum data needed to reconstruct history.
- [ ] Telemetry archival
  - Persist machine telemetry over time.
  - Keep the archival path separate from the live control path.
- [ ] Historical browsing
  - Add views for past shots and telemetry records.
- [ ] Export
  - Export historical data in a usable format.

### Phase 3 Success Criteria

- [ ] Every shot is automatically recorded and viewable.

---

## Phase 4 - Analytics

### Phase 4 Steps

Each step should be roughly one PR or one branch/worktree of work.

- [ ] Comparison views
  - Compare shots and profiles.
- [ ] Core statistics
  - Add bean and grinder statistics.
- [ ] Trend analysis
  - Compute and present longer-running trends.
- [ ] Visualizations
  - Add charts or other visual summaries for the tracked data.

### Phase 4 Success Criteria

- [ ] Users can meaningfully analyze extraction history.

---

## Phase 5 - Experimentation

### Phase 5 Steps

Each step should be roughly one PR or one branch/worktree of work.

- [ ] MCP integration
  - Expose the useful ShotLab surface through MCP.
- [ ] ML experiments
  - Add experimental model-assisted workflows behind clear boundaries.
- [ ] AI-assisted profile generation
  - Generate candidate profiles from existing data.
- [ ] Recommendation engine
  - Suggest improvements from the recorded data and generated profiles.
- [ ] Profile optimization
  - Close the loop by evaluating and refining profiles over time.

### Phase 5 Success Criteria

- [ ] ShotLab becomes a platform for experimentation rather than only a dashboard.

---

## Stretch Goals

- [ ] Home Assistant integration
- [ ] Prometheus exporter
- [ ] MQTT bridge
- [ ] Multi-machine support
- [ ] Remote access
- [ ] Plugin system
- [ ] Mobile PWA
- [ ] Cloud synchronization

---

## Technical Debt

Track architectural improvements separately from new features.

Potential areas include:

- [ ] Performance
- [ ] Test coverage
- [ ] Documentation
- [ ] Protocol compatibility
- [ ] Backwards compatibility

---

## Deferred Decisions

The following are intentionally deferred until justified:

- [ ] Database selection (SQLite vs PostgreSQL)
- [ ] Authentication model
- [ ] Multi-user support
- [ ] Cloud services
- [ ] Plugin API
- [ ] Public SDK publishing

Avoid solving these problems prematurely.
