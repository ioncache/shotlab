# Web Dashboard REST Shell Implementation Plan

**Goal:** Build the first ShotLab web UI slice as a local-first, REST-only dashboard that talks directly to the machine, shows the selected-shot chart/history workflow, and exposes only safe machine actions in this step.

**Architecture:** Scaffold `apps/web` as a Vite + React application that imports `@shotlab/meticulous-client` directly. Keep raw machine payload handling in one browser-side adapter layer so the UI depends on a narrow dashboard view model rather than loose protocol JSON. Treat unconfirmed actions and unmapped fields as unavailable states instead of inventing behavior. If direct browser-to-machine requests fail because of CORS or mixed-content rules, stop this plan and write a thin-proxy follow-up instead of widening this branch.

**Tech Stack:** React, ReactDOM, Vite, TypeScript, MUI, `@mui/x-charts`, `@shotlab/meticulous-client`, Vitest, browser storage APIs.

---

## File Structure

- Create: `apps/web/package.json`
  Defines the web workspace scripts and the approved frontend dependencies for this slice.
- Create: `apps/web/tsconfig.json`
  App-local TypeScript config for the Vite frontend.
- Create: `apps/web/vite.config.ts`
  Vite config for the web workspace.
- Create: `apps/web/index.html`
  Browser entry HTML for the Vite app.
- Create: `apps/web/public/manifest.webmanifest`
  Minimal install metadata for the local-network PWA shell.
- Create: `apps/web/public/icon.svg`
  Temporary install/icon asset for the PWA shell.
- Create: `apps/web/public/sw.js`
  Minimal service worker for installability without pulling in a PWA plugin.
- Create: `apps/web/src/main.tsx`
  App bootstrap and MUI theme wiring.
- Create: `apps/web/src/app.tsx`
  Top-level app shell that switches between the connection screen and the dashboard screen.
- Create: `apps/web/src/theme.ts`
  The MUI theme for the soft-instrument visual direction.
- Create: `apps/web/src/lib/connection-storage.ts`
  Persists and restores the last machine base URL from local storage.
- Create: `apps/web/src/lib/dashboard-types.ts`
  Narrow app-facing types for dashboard cards, chart series, history rows, and action states.
- Create: `apps/web/src/lib/dashboard-selectors.ts`
  Best-effort parsing from loose Meticulous REST payloads into dashboard view models.
- Create: `apps/web/src/lib/dashboard-selectors.test.ts`
  Unit coverage for the payload-to-view-model mapping logic.
- Create: `apps/web/src/lib/create-dashboard-client.ts`
  Browser-side wrapper around `createMeticulousClient`.
- Create: `apps/web/src/lib/load-dashboard-snapshot.ts`
  Loads and normalizes the REST snapshot needed by the dashboard.
- Create: `apps/web/src/lib/load-dashboard-snapshot.test.ts`
  Unit coverage for the REST snapshot loader orchestration.
- Create: `apps/web/src/context/dashboard-context.tsx`
  Manages connection state, selected shot state, polling, and safe action execution with React context instead of an external state library.
- Create: `apps/web/src/components/connection-bar.tsx`
  Local-network machine URL input, connect button, refresh button, and error banner.
- Create: `apps/web/src/components/action-panel.tsx`
  Safe action controls for this slice.
- Create: `apps/web/src/components/live-info-strip.tsx`
  Temperature, status, weight, profile, and related info cards.
- Create: `apps/web/src/components/primary-chart-card.tsx`
  The main chart surface that shows the selected historical shot now and live data later.
- Create: `apps/web/src/components/shot-inspector.tsx`
  Selected-shot metadata plus previous/next navigation.
- Create: `apps/web/src/components/history-table.tsx`
  Desktop history browser that loads a row into the primary chart.
- Create: `apps/web/src/components/mobile-history-drawer.tsx`
  Mobile bottom drawer for browsing history while keeping the chart visible.
- Create: `apps/web/src/components/dashboard-page.tsx`
  Responsive page composition for the dashboard.
- Create: `apps/web/src/test/setup.ts`
  Frontend test setup if React rendering tests are approved for this slice.
- Modify: `apps/web/README.md`
  Documents how to run the app, connect to a machine, and what this slice does not do.
- Modify: `docs/ROADMAP.md`
  Inserts this UI slice before Socket.IO discovery.
