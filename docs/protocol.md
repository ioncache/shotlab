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

Connection flow

```http
GET /socket.io/?EIO=4&transport=polling
```

Confirmed:

- Engine.IO v4
- Socket.IO v4
- successful connection on the default namespace
- polling first, then upgrade to WebSocket
- no caller-side `/socket.io/` path handling required when using `connectSocket`

---

## Event Discovery

Confirmed idle events observed on June 29, 2026:

- `profileHover`
- `button`
- `status`
- `sensors`

Current gaps:

- safe-action event bursts have not been sampled yet
- non-default namespaces have not been observed

---

## Event Catalogue

- `profileHover`
  - Direction: machine -> client
  - Payload: single object with `id`, `type`, and `from`; observed samples showed `type: "focus"` with `from: "backend"` and `from: "dial"`
  - Status: confirmed
- `button`
  - Direction: machine -> client
  - Payload: single object with `type` and `time_since_last_event`
  - Observed `type` values: `ENCODER_PRESSED`, `ENCODER_RELEASED`, `ENCODER_PUSH`
  - Status: confirmed
- `status`
  - Direction: machine -> client
  - Payload:
    single object with `name`, compact `sensors`, `setpoints`, `time`,
    `profile`, `profile_time`, `state`, and `id`
  - Status: confirmed
- `sensors`
  - Direction: machine -> client
  - Payload:
    single object with compact telemetry keys such as `t_ext_1`, `t_tube`,
    `p`, `m_pos`, `m_spd`, `bh_pwr`, and `w_stat`
  - Status: confirmed

---

## Payload Models

```ts
interface SocketStatusPayload {
  name: string;
  sensors: {
    p: number;
    f: number;
    w: number;
    t: number;
    g: number;
  };
  setpoints: {
    active: string | null;
  };
  time: number;
  profile: string;
  profile_time: number;
  state: string;
  extracting: boolean;
  loaded_profile?: string;
  id?: string;
}

interface SocketButtonPayload {
  type: string;
  time_since_last_event: number;
}

interface SocketSensorsPayload {
  t_ext_1: number;
  t_ext_2: number;
  t_bar_up: number;
  t_bar_mu: number;
  t_bar_md: number;
  t_bar_down: number;
  t_tube: number;
  t_motor_temp: number;
  lam_temp: number;
  p: number;
  a_0: number;
  a_1: number;
  a_2: number;
  a_3: number;
  m_pos: number;
  m_spd: number;
  m_pwr: number;
  m_cur: number;
  bh_pwr: number;
  bh_cur: number;
  w_stat: boolean;
  motor_temp: string;
  weight_pred: number;
}
```

These are representative observed fields, not final exhaustive models.

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
