# ShotLab

> An open-source telemetry, control, and analytics platform for the Meticulous Espresso Machine.

ShotLab is a self-hostable platform for interacting with the Meticulous Espresso Machine.

Unlike the official application, ShotLab is intended to be an extensible platform for developers,
enthusiasts, and researchers who want deeper visibility into their espresso machine and extraction data.

Current goals include:

- Browser-based dashboard
- Live machine telemetry
- Machine control
- Profile management
- Historical shot storage
- Shot replay and comparison
- Data analytics
- Experimentation with AI/ML-assisted profile generation

## Project Status

🚧 Early development

The first milestone is reverse engineering and documenting the Meticulous REST and Socket.IO protocols.

## Features (Planned)

### Machine

- Machine status
- Live telemetry
- Start / Stop / Preheat
- Tare scale
- Firmware information

### Profiles

- Browse profiles
- Load profiles
- Duplicate profiles
- Edit profiles
- Import / Export

### History

- Store every shot locally
- Replay telemetry
- Compare extractions
- Export data

### Analytics

- Compare beans
- Compare grinders
- Compare profiles
- Long-term statistics
- Extraction consistency

### Integrations

- MCP
- Home Assistant
- Prometheus
- MQTT

## Architecture

ShotLab consists of several components:

```text
Browser UI
        │
        ▼
ShotLab API
        │
        ├── Database
        ├── Analytics
        └── Meticulous Client
                │
                ▼
      REST + Socket.IO
                │
                ▼
     Meticulous Espresso Machine
```

The communication layer is isolated into a reusable client library so the protocol implementation remains
independent of the web application.

## Repository Layout

```text
apps/
    api/
    web/

packages/
    meticulous-client/
    types/
    ui/

services/
    analytics/
    collector/
    mcp/

docs/
    architecture.md
    protocol.md
    ROADMAP.md
```

## Technology

| Area       | Choice     |
| ---------- | ---------- |
| Language   | TypeScript |
| Frontend   | React      |
| Build      | Vite       |
| UI         | MUI        |
| State      | Zustand    |
| Validation | Zod        |
| Charts     | Recharts   |
| Realtime   | Socket.IO  |
| REST       | Fetch API  |

## Documentation

| Document               | Description                              |
| ---------------------- | ---------------------------------------- |
| `docs/architecture.md` | System architecture and design decisions |
| `docs/protocol.md`     | Reverse engineered Meticulous protocol   |
| `docs/ROADMAP.md`      | Planned milestones                       |

## Contributing

Contributions are welcome.

The project is still in the protocol discovery stage, so documentation, testing, and reverse engineering are all
valuable contributions.

## License

TBD
