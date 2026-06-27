# ShotLab Roadmap

## Guiding Principles

The roadmap is intentionally outcome-focused rather than date-focused.

The priority is to build a solid protocol implementation before expanding features.

---

## Phase 1 — Protocol Discovery

### Phase 1 Goals

- Reverse engineer the REST API
- Reverse engineer Socket.IO
- Identify all endpoints
- Document payloads
- Document events
- Create TypeScript models
- Build the `meticulous-client` package

### Phase 1 Success Criteria

- Complete protocol documentation
- Stable client library
- Basic communication with the machine

---

## Phase 2 — Web Dashboard

### Phase 2 Goals

- Dashboard
- Connection status
- Live telemetry
- Machine controls
- Profile browser
- Settings viewer

### Phase 2 Success Criteria

The web UI can replace the official application for common daily use.

---

## Phase 3 — Historical Storage

### Phase 3 Goals

- Database
- Automatic shot recording
- Telemetry archival
- Historical browsing
- Export

### Phase 3 Success Criteria

Every shot is automatically recorded and viewable.

---

## Phase 4 — Analytics

### Phase 4 Goals

- Compare shots
- Compare profiles
- Bean statistics
- Grinder statistics
- Trend analysis
- Visualizations

### Phase 4 Success Criteria

Users can meaningfully analyze extraction history.

---

## Phase 5 — Experimentation

### Phase 5 Goals

- MCP integration
- ML experiments
- AI-assisted profile generation
- Recommendation engine
- Profile optimization

### Phase 5 Success Criteria

ShotLab becomes a platform for experimentation rather than only a dashboard.

---

## Stretch Goals

- Home Assistant integration
- Prometheus exporter
- MQTT bridge
- Multi-machine support
- Remote access
- Plugin system
- Mobile PWA
- Cloud synchronization

---

## Technical Debt

Track architectural improvements separately from new features.

Potential areas include:

- Performance
- Test coverage
- Documentation
- Protocol compatibility
- Backwards compatibility

---

## Deferred Decisions

The following are intentionally deferred until justified:

- Database selection (SQLite vs PostgreSQL)
- Authentication model
- Multi-user support
- Cloud services
- Plugin API
- Public SDK publishing

Avoid solving these problems prematurely.
