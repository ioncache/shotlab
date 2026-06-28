# ShotLab Protocol Documentation

## Overview

This document tracks the reverse engineering effort for the Meticulous Espresso Machine.

The goal is to produce a complete protocol specification independent of the official applications.

---

## Machine Information

Example firmware:

| Property | Value               |
| -------- | ------------------- |
| Server   | Tornado 6.5.5       |
| Firmware | 0.2.24-369-gd28e82a |
| Backend  | stable (63a76b2)    |
| Image    | 2026M1284-stable    |

---

## REST API

Base URL

```text
http://<machine-ip>:8080/api/v1/
```

### Confirmed Endpoints

#### Machine

```http
GET /machine
```

Status:

- ✅ Confirmed

Returns:

- firmware
- build information
- repository versions
- machine identity

---

#### Suspected actions

```http
POST /action/preheat
POST /action/tare
```

Status:

- ✅ Confirmed

---

#### Suspected profiles

```http
GET /profile/list
GET /profile/list?full=true
GET /profile/get/:id
GET /profile/load/:id
GET /profile/last
```

---

#### History

```http
GET /history
GET /history/current
GET /history/last
```

---

#### Settings

```http
GET /settings
POST /settings
```

---

### Suspected Endpoints

#### Actions

```http
POST /action/start
POST /action/stop
```

---

#### Profiles

```http
POST /profile/save
```

---

## Socket.IO

Endpoint

```text
/socket.io/
```

Handshake

```http
GET /socket.io/?EIO=4&transport=polling
```

Confirmed:

- Engine.IO v4
- Socket.IO v4
- WebSocket upgrade supported

---

## Event Discovery

Current approach:

```ts
socket.onAny((event, payload) => {
  console.log(event, payload);
});
```

Record events while:

- Idle
- Heating
- Taring
- Loading profile
- Starting shot
- Pulling shot
- Stopping shot
- Completing shot

---

## Event Catalogue

| Event   | Direction | Payload | Status |
| ------- | --------- | ------- | ------ |
| _(TBD)_ |           |         |        |

---

## Payload Models

To be documented as reverse engineering progresses.

Example format:

```ts
interface MachineStatus {
  // TBD
}
```

---

## Open Questions

- Can multiple clients connect?
- Are there undocumented namespaces?
- Are engineering endpoints available?
- Are calibration APIs exposed?
- Can firmware updates be initiated?
- Can telemetry be replayed?

---

## Goals

- Complete REST documentation
- Complete Socket.IO documentation
- OpenAPI specification
- TypeScript models
- Example clients
