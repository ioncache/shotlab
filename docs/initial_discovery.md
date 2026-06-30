# ShotLab

> An open-source telemetry, control, and analytics platform for the Meticulous Espresso Machine.

---

## Vision

ShotLab is a self-hostable platform for interacting with a Meticulous Espresso Machine.

While the initial milestone is a polished browser-based dashboard, the long-term vision is much larger.

ShotLab should become a platform for:

- Machine control
- Live telemetry
- Historical shot storage
- Shot comparison
- Profile management
- Data analytics
- Experimentation
- AI / ML research
- Community tooling

Rather than replacing the official application, ShotLab embraces the openness of the Meticulous platform and builds
a richer ecosystem around it.

---

## Project Goals

### Project Goal Phase 1

A polished desktop web application capable of:

- Viewing machine status
- Viewing live telemetry
- Loading profiles
- Managing profiles
- Starting/stopping/preheating
- Viewing previous shots

---

### Project Goal Phase 2

Persistent data collection.

Every shot should be stored locally.

Not just:

- profile
- shot time

But all telemetry available from the machine.

This enables:

- comparisons
- statistics
- trend analysis
- long-term tracking

---

### Project Goal Phase 3

Analytics.

Examples:

- Compare two shots
- Compare beans
- Compare grinders
- Compare burr sets
- Compare profile versions
- Pressure analysis
- Flow analysis
- Temperature analysis
- Extraction consistency

---

### Project Goal Phase 4

Research.

Potential future directions:

- Machine learning
- Profile optimization
- AI-assisted profile generation
- MCP integration
- Home Assistant integration
- Prometheus exporter
- MQTT bridge

---

## Principles

- Open source
- Local-first
- Self-hostable
- Type-safe
- Extensible
- Well documented
- Modern TypeScript

---

## Technology

### Frontend

- React
- TypeScript
- Vite
- MUI

Reasoning:

MUI provides polished, production-quality components that allow development to focus on functionality rather than
visual design.

---

### Backend

Node.js

Responsibilities:

- Database
- Historical storage
- Analytics
- Future integrations
- Authentication (if ever required)

---

### Communication

REST

- native fetch

Realtime

- socket.io-client

---

### State

Zustand

The machine is fundamentally event-driven.

Most application state originates from Socket.IO rather than REST requests.

---

### Validation

Zod

---

### Charts

Recharts

---

### Database

Initially undecided.

Candidates:

- SQLite
- PostgreSQL

The abstraction should allow either.

---

## High-Level Architecture

```text
                        Browser

                 React + MUI

                        │

                ShotLab API

                        │

                 Local Database

                        │

              Analytics / Services

                        │

        Meticulous REST + Socket.IO
```

The backend is responsible for persistence.

The frontend should not become responsible for historical storage or analytics.

---

## Repository Layout

```text
shotlab/

apps/

    web/

    api/

packages/

    meticulous-client/

    ui/

    types/

services/

    collector/

    analytics/

    mcp/

docs/

    protocol/

experiments/

scripts/
```

---

## Core Components

### Web

User interface.

Responsible for:

- Dashboard
- Graphs
- Profiles
- History
- Settings

---

### API

Coordinates:

- Machine communication
- Database
- Analytics
- Historical storage

Provides a stable API to the frontend.

---

### meticulous-client

A reusable TypeScript client implementing the Meticulous protocol.

Responsibilities:

- REST
- Socket.IO
- Protocol models
- Reconnection
- Event parsing

Although currently only supporting Meticulous, separating this package keeps the protocol isolated from the
application.

---

### Collector

Responsible for recording every shot.

Potential responsibilities:

- Sensor recording
- Event recording
- Compression
- Archiving

---

### Core Analytics

Long-term data processing.

Examples:

- Compare shots
- Compute averages
- Detect trends
- Bean statistics
- Grinder statistics

---

### MCP

Experimental.

Potential uses:

- AI profile generation
- Prompting against historical shots
- Tool integrations

---

## Confirmed Machine Information

Server

```text
TornadoServer/6.5.5
```

Firmware

```text
0.2.24-369-gd28e82a
```

Backend

```text
stable
63a76b2
```

Confirmed capabilities:

- REST API
- Socket.IO
- Engine.IO v4
- WebSocket upgrade
- Permissive CORS

No authentication has been observed.

---

## Confirmed Endpoints

Machine

```http
GET /api/v1/machine
```

Returns:

- firmware
- versions
- repository information
- build metadata
- machine identity

---

Tare

```http
POST /api/v1/action/tare
```

Confirmed operational.

---

Socket.IO

```text
/socket.io/
```

Handshake:

```text
/socket.io/?EIO=4&transport=polling
```

Returns:

- Engine.IO v4
- WebSocket upgrade

---

## Suspected Endpoints

Actions

```text
POST /api/v1/action/start
POST /api/v1/action/stop
POST /api/v1/action/preheat
POST /api/v1/action/tare
```

Profiles

```text
GET /api/v1/profile/list
GET /api/v1/profile/list?full=true
GET /api/v1/profile/get/:id

POST /api/v1/profile/load
POST /api/v1/profile/save

GET /api/v1/profile/last
```

History

```text
GET /api/v1/history
GET /api/v1/history/current
GET /api/v1/history/last
```

Settings

```text
GET /api/v1/settings
POST /api/v1/settings
```

---

## Reverse Engineering

### REST

For every endpoint document:

- URL
- Verb
- Request
- Response
- Errors

Generate an OpenAPI specification.

---

### Socket.IO

Record every emitted event.

For every event document:

- Name
- Payload
- Frequency
- Direction
- Related machine state

Generate TypeScript interfaces.

---

## UI

### Dashboard

Displays:

- Connection status
- Machine status
- Current profile
- Pressure
- Flow
- Temperature
- Weight
- Shot timer

Controls:

- Tare
- Preheat
- Start
- Stop

---

### Profiles

- Browse
- Load
- Duplicate
- Edit (future)

---

### History

- Previous shots
- Graph replay
- Export

---

### Analytics UI

Future pages:

- Compare shots
- Compare profiles
- Bean statistics
- Grinder statistics
- Trends

---

## Long-Term Ideas

- Firmware browser
- Profile diff viewer
- Automatic profile backups
- Bean inventory
- Roast tracking
- Grinder tracking
- Maintenance reminders
- Shot annotations
- Multi-machine support
- Team mode
- Remote access
- Cloud sync (optional)
- Home Assistant
- Prometheus
- Grafana dashboards

---

## Development Roadmap

### Roadmap Phase 1

- Reverse engineer REST API
- Reverse engineer Socket.IO
- Document protocol
- Create meticulous-client package

---

### Roadmap Phase 2

- Dashboard
- Live telemetry
- Machine controls
- Profile browser

---

### Roadmap Phase 3

- Historical storage
- Database
- Shot replay
- Graphs

---

### Roadmap Phase 4

- Analytics
- Comparisons
- Statistics

---

### Roadmap Phase 5

- AI / ML experiments
- MCP
- Recommendation engine
- Automatic profile tuning

---

## Open Questions

- Can multiple clients connect simultaneously?
- Can historical telemetry be streamed?
- Are there undocumented namespaces?
- Are there engineering endpoints?
- Is calibration exposed?
- Can firmware be updated through the API?
- Can profiles be edited while active?
- Is there profile versioning?
- Are there hidden debugging APIs?

---

## Philosophy

ShotLab is intended to be more than a replacement UI.

The goal is to become the definitive open-source toolkit for exploring, understanding, and improving espresso
extraction on the Meticulous platform.

Every shot is an experiment.

ShotLab is the laboratory.