- Modify: `docs/architecture.md`
  Notes the temporary browser-direct phase before the API exists.
- Modify: `docs/protocol.md`
  Only if `raise` and `purge` are confirmed during this branch.
- Modify: `packages/meticulous-client/src/index.ts`
  Only if `raise` and `purge` are confirmed and promoted to action constants.
- Modify: `packages/meticulous-client/src/index.test.ts`
  Unit coverage for any new action constants.
- Modify: `packages/meticulous-client/integration/write.integration.test.ts`
  Optional guarded real-machine confirmation for `raise` and `purge`.

---

### Task 1: Lock The Frontend Workspace And Prove Browser Access

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app.tsx`
- Create: `apps/web/src/components/connection-bar.tsx`

- [ ] **Step 1: Get explicit approval for the frontend package set before editing manifests**

Present this package list to the user before installing anything:

```text
runtime:
- react
- react-dom
- @mui/material
- @mui/icons-material
- @emotion/react
- @emotion/styled
- @mui/x-charts

dev:
- vite
- @vitejs/plugin-react
- jsdom
- @testing-library/react
- @testing-library/jest-dom
```

Reasoning to present:

- React + ReactDOM + Vite are the app shell already implied by the repo architecture.
- MUI + Emotion are required for the chosen component system.
- MUI X Charts keeps the chart surface visually aligned with the MUI design language.
- Testing Library + jsdom are the smallest standard additions for frontend render tests if we want real TDD on components.

- [ ] **Step 2: Create the web workspace manifest and scripts**

```json
{
  "name": "@shotlab/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite --host 0.0.0.0",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "lint": "oxlint -f default",
    "lint:ci": "oxlint -f github",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Add the minimal Vite + React app shell**

```ts
// apps/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { App } from './app';
import { theme } from './theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
```

```ts
// apps/web/src/app.tsx
import { useState } from 'react';
import { ConnectionBar } from './components/connection-bar';

export function App() {
  const [baseUrl, setBaseUrl] = useState<string>('');

  return (
    <main>
      <ConnectionBar
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
      />
    </main>
  );
}
```

- [ ] **Step 4: Run the workspace install**

Run:

```bash
yarn install
```

Expected:

```text
Done in <n>s
```

- [ ] **Step 5: Start the app and prove the browser shell loads**

Run:

```bash
yarn workspace @shotlab/web dev
```

Expected:

```text
VITE v<version>  ready in <n> ms
Local:   http://localhost:5173/
Network: http://<host>:5173/
```

- [ ] **Step 6: Add a one-button `getMachine()` probe and test direct browser access before building the dashboard**

```ts
// inside ConnectionBar submit handler
const client = createMeticulousClient({ baseUrl });
await client.getMachine();
```

Success condition:

- the browser can fetch `GET /machine` from the machine origin and render success

Failure condition:

- browser shows CORS or mixed-content failure

If the failure condition happens, stop this plan and write a new thin-proxy follow-up plan instead of continuing the branch.

---

### Task 2: Build The Browser-Side Dashboard Data Layer

**Files:**

- Create: `apps/web/src/lib/connection-storage.ts`
- Create: `apps/web/src/lib/dashboard-types.ts`
- Create: `apps/web/src/lib/dashboard-selectors.ts`
- Create: `apps/web/src/lib/dashboard-selectors.test.ts`
- Create: `apps/web/src/lib/create-dashboard-client.ts`
- Create: `apps/web/src/lib/load-dashboard-snapshot.ts`
- Create: `apps/web/src/lib/load-dashboard-snapshot.test.ts`

- [ ] **Step 1: Write failing tests for selector fallbacks before parsing real payloads**

```ts
import { describe, expect, it } from 'vitest';
import { selectLiveInfo } from './dashboard-selectors';

describe('selectLiveInfo', () => {
  it('returns fallback labels when fields are missing', () => {
    expect(selectLiveInfo({}, {}, {})).toEqual({
      loadedProfileLabel: 'Unavailable',
      machineStatusLabel: 'Unknown',
      preheatLabel: 'Unknown',
      tareLabel: 'Unknown',
      temperatureLabel: 'Unavailable',
      weightLabel: 'Unavailable',
    });
  });
});
```

- [ ] **Step 2: Implement one narrow app-facing dashboard model**

```ts
export interface LiveInfoCardValue {
  label: string;
  tone: 'default' | 'good' | 'warn';
}

export interface DashboardSnapshot {
  historyRows: Array<Record<string, unknown>>;
  liveInfo: {
    loadedProfile: LiveInfoCardValue;
    machineStatus: LiveInfoCardValue;
    preheat: LiveInfoCardValue;
    tare: LiveInfoCardValue;
    temperature: LiveInfoCardValue;
    weight: LiveInfoCardValue;
  };
  selectedShotChart: {
    points: Array<{ x: number; y: number }>;
    title: string;
  };
  selectedShotSummary: {
    id?: string;
    profileName?: string;
    recordedAt?: string;
  };
}
```

- [ ] **Step 3: Keep all loose protocol parsing in selectors, not in UI components**

```ts
export function selectLiveInfo(
  machine: Record<string, unknown>,
  currentHistory: Record<string, unknown>,
  lastProfile: Record<string, unknown>,
) {
  return {
    loadedProfile: {
      label: pickString(lastProfile, ['name', 'title', 'id']) ?? 'Unavailable',
      tone: 'default' as const,
    },
    machineStatus: {
      label: pickString(currentHistory, ['status', 'state', 'phase']) ?? 'Unknown',
      tone: 'default' as const,
    },
    preheat: {
      label: pickBooleanLabel(machine, ['preheat', 'auto_preheat', 'is_preheated']),
      tone: 'default' as const,
    },
    tare: {
      label: pickBooleanLabel(currentHistory, ['tare', 'is_tared']),
      tone: 'default' as const,
    },
    temperature: {
      label: pickNumberLabel(currentHistory, ['temperature', 'temp', 'water_temp']),
      tone: 'default' as const,
    },
    weight: {
      label: pickNumberLabel(currentHistory, ['weight', 'mass', 'current_weight']),
      tone: 'default' as const,
    },
  };
}
```

- [ ] **Step 4: Orchestrate one snapshot load around the confirmed REST client methods**

```ts
export async function loadDashboardSnapshot(baseUrl: string) {
  const client = createDashboardClient(baseUrl);
  const [machine, currentHistory, history, lastProfile, settings] =
    await Promise.all([
      client.getMachine(),
      client.getCurrentHistory(),
      client.getHistory(),
      client.getLastProfile(),
      client.getSettings(),
    ]);

  return buildDashboardSnapshot({
    currentHistory,
    history,
    lastProfile,
    machine,
    settings,
  });
}
```

- [ ] **Step 5: Verify the data layer with focused unit tests**

Run:

```bash
yarn workspace @shotlab/web test src/lib/dashboard-selectors.test.ts src/lib/load-dashboard-snapshot.test.ts
```

Expected:

```text
PASS  src/lib/dashboard-selectors.test.ts
PASS  src/lib/load-dashboard-snapshot.test.ts
```

---

### Task 3: Build The MUI Dashboard Shell

**Files:**

- Create: `apps/web/src/theme.ts`
- Create: `apps/web/src/components/action-panel.tsx`
- Create: `apps/web/src/components/live-info-strip.tsx`
- Create: `apps/web/src/components/primary-chart-card.tsx`
- Create: `apps/web/src/components/shot-inspector.tsx`
- Create: `apps/web/src/components/history-table.tsx`
- Create: `apps/web/src/components/mobile-history-drawer.tsx`
- Create: `apps/web/src/components/dashboard-page.tsx`
- Modify: `apps/web/src/app.tsx`

- [ ] **Step 1: Write a failing render test for the shell hierarchy**

```ts
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './dashboard-page';

it('renders the action panel, live info, chart, inspector, and history regions', () => {
  render(<DashboardPage snapshot={fakeSnapshot} />);

  expect(screen.getByText('Actions')).toBeInTheDocument();
  expect(screen.getByText('Live Info')).toBeInTheDocument();
  expect(screen.getByText('Shot History')).toBeInTheDocument();
});
```

- [ ] **Step 2: Define the soft-instrument MUI theme instead of custom CSS chrome**

```ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    background: {
      default: '#edf1f4',
      paper: '#f8fafb',
    },
    primary: {
      main: '#4f7a90',
    },
    secondary: {
      main: '#7e8f9a',
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
  },
});
```

- [ ] **Step 3: Implement the desktop-first responsive page composition**

```tsx
export function DashboardPage(props: DashboardPageProps) {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));

  return (
    <Stack spacing={2}>
      <LiveInfoStrip values={props.snapshot.liveInfo} />
      <Grid container spacing={2}>
        {!isMobile && (
          <Grid size={{ md: 3, xl: 2.5 }}>
            <ActionPanel {...props.actions} />
          </Grid>
        )}
        <Grid size={{ xs: 12, md: 9, xl: 9.5 }}>
          <Stack spacing={2}>
            <PrimaryChartCard chart={props.snapshot.selectedShotChart} />
            <ShotInspector {...props.snapshot.selectedShotSummary} />
            {!isMobile && (
              <HistoryTable
                rows={props.snapshot.historyRows}
                selectedId={props.selectedHistoryId}
                onSelect={props.onSelectHistory}
              />
            )}
          </Stack>
        </Grid>
      </Grid>
      {isMobile && (
        <MobileHistoryDrawer
          rows={props.snapshot.historyRows}
          selectedId={props.selectedHistoryId}
          onSelect={props.onSelectHistory}
        />
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Use one large chart surface even before live telemetry exists**

```tsx
export function PrimaryChartCard({ chart }: PrimaryChartCardProps) {
  return (
    <Card>
      <CardHeader title={chart.title} />
      <CardContent>
        <LineChart
          height={280}
          series={[{ data: chart.points.map((point) => point.y), label: chart.title }]}
          xAxis={[{ data: chart.points.map((point) => point.x), label: 'Time' }]}
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Keep the app shell split between connection and dashboard states**

```tsx
export function App() {
  const dashboard = useDashboard();

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <ConnectionBar {...dashboard.connection} />
      {dashboard.snapshot ? (
        <DashboardPage {...dashboard.pageProps} />
      ) : (
        <EmptyState />
      )}
    </Container>
  );
}
```

- [ ] **Step 6: Verify the shell rendering tests**

Run:

```bash
yarn workspace @shotlab/web test
```

Expected:

```text
PASS  src/components/dashboard-page.test.tsx
PASS  src/lib/dashboard-selectors.test.ts
PASS  src/lib/load-dashboard-snapshot.test.ts
```

---

### Task 4: Wire Safe Actions, Selection State, And The Action Availability Rules

**Files:**

- Create: `apps/web/src/context/dashboard-context.tsx`
- Modify: `apps/web/src/components/action-panel.tsx`
- Modify: `apps/web/src/components/history-table.tsx`
- Modify: `apps/web/src/components/mobile-history-drawer.tsx`
- Modify: `packages/meticulous-client/integration/write.integration.test.ts`
- Modify: `packages/meticulous-client/src/index.ts`
- Modify: `packages/meticulous-client/src/index.test.ts`
- Modify: `docs/protocol.md`

- [ ] **Step 1: Keep safe actions explicit and leave unconfirmed actions disabled by default**

```ts
const actionItems = [
  { key: 'tare', label: 'Tare', enabled: true },
  { key: 'preheat', label: 'Preheat', enabled: true },
  { key: 'raise', label: 'Raise', enabled: false },
  { key: 'purge', label: 'Purge', enabled: false },
] as const;
```

- [ ] **Step 2: Add a guarded real-machine confirmation pass for `raise` and `purge` before enabling them**

```ts
it('posts raise when the machine supports it', async () => {
  await expect(client.triggerAction('raise')).resolves.toEqual(expect.any(Object));
});

it('posts purge when the machine supports it', async () => {
  await expect(client.triggerAction('purge')).resolves.toEqual(expect.any(Object));
});
```

Run once against the real machine:

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
METICULOUS_ALLOW_WRITE_TESTS=1 \
yarn workspace @shotlab/meticulous-client test:integration:write
```

Decision rule:

- if `raise` or `purge` fails, keep that UI button disabled and document it as unconfirmed
- if both succeed, promote them into `METICULOUS_ACTIONS` and mark them confirmed in `docs/protocol.md`

- [ ] **Step 3: Implement the dashboard context with polling and selected-shot state**

```ts
export function DashboardProvider({ children }: PropsWithChildren) {
  const [baseUrl, setBaseUrl] = useConnectionStorage();
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | undefined>();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | undefined>();

  async function refresh() {
    if (!baseUrl) {
      return;
    }

    const next = await loadDashboardSnapshot(baseUrl);
    setSnapshot(next);
  }

  useEffect(() => {
    if (!baseUrl) {
      return;
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 10_000);

    return () => window.clearInterval(timer);
  }, [baseUrl]);

  const value = { baseUrl, refresh, selectedHistoryId, setBaseUrl, setSelectedHistoryId, snapshot };
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
```

- [ ] **Step 4: Run safe actions through the client and then refresh the snapshot**

```ts
async function runAction(name: string) {
  if (!baseUrl) {
    return;
  }

  const client = createDashboardClient(baseUrl);
  await client.triggerAction(name);
  await refresh();
}
```

- [ ] **Step 5: Keep the history browser driving the primary chart**

```ts
function onSelectHistory(id: string) {
  setSelectedHistoryId(id);
}
```

Selector rule:

- when `selectedHistoryId` is set, the primary chart and inspector use that history row
- otherwise they use the most recent available history row

- [ ] **Step 6: Verify the dashboard against the real machine in a browser**

Manual verification:

- connect to the machine by URL
- load machine info successfully
- render the live info strip without crashes even when some fields are unavailable
- show the primary chart with a selected historical shot
- allow previous/next history movement
- run `tare`
- run `preheat`
- show `raise` and `purge` as enabled only if they were confirmed earlier in the branch

---

### Task 5: Add The PWA Shell, Update Docs, And Reorder The Roadmap

**Files:**

- Create: `apps/web/public/manifest.webmanifest`
- Create: `apps/web/public/icon.svg`
- Create: `apps/web/public/sw.js`
- Modify: `apps/web/README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Add the minimal PWA shell with native platform files**

```json
{
  "name": "ShotLab",
  "short_name": "ShotLab",
  "display": "standalone",
  "background_color": "#edf1f4",
  "theme_color": "#4f7a90",
  "start_url": "/",
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
```

- [ ] **Step 2: Document the browser-direct limitations in the web README**

Required README points:

- how to run `yarn workspace @shotlab/web dev`
- how to connect to the machine by local URL
- this slice is REST-only
- Socket.IO is deferred
- brewing controls are deferred
- if direct browser access is blocked, the next step is a thin proxy, not more frontend workarounds

- [ ] **Step 3: Insert this step before Socket.IO discovery in the roadmap**

```md
- [ ] Web dashboard REST shell
  - Build the first browser dashboard directly on confirmed REST endpoints.
  - Show the unified chart/history workflow before live telemetry exists.
  - Keep the slice local-first and backend-free unless browser access is blocked.

- [ ] Socket.IO discovery
  - Reverse engineer the Socket.IO connection and event flow.
  - Capture event names, payloads, and connection behavior.
  - Add client support only for confirmed events.
```

- [ ] **Step 4: Update the architecture doc to reflect the temporary browser-direct phase**

Add one explicit note:

```md
Before `apps/api` exists, the first `apps/web` slice may talk directly to the machine over local-network REST for prototyping and protocol discovery. Once the API exists, the browser should stop owning machine communication directly.
```

- [ ] **Step 5: Run the verification commands**

Run:

```bash
yarn workspace @shotlab/web format:check
yarn workspace @shotlab/web lint
yarn workspace @shotlab/web test
yarn workspace @shotlab/web build
```

Expected:

```text
All matched files use the correct format.
Found 0 warnings and 0 errors.
PASS <web test files>
vite v<version> building for production...
✓ built in <n>s
```

---

## Explicit Non-Goals

- Do not add Socket.IO support in this branch.
- Do not add brewing controls or `start`.
- Do not add profile editing or profile loading from the UI.
- Do not add the API app or a permanent backend proxy in this branch.
- Do not add Zustand or any other external global state library in this branch.
- Do not promise `raise` or `purge` unless they are confirmed against the real machine in this branch.

---

## Self-Review

- Spec coverage: The plan covers the agreed layout, the MUI soft-instrument direction, the unified chart/history model, the mobile history drawer, the direct-browser machine connection, and the early-stop condition if that connection fails.
- Placeholder scan: No `TODO`, `TBD`, or “figure it out later” steps remain.
- Type consistency: The plan keeps the browser-facing types in a dedicated selector layer and uses the same `DashboardSnapshot` shape across the loader, hook, and UI tasks.
