# ShotLab Architecture

## Overview

ShotLab is composed of a small number of independent components with clearly defined responsibilities.

The system is designed so that communication with the espresso machine is isolated from the web application,
allowing future clients (CLI, analytics services, MCP, etc.) to reuse the same protocol implementation.

## High-Level Architecture

```text
                   Browser

             React + MUI + Zustand

                     │
               HTTP / WebSocket

                     │

                ShotLab API

        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼

   Analytics     Database    Meticulous Client
                                   │
                          REST + Socket.IO
                                   │
                                   ▼
                       Meticulous Espresso Machine
```

## Components

### Web

Responsibilities:

- Dashboard
- Live telemetry
- Machine controls
- Profile management
- History browsing
- Data visualization

The frontend should remain relatively "thin". Business logic belongs in the backend.

---

### API

Responsibilities:

- Machine communication
- Persistence
- Analytics
- Authentication (if ever required)
- Stable API for the frontend

The API becomes the central coordinator of the system.

---

### Meticulous Client

A reusable TypeScript package implementing the Meticulous protocol.

Responsibilities:

- REST API
- Socket.IO
- Reconnection
- Event parsing
- Protocol models
- Error handling

This package should have no dependency on React or any database.

---

### Collector

Responsible for recording every shot and every telemetry event.

Potential responsibilities:

- Session detection
- Telemetry recording
- Compression
- Archival

---

### Analytics

Responsible for processing historical data.

Examples:

- Shot comparisons
- Statistical summaries
- Trend detection
- Profile evaluation
- Bean and grinder analysis

---

### MCP

Experimental integration layer.

Potential uses:

- AI-assisted profile generation
- Natural language querying
- Tool integrations

This remains completely optional and should not influence the core architecture.

## Design Principles

### Local First

The platform should function entirely on a local network.

Internet access should never be required.

---

### Type Safe

All communication should be validated using shared TypeScript types.

---

### Event Driven

The machine continuously streams state.

The application should react to events rather than polling wherever possible.

---

### Layered

```text
UI
↓

API

↓

Protocol Client

↓

Machine
```

Each layer should depend only on the layer beneath it.

## Future Architecture

Potential future additions:

- Multiple machine support
- Remote access
- User accounts
- Cloud synchronization
- Plugin architecture
- External integrations
- Distributed analytics

These should be additive and should not require redesigning the core architecture.
