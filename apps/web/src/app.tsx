// npm imports
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useEffect, useRef, useState } from 'react';

// local imports
import {
  connectSocket,
  type HistoryResponse,
  type JsonObject,
  type LastProfileResponse,
  type MeticulousSocketEvent,
  type MeticulousSocketState,
  type Settings,
} from '@shotlab/meticulous-client';
import { readAppConfig } from './config';
import { createDashboardClient } from './lib/create-dashboard-client';
import { selectDashboardSnapshot } from './lib/dashboard-selectors';
import type { DashboardShot } from './lib/dashboard-types';
import {
  buildShotChartSummary,
  getShotChartSeries,
  getShotPointDetails,
  selectShotPointIndex,
} from './lib/shot-chart';

const DEBUG_DRAWER_STORAGE_KEY = 'shotlab.debugDrawerOpen';
const DEBUG_SOCKET_FLUSH_INTERVAL_MS = 250;
const MAX_DEBUG_EVENTS_PER_GROUP = 40;
const DEBUG_SOCKET_RATE_WINDOW_MS = 5000;

interface DebugSocketPacket {
  id: string;
  payload: unknown[];
  rawMachineTime?: string;
  receivedAt: string;
  receivedAtMs: number;
}

interface DebugSocketEventGroupSnapshot {
  event: string;
  latestPacket?: DebugSocketPacket;
  payloadPreview: string;
  recentPackets: DebugSocketPacket[];
  recentRatePerSecond: number;
  totalCount: number;
}

interface DebugSocketMutableGroup {
  event: string;
  latestPacket?: DebugSocketPacket;
  recentPackets: DebugSocketPacket[];
  recentReceivedAtMs: number[];
  totalCount: number;
}

interface DebugSocketSessionSnapshot {
  groups: DebugSocketEventGroupSnapshot[];
  totalEvents: number;
}

interface DebugSocketSessionStore {
  groups: Map<string, DebugSocketMutableGroup>;
  totalEvents: number;
}

interface LiveSocketState {
  lastProfile: LastProfileResponse;
  machine: JsonObject;
  settings: Settings;
}

interface DebugSocketGroupSelection {
  eventName?: string;
  packetId?: string;
}

interface DebugSocketPacketSummaryProps {
  isSelected: boolean;
  onClick: () => void;
  packet: DebugSocketPacket;
}

interface DebugSocketGroupCardProps {
  group: DebugSocketEventGroupSnapshot;
  isSelected: boolean;
  onClick: () => void;
}

interface DebugSocketPacketListProps {
  packets: DebugSocketPacket[];
  selectedPacketId?: string;
  onSelectPacket: (packetId: string) => void;
}

interface DebugPayloadPanelProps {
  eventName?: string;
  packet?: DebugSocketPacket;
}

interface DebugSectionHeadingProps {
  title: string;
  caption?: string;
}

interface EmptyDebugSocketStateProps {
  text: string;
}

interface DebugSocketSnapshot {
  error?: string;
  socketId?: string;
  status: 'connected' | 'connecting' | 'disabled' | 'disconnected' | 'error';
  transport?: string;
}

interface LoadState {
  history: boolean;
  lastProfile: boolean;
  machine: boolean;
  settings: boolean;
}

const emptyHistory: HistoryResponse = {};
const emptyObject: JsonObject = {};
const emptyLastProfile: LastProfileResponse = {};
const emptySettings: Settings = {};
const emptyDebugSocketSession: DebugSocketSessionSnapshot = {
  groups: [],
  totalEvents: 0,
};

function createLoadState(isLoading: boolean): LoadState {
  return {
    history: isLoading,
    lastProfile: isLoading,
    machine: isLoading,
    settings: isLoading,
  };
}

function isLiveCardLoading(label: string, loading: LoadState): boolean {
  switch (label) {
    case 'Temperature':
    case 'Machine status':
    case 'Weight':
      return loading.machine;
    case 'Last loaded profile':
      return loading.lastProfile;
    default:
      return false;
  }
}

function readLoadError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatCountdownLabel(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function App() {
  const config = readAppConfig();
  const [machine, setMachine] = useState<JsonObject>(emptyObject);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [history, setHistory] = useState<HistoryResponse>(emptyHistory);
  const [lastProfile, setLastProfile] = useState<LastProfileResponse>(emptyLastProfile);
  const [preheatEndsAtMs, setPreheatEndsAtMs] = useState<number | null>(null);
  const [preheatNowMs, setPreheatNowMs] = useState(() => Date.now());
  const [isTarePending, setIsTarePending] = useState(false);
  const [tareError, setTareError] = useState<string | undefined>();
  const [isPreheatPending, setIsPreheatPending] = useState(false);
  const [preheatError, setPreheatError] = useState<string | undefined>();
  const [socketDebug, setSocketDebug] = useState<DebugSocketSnapshot>({
    status: config.meticulousBaseUrl ? 'disconnected' : 'disabled',
  });
  const [socketSession, setSocketSession] = useState<DebugSocketSessionSnapshot>(
    emptyDebugSocketSession,
  );
  const [loading, setLoading] = useState<LoadState>(() =>
    createLoadState(Boolean(config.meticulousBaseUrl)),
  );
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<string | undefined>();
  const machineRef = useRef<JsonObject>(emptyObject);
  const settingsRef = useRef<Settings>(emptySettings);
  const lastProfileRef = useRef<LastProfileResponse>(emptyLastProfile);
  const preheatEndsAtRef = useRef<number | null>(null);
  const sessionStoreRef = useRef<DebugSocketSessionStore>(createDebugSocketSessionStore());
  const hasPendingLiveStateRef = useRef(false);
  const hasPendingSocketEventsRef = useRef(false);

  useEffect(() => {
    if (!config.meticulousBaseUrl) {
      setLoading(createLoadState(false));
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();
    const client = createDashboardClient(
      config.meticulousBaseUrl,
      (input, init) => fetch(input, { ...init, signal: controller.signal }),
    );

    setMachine(emptyObject);
    setSettings(emptySettings);
    setHistory(emptyHistory);
    setLastProfile(emptyLastProfile);
    machineRef.current = emptyObject;
    settingsRef.current = emptySettings;
    lastProfileRef.current = emptyLastProfile;
    preheatEndsAtRef.current = null;
    setPreheatEndsAtMs(null);
    setLoadErrors([]);
    setSelectedShotId(undefined);
    setLoading(createLoadState(true));

    client
      .getMachine()
      .then((nextMachine) => {
        if (!isCancelled) {
          machineRef.current = nextMachine;
          setMachine(nextMachine);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setLoadErrors((current) => [
            ...current,
            `Machine: ${readLoadError(error, 'Failed to load machine data.')}`,
          ]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading((current) => ({ ...current, machine: false }));
        }
      });

    client
      .getSettings()
      .then((nextSettings) => {
        if (!isCancelled) {
          settingsRef.current = nextSettings;
          setSettings(nextSettings);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setLoadErrors((current) => [
            ...current,
            `Settings: ${readLoadError(error, 'Failed to load settings.')}`,
          ]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading((current) => ({ ...current, settings: false }));
        }
      });

    client
      .getHistory()
      .then((nextHistory) => {
        if (!isCancelled) {
          setHistory(nextHistory);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setLoadErrors((current) => [
            ...current,
            `History: ${readLoadError(error, 'Failed to load history.')}`,
          ]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading((current) => ({ ...current, history: false }));
        }
      });

    client
      .getLastProfile()
      .then((nextLastProfile) => {
        if (!isCancelled) {
          lastProfileRef.current = nextLastProfile;
          setLastProfile(nextLastProfile);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setLoadErrors((current) => [
            ...current,
            `Profile: ${readLoadError(error, 'Failed to load last profile.')}`,
          ]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading((current) => ({ ...current, lastProfile: false }));
        }
      });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [config.meticulousBaseUrl]);

  const isSocketBootstrapReady = Boolean(config.meticulousBaseUrl)
    && !loading.machine
    && !loading.settings
    && !loading.lastProfile;
  const preheatDurationMinutes = readNumberValue(settings.heating_timeout);

  useEffect(() => {
    if (!config.meticulousBaseUrl) {
      setSocketDebug({ status: 'disabled' });
      setSocketSession(emptyDebugSocketSession);
      sessionStoreRef.current = createDebugSocketSessionStore();
      hasPendingLiveStateRef.current = false;
      hasPendingSocketEventsRef.current = false;
      return;
    }

    if (!isSocketBootstrapReady) {
      setSocketDebug({ status: 'disconnected' });
      setSocketSession(emptyDebugSocketSession);
      sessionStoreRef.current = createDebugSocketSessionStore();
      hasPendingLiveStateRef.current = false;
      hasPendingSocketEventsRef.current = false;
      return;
    }

    let isCancelled = false;
    let connection: Awaited<ReturnType<typeof connectSocket>> | undefined;
    let eventCounter = 0;

    sessionStoreRef.current = createDebugSocketSessionStore();
    hasPendingLiveStateRef.current = false;
    hasPendingSocketEventsRef.current = false;
    setSocketDebug({ status: 'connecting' });
    setSocketSession(emptyDebugSocketSession);

    const flushLiveState = () => {
      if (isCancelled) {
        return;
      }

      if (hasPendingLiveStateRef.current) {
        hasPendingLiveStateRef.current = false;
        setMachine(machineRef.current);
        setSettings(settingsRef.current);
        setLastProfile(lastProfileRef.current);
      }

      if (hasPendingSocketEventsRef.current) {
        hasPendingSocketEventsRef.current = false;
        setSocketSession(buildDebugSocketSessionSnapshot(sessionStoreRef.current));
      }
    };

    const flushInterval = window.setInterval(
      flushLiveState,
      DEBUG_SOCKET_FLUSH_INTERVAL_MS,
    );

    const connectionPromise = connectSocket({
      baseUrl: config.meticulousBaseUrl,
      onAny: (event) => {
        if (isCancelled) {
          return;
        }

        const nextPacket = createDebugSocketPacket(event, eventCounter);
        eventCounter += 1;
        appendDebugSocketPacket(sessionStoreRef.current, event.event, nextPacket);
        hasPendingSocketEventsRef.current = true;

        if (event.event === 'heater_status') {
          const heaterStatus = readFirstNumber(event.payload);
          const machineState =
            readStringValue(machineRef.current.state) ??
            readStringValue(machineRef.current.current_state) ??
            readStringValue(machineRef.current.status) ??
            readStringValue(machineRef.current.name);
          const isBrewing = machineState === 'brewing';

          if (heaterStatus === 0) {
            const now = Date.now();
            preheatEndsAtRef.current = null;
            setPreheatNowMs(now);
            setPreheatEndsAtMs(null);
          } else if (
            heaterStatus !== undefined
            && heaterStatus > 0
            && !isBrewing
            && preheatDurationMinutes !== undefined
            && preheatEndsAtRef.current === null
          ) {
            const now = Date.now();
            preheatEndsAtRef.current = now + preheatDurationMinutes * 60_000;
            setPreheatNowMs(now);
            setPreheatEndsAtMs(preheatEndsAtRef.current);
          }
        }

        const patchedState = applyLiveSocketEvent({
          event,
          lastProfile: lastProfileRef.current,
          machine: machineRef.current,
          settings: settingsRef.current,
        });

        if (patchedState.machine !== machineRef.current) {
          machineRef.current = patchedState.machine;
          hasPendingLiveStateRef.current = true;
        }

        if (patchedState.settings !== settingsRef.current) {
          settingsRef.current = patchedState.settings;
          hasPendingLiveStateRef.current = true;
        }

        if (patchedState.lastProfile !== lastProfileRef.current) {
          lastProfileRef.current = patchedState.lastProfile;
          hasPendingLiveStateRef.current = true;
        }
      },
      onStateChange: (state) => {
        if (!isCancelled) {
          setSocketDebug(readDebugSocketSnapshot(state));
        }
      },
    });

    connectionPromise
      .then((nextConnection) => {
        if (isCancelled) {
          void nextConnection.close();
          return;
        }

        connection = nextConnection;
        setSocketDebug(readDebugSocketSnapshot(nextConnection.getState()));
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setSocketDebug({
            error: readLoadError(error, 'Failed to connect to the socket.'),
            status: 'error',
          });
        }
      });

    return () => {
      isCancelled = true;
      window.clearInterval(flushInterval);
      hasPendingLiveStateRef.current = false;
      hasPendingSocketEventsRef.current = false;

      if (connection) {
        void connection.close();
        return;
      }

      void connectionPromise
        .then((nextConnection) => nextConnection.close())
        .catch(() => undefined);
    };
  }, [config.meticulousBaseUrl, isSocketBootstrapReady, preheatDurationMinutes]);

  const snapshot = selectDashboardSnapshot(machine, settings, history, lastProfile);
  const isPreheatActive =
    preheatEndsAtMs !== null && preheatEndsAtMs > preheatNowMs;
  const preheatLabel = isPreheatActive
    ? formatCountdownLabel(preheatEndsAtMs - preheatNowMs)
    : 'Preheat';

  useEffect(() => {
    if (preheatEndsAtMs === null) {
      return;
    }

    const nextNow = Date.now();
    if (preheatEndsAtMs <= nextNow) {
      preheatEndsAtRef.current = null;
      setPreheatNowMs(nextNow);
      setPreheatEndsAtMs(null);
      return;
    }

    const intervalId = window.setInterval(() => {
      const updatedNow = Date.now();
      setPreheatNowMs(updatedNow);
      if (preheatEndsAtMs <= updatedNow) {
        preheatEndsAtRef.current = null;
        setPreheatEndsAtMs(null);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [preheatEndsAtMs]);

  useEffect(() => {
    if (snapshot.shots.length === 0) {
      if (selectedShotId !== undefined) {
        setSelectedShotId(undefined);
      }
      return;
    }

    if (selectedShotId === undefined) {
      setSelectedShotId(snapshot.shots[0].id);
      return;
    }

    const stillExists = snapshot.shots.some((shot) => shot.id === selectedShotId);
    if (!stillExists) {
      setSelectedShotId(snapshot.shots[0].id);
    }
  }, [selectedShotId, snapshot.shots]);

  const selectedShot =
    snapshot.shots.find((shot) => shot.id === selectedShotId) ??
    snapshot.shots[0];
  const selectedShotIndex = selectedShot
    ? snapshot.shots.findIndex((shot) => shot.id === selectedShot.id)
    : -1;

  async function handlePreheatClick() {
    if (!config.meticulousBaseUrl || isPreheatPending) {
      return;
    }

    setIsPreheatPending(true);
    setPreheatError(undefined);

    try {
      const client = createDashboardClient(config.meticulousBaseUrl);
      await client.preheat();

      const now = Date.now();
      setPreheatNowMs(now);
      setPreheatEndsAtMs((current) => {
        if (current !== null && current > now) {
          preheatEndsAtRef.current = null;
          return null;
        }

        if (preheatDurationMinutes === undefined) {
          return null;
        }

        preheatEndsAtRef.current = now + preheatDurationMinutes * 60_000;
        return preheatEndsAtRef.current;
      });
    } catch (error: unknown) {
      setPreheatError(readLoadError(error, 'Failed to send preheat action.'));
    } finally {
      setIsPreheatPending(false);
    }
  }

  async function handleTareClick() {
    if (!config.meticulousBaseUrl || isTarePending) {
      return;
    }

    setIsTarePending(true);
    setTareError(undefined);

    try {
      const client = createDashboardClient(config.meticulousBaseUrl);
      await client.tare();
    } catch (error: unknown) {
      setTareError(readLoadError(error, 'Failed to send tare action.'));
    } finally {
      setIsTarePending(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', px: { md: 4, xs: 2 }, py: { md: 4, xs: 2 } }}>
      <Stack spacing={3} sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Stack
          direction={{ md: 'row', xs: 'column' }}
          spacing={2}
          sx={{ alignItems: { md: 'flex-start' }, justifyContent: 'space-between' }}
        >
          <Stack spacing={1}>
            <Typography variant="h3">ShotLab</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
              Informational dashboard first: safe actions, current machine state,
              and a shared chart surface for history now and live streaming later.
            </Typography>
          </Stack>
          <SocketDebugDrawer
            socketDebug={socketDebug}
            socketSession={socketSession}
          />
        </Stack>

        {config.meticulousBaseUrlError ? (
          <Alert severity="warning">
            Live machine data is unavailable until `METICULOUS_BASE_URL` is
            valid in the shell environment.
          </Alert>
        ) : null}
        {loadErrors.map((error) => (
          <Alert key={error} severity="warning">
            {error}
          </Alert>
        ))}

        <Box
          sx={{
            alignItems: 'start',
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { lg: '280px minmax(0, 1fr)', xs: '1fr' },
          }}
        >
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h5">Actions</Typography>
                <Stack spacing={1.5}>
                  <Button
                    disabled={!config.meticulousBaseUrl || isTarePending}
                    onClick={() => {
                      void handleTareClick();
                    }}
                    variant="contained"
                  >
                    {isTarePending ? 'Sending...' : 'Tare'}
                  </Button>
                  <Button disabled variant="contained">Purge</Button>
                  <Button disabled variant="contained">Raise</Button>
                  <Button
                    disabled={
                      !config.meticulousBaseUrl
                      || loading.settings
                      || isPreheatPending
                      || preheatDurationMinutes === undefined
                    }
                    onClick={() => {
                      void handlePreheatClick();
                    }}
                    variant="contained"
                  >
                    {isPreheatPending ? 'Sending...' : preheatLabel}
                  </Button>
                </Stack>
                {tareError ? (
                  <Typography color="error" variant="body2">
                    {tareError}
                  </Typography>
                ) : null}
                {preheatError ? (
                  <Typography color="error" variant="body2">
                    {preheatError}
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={3}>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  md: 'repeat(3, minmax(0, 1fr))',
                  xs: '1fr 1fr',
                },
              }}
            >
              {snapshot.liveCards.map((card) => (
                <Card key={card.label}>
                  <CardContent>
                    <Stack spacing={0.75}>
                      <Typography color="text.secondary" variant="body2">
                        {card.label}
                      </Typography>
                      {isLiveCardLoading(card.label, loading) ? (
                        <Skeleton height={36} variant="rounded" width="70%" />
                      ) : (
                        <Typography variant="h6">{card.value}</Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Card>
              <CardContent>
                <ShotChartCard
                  isMachineLoading={loading.machine}
                  isShotLoading={loading.history}
                  machineStateLabel={snapshot.machineStateLabel}
                  shot={selectedShot}
                />
              </CardContent>
            </Card>

            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { xl: '320px minmax(0, 1fr)', xs: '1fr' },
              }}
            >
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h5">Selected shot</Typography>
                    {selectedShot ? (
                      <>
                        <Stack spacing={1}>
                          <Typography variant="h6">{selectedShot.profile}</Typography>
                          <Typography color="text.secondary">
                            {selectedShot.brewedAt}
                          </Typography>
                        </Stack>
                        <Box
                          sx={{
                            display: 'grid',
                            gap: 1,
                            gridTemplateColumns: '1fr 1fr',
                          }}
                        >
                          <Metric
                            label="Dose"
                            value={formatGrams(selectedShot.doseGrams)}
                          />
                          <Metric
                            label="Yield"
                            value={formatGrams(selectedShot.yieldGrams)}
                          />
                          <Metric
                            label="Duration"
                            value={formatSeconds(selectedShot.durationSeconds)}
                          />
                          <Metric label="Shot ID" value={selectedShot.id} />
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button
                            disabled={selectedShotIndex <= 0}
                            onClick={() =>
                              setSelectedShotId(
                                snapshot.shots[selectedShotIndex - 1].id,
                              )
                            }
                            variant="outlined"
                          >
                            Previous
                          </Button>
                          <Button
                            disabled={selectedShotIndex >= snapshot.shots.length - 1}
                            onClick={() =>
                              setSelectedShotId(
                                snapshot.shots[selectedShotIndex + 1].id,
                              )
                            }
                            variant="outlined"
                          >
                            Next
                          </Button>
                        </Stack>
                      </>
                    ) : (
                      loading.history ? <ShotSkeleton /> : (
                        <EmptyPanel text="No shot has been selected yet." />
                      )
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h5">History</Typography>
                    <Typography color="text.secondary">
                      Selecting a row loads that shot into the primary chart.
                      The machine currently returns the most recent 20 entries.
                    </Typography>
                    {snapshot.shots.length > 0 ? (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Shot</TableCell>
                            <TableCell>Profile</TableCell>
                            <TableCell align="right">Yield</TableCell>
                            <TableCell align="right">Time</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {snapshot.shots.map((shot) => {
                            const isSelected = shot.id === selectedShot?.id;

                            return (
                              <TableRow
                                hover
                                key={shot.id}
                                onClick={() => setSelectedShotId(shot.id)}
                                selected={isSelected}
                                sx={{ cursor: 'pointer' }}
                              >
                                <TableCell>{shot.brewedAt}</TableCell>
                                <TableCell>{shot.profile}</TableCell>
                                <TableCell align="right">
                                  {formatGrams(shot.yieldGrams)}
                                </TableCell>
                                <TableCell align="right">
                                  {formatSeconds(shot.durationSeconds)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      loading.history ? <HistorySkeleton /> : (
                        <EmptyPanel text="No history rows have been mapped yet." />
                      )
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

interface ShotChartCardProps {
  isMachineLoading: boolean;
  isShotLoading: boolean;
  machineStateLabel: string;
  shot?: DashboardShot;
}

function ShotChartCard(props: ShotChartCardProps) {
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | undefined>();

  useEffect(() => {
    setHoveredPointIndex(undefined);
  }, [props.shot?.id]);

  const activePointIndex = props.shot
    ? selectShotPointIndex(props.shot, hoveredPointIndex)
    : -1;
  const chartSummary = props.shot
    ? buildShotChartSummary(props.shot)
    : undefined;
  const chartSeries = props.shot ? getShotChartSeries(props.shot) : undefined;
  const pointDetails =
    props.shot && activePointIndex >= 0
      ? getShotPointDetails(props.shot, activePointIndex)
      : undefined;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ md: 'row', xs: 'column' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between' }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">
            {chartSummary?.title ?? 'Selected shot chart'}
          </Typography>
          <Typography color="text.secondary">
            {chartSummary?.subtitle ??
              'Showing the selected history shot now. This becomes the live brew surface once streaming lands.'}
          </Typography>
        </Stack>
        <Chip
          label={props.isMachineLoading ? 'Loading machine' : props.machineStateLabel}
          sx={{ width: 'fit-content' }}
        />
      </Stack>
      {props.shot ? (
        <Stack spacing={2}>
          {pointDetails ? (
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  lg: 'repeat(6, minmax(0, 1fr))',
                  xs: '1fr 1fr',
                },
              }}
            >
              <Metric label="Time" value={pointDetails.time} />
              {pointDetails.metrics.map((metric) => (
                <Metric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                />
              ))}
            </Box>
          ) : null}
          <LineChart
            axisHighlight={{ x: 'line' }}
            disableLineItemHighlight={false}
            height={360}
            hideLegend
            margin={{ bottom: 40, left: 56, right: 24, top: 16 }}
            onHighlightedAxisChange={(axisItems) => {
              const nextItem = axisItems.find(
                (axisItem) => axisItem.axisId === 'shot-time',
              );
              setHoveredPointIndex(nextItem?.dataIndex);
            }}
            series={[
              {
                color: '#355c7d',
                curve: 'monotoneX',
                data: chartSeries?.pressure ?? [],
                label: 'Pressure',
                showMark: false,
                yAxisId: 'brew-axis',
              },
              {
                color: '#c06c84',
                curve: 'monotoneX',
                data: chartSeries?.flow ?? [],
                label: 'Flow',
                showMark: false,
                yAxisId: 'brew-axis',
              },
              {
                color: '#f67280',
                curve: 'monotoneX',
                data: chartSeries?.gravimetricFlow ?? [],
                label: 'Grav. flow',
                showMark: false,
                yAxisId: 'brew-axis',
              },
              {
                color: '#6c9a8b',
                curve: 'monotoneX',
                data: chartSeries?.weight ?? [],
                label: 'Weight',
                showMark: false,
                yAxisId: 'weight-axis',
              },
            ]}
            xAxis={[
              {
                data: chartSeries?.time ?? [],
                id: 'shot-time',
                label: 'Time (s)',
                scaleType: 'linear',
              },
            ]}
            yAxis={[
              {
                id: 'brew-axis',
                label: 'Flow / pressure',
                scaleType: 'linear',
              },
              {
                disableLine: true,
                disableTicks: true,
                id: 'weight-axis',
                position: 'right',
                scaleType: 'linear',
                tickLabelStyle: { display: 'none' },
                width: 8,
              },
            ]}
          />
        </Stack>
      ) : (
        props.isShotLoading ? <ChartSkeleton /> : (
          <EmptyPanel text="No chartable shot data has been mapped yet." />
        )
      )}
    </Stack>
  );
}

interface SocketDebugDrawerProps {
  socketDebug: DebugSocketSnapshot;
  socketSession: DebugSocketSessionSnapshot;
}

function SocketDebugDrawer(props: SocketDebugDrawerProps) {
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(() =>
    readStoredBoolean(DEBUG_DRAWER_STORAGE_KEY, false),
  );
  const [selection, setSelection] = useState<DebugSocketGroupSelection>({});

  useEffect(() => {
    writeStoredBoolean(DEBUG_DRAWER_STORAGE_KEY, debugDrawerOpen);
  }, [debugDrawerOpen]);

  useEffect(() => {
    if (!debugDrawerOpen) {
      setSelection({});
    }
  }, [debugDrawerOpen]);

  const selectedSocketGroup = props.socketSession.groups.find(
    (group) => group.event === selection.eventName,
  );
  const selectedSocketPacket = selectedSocketGroup?.recentPackets.find(
    (packet) => packet.id === selection.packetId,
  ) ?? selectedSocketGroup?.latestPacket;

  useEffect(() => {
    if (!debugDrawerOpen) {
      return;
    }

    if (props.socketSession.groups.length === 0) {
      if (selection.eventName || selection.packetId) {
        setSelection({});
      }
      return;
    }

    if (
      selection.eventName
      && props.socketSession.groups.some(
        (group) => group.event === selection.eventName,
      )
    ) {
      return;
    }

    setSelection({
      eventName: props.socketSession.groups[0]?.event,
    });
  }, [
    debugDrawerOpen,
    props.socketSession.groups,
    selection.eventName,
    selection.packetId,
  ]);

  useEffect(() => {
    if (!debugDrawerOpen || !selectedSocketGroup) {
      return;
    }

    if (
      selection.packetId
      && selectedSocketGroup.recentPackets.some(
        (packet) => packet.id === selection.packetId,
      )
    ) {
      return;
    }

    setSelection((current) => ({
      eventName: current.eventName ?? selectedSocketGroup.event,
      packetId: selectedSocketGroup.latestPacket?.id,
    }));
  }, [debugDrawerOpen, selectedSocketGroup, selection.packetId]);

  return (
    <>
      <Button
        onClick={() => setDebugDrawerOpen((current) => !current)}
        variant={debugDrawerOpen ? 'contained' : 'outlined'}
      >
        {debugDrawerOpen ? 'Hide debug' : 'Show debug'}
      </Button>
      <Drawer
        anchor="right"
        onClose={() => setDebugDrawerOpen(false)}
        open={debugDrawerOpen}
        PaperProps={{
          sx: {
            flexShrink: 0,
            height: '100vh',
            maxHeight: '100vh',
            maxWidth: { sm: 440, xs: '100vw' },
            overflow: 'hidden',
            overflowX: 'hidden',
            width: { sm: 440, xs: '100vw' },
          },
        }}
      >
        <Box
          sx={{
            height: '100%',
            maxWidth: '100%',
            minWidth: 0,
            px: 2,
            py: 2,
            width: '100%',
          }}
        >
          <Stack
            spacing={2}
            sx={{
              height: '100%',
              maxWidth: '100%',
              minHeight: 0,
              minWidth: 0,
              width: '100%',
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography variant="h5">Socket debug</Typography>
              <Button onClick={() => setDebugDrawerOpen(false)} variant="text">
                Close
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                color={readDebugChipColor(props.socketDebug.status)}
                label={`State: ${props.socketDebug.status}`}
                size="small"
              />
              <Chip
                label={`Transport: ${props.socketDebug.transport ?? 'unknown'}`}
                size="small"
              />
              <Chip
                label={`Events: ${props.socketSession.totalEvents}`}
                size="small"
              />
              <Chip
                label={`Groups: ${props.socketSession.groups.length}`}
                size="small"
              />
            </Stack>
            {props.socketDebug.socketId ? (
              <Typography color="text.secondary" variant="body2">
                Socket ID: {props.socketDebug.socketId}
              </Typography>
            ) : null}
            {props.socketDebug.error ? (
              <Alert severity="warning">{props.socketDebug.error}</Alert>
            ) : null}
            <Stack spacing={2} sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
              <Stack spacing={1} sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
                <DebugSectionHeading
                  caption={
                    props.socketSession.groups.length > 0
                      ? `${props.socketSession.groups.length} event groups`
                      : undefined
                  }
                  title="Event groups"
                />
                {props.socketSession.groups.length > 0 ? (
                  <Box
                    sx={{
                      border: '1px solid rgba(79, 122, 144, 0.25)',
                      borderRadius: 2,
                      flex: 1,
                      minHeight: 0,
                      minWidth: 0,
                      overflowY: 'auto',
                      p: 1,
                    }}
                  >
                    <Stack spacing={1}>
                      {props.socketSession.groups.map((group) => (
                        <DebugSocketGroupCard
                          group={group}
                          isSelected={group.event === selectedSocketGroup?.event}
                          key={group.event}
                          onClick={() => setSelection({ eventName: group.event })}
                        />
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <EmptyDebugSocketState text="No socket events captured yet." />
                )}
              </Stack>
              <Stack
                spacing={1}
                sx={{
                  borderTop: '1px solid rgba(79, 122, 144, 0.15)',
                  minHeight: 0,
                  minWidth: 0,
                  pt: 2,
                }}
              >
                <DebugSectionHeading
                  caption={
                    selectedSocketGroup
                      ? `${selectedSocketGroup.recentPackets.length} recent packets kept`
                      : undefined
                  }
                  title={selectedSocketGroup
                    ? `Recent ${selectedSocketGroup.event} packets`
                    : 'Recent packets'}
                />
                {selectedSocketGroup ? (
                  <DebugSocketPacketList
                    onSelectPacket={(packetId) => setSelection((current) => ({
                      eventName: current.eventName,
                      packetId,
                    }))}
                    packets={selectedSocketGroup.recentPackets}
                    selectedPacketId={selectedSocketPacket?.id}
                  />
                ) : (
                  <EmptyDebugSocketState text="Select an event group to inspect its recent packets." />
                )}
              </Stack>
              <Stack
                spacing={1}
                sx={{
                  borderTop: '1px solid rgba(79, 122, 144, 0.15)',
                  minHeight: 0,
                  minWidth: 0,
                  pt: 2,
                }}
              >
                <DebugSectionHeading title="Selected payload" />
                <DebugPayloadPanel
                  eventName={selectedSocketGroup?.event}
                  packet={selectedSocketPacket}
                />
              </Stack>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric(props: MetricProps) {
  return (
    <Stack spacing={0.5}>
      <Typography color="text.secondary" variant="body2">
        {props.label}
      </Typography>
      <Typography variant="body1">{props.value}</Typography>
    </Stack>
  );
}

interface EmptyPanelProps {
  text: string;
}

function DebugSectionHeading(props: DebugSectionHeadingProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Typography variant="h6">{props.title}</Typography>
      {props.caption ? (
        <Typography color="text.secondary" variant="caption">
          {props.caption}
        </Typography>
      ) : null}
    </Stack>
  );
}

function DebugSocketGroupCard(props: DebugSocketGroupCardProps) {
  return (
    <Box
      onClick={props.onClick}
      sx={{
        border: '1px solid',
        borderColor: props.isSelected
          ? 'primary.main'
          : 'rgba(79, 122, 144, 0.2)',
        borderRadius: 2,
        cursor: 'pointer',
        minWidth: 0,
        px: 1.25,
        py: 1,
      }}
    >
      <Stack spacing={0.5}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography sx={{ fontWeight: 600 }} variant="body2">
            {props.group.event}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {props.group.totalCount} events
          </Typography>
        </Stack>
        <Typography color="text.secondary" variant="caption">
          {props.group.latestPacket?.receivedAt ?? 'No packets yet'}
          {props.group.latestPacket?.rawMachineTime
            ? ` | raw machine time: ${props.group.latestPacket.rawMachineTime}`
            : ''}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {formatDebugSocketRate(props.group.recentRatePerSecond)}
        </Typography>
        <Typography
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          variant="body2"
        >
          {props.group.payloadPreview}
        </Typography>
      </Stack>
    </Box>
  );
}

function DebugSocketPacketList(props: DebugSocketPacketListProps) {
  return (
    <Box
      sx={{
        border: '1px solid rgba(79, 122, 144, 0.25)',
        borderRadius: 2,
        height: 180,
        minHeight: 180,
        minWidth: 0,
        overflowY: 'auto',
        p: 1,
      }}
    >
      <Stack spacing={1}>
        {props.packets.map((packet) => (
          <DebugSocketPacketSummary
            isSelected={packet.id === props.selectedPacketId}
            key={packet.id}
            onClick={() => props.onSelectPacket(packet.id)}
            packet={packet}
          />
        ))}
      </Stack>
    </Box>
  );
}

function DebugSocketPacketSummary(props: DebugSocketPacketSummaryProps) {
  return (
    <Box
      onClick={props.onClick}
      sx={{
        border: '1px solid',
        borderColor: props.isSelected
          ? 'primary.main'
          : 'rgba(79, 122, 144, 0.2)',
        borderRadius: 2,
        cursor: 'pointer',
        px: 1.25,
        py: 1,
      }}
    >
      <Typography variant="body2">{props.packet.receivedAt}</Typography>
      <Typography color="text.secondary" variant="caption">
        {props.packet.rawMachineTime
          ? `raw machine time: ${props.packet.rawMachineTime}`
          : 'raw machine time unavailable'}
      </Typography>
    </Box>
  );
}

function DebugPayloadPanel(props: DebugPayloadPanelProps) {
  return (
    <Box
      sx={{
        backgroundColor: 'rgba(20, 28, 36, 0.04)',
        borderRadius: 2,
        height: 220,
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
        p: 1,
        width: '100%',
      }}
    >
      {props.packet ? (
        <Box
          sx={{
            fontFamily: 'monospace',
            height: '100%',
            m: 0,
            maxWidth: '100%',
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            p: 2,
            whiteSpace: 'pre-wrap',
            width: '100%',
            wordBreak: 'break-word',
          }}
        >
          {formatDebugPayloadJson({
            event: props.eventName,
            payload: props.packet.payload,
            rawMachineTime: props.packet.rawMachineTime,
            receivedAt: props.packet.receivedAt,
          })}
        </Box>
      ) : (
        <Box sx={{ height: '100%', width: '100%' }}>
          <EmptyDebugSocketState text="Select a packet to inspect its payload." />
        </Box>
      )}
    </Box>
  );
}

function EmptyDebugSocketState(props: EmptyDebugSocketStateProps) {
  return (
    <EmptyPanel text={props.text} />
  );
}

function EmptyPanel(props: EmptyPanelProps) {
  return (
    <Box
      sx={{
        border: '1px dashed rgba(79, 122, 144, 0.3)',
        borderRadius: 3,
        height: '100%',
        minWidth: 0,
        px: 2,
        py: 4,
        width: '100%',
      }}
    >
      <Typography color="text.secondary">{props.text}</Typography>
    </Box>
  );
}

function formatGrams(value: number | null): string {
  return value === null ? 'Unavailable' : `${value} g`;
}

function formatSeconds(value: number | null): string {
  return value === null ? 'Unavailable' : `${value} s`;
}

function applyLiveSocketEvent(input: {
  event: MeticulousSocketEvent;
  lastProfile: LastProfileResponse;
  machine: JsonObject;
  settings: Settings;
}): LiveSocketState {
  switch (input.event.event) {
    case 'status':
      return {
        lastProfile: input.lastProfile,
        machine: patchMachineFromStatusEvent(input.machine, input.event.payload),
        settings: input.settings,
      };
    case 'sensors':
      return {
        lastProfile: input.lastProfile,
        machine: patchMachineFromSensorsEvent(input.machine, input.event.payload),
        settings: input.settings,
      };
    case 'settings':
      return {
        lastProfile: input.lastProfile,
        machine: input.machine,
        settings: patchSettingsFromSettingsEvent(input.settings, input.event.payload),
      };
    case 'profile':
      return {
        lastProfile: patchLastProfileFromProfileEvent(
          input.lastProfile,
          input.event.payload,
        ),
        machine: input.machine,
        settings: input.settings,
      };
    case 'heater_status':
      return {
        lastProfile: input.lastProfile,
        machine: input.machine,
        settings: input.settings,
      };
    default:
      return {
        lastProfile: input.lastProfile,
        machine: input.machine,
        settings: input.settings,
      };
  }
}

function patchMachineFromStatusEvent(
  machine: JsonObject,
  payload: unknown[],
): JsonObject {
  const status = readFirstObject(payload);
  if (!status) {
    return machine;
  }

  const nextStatus = readStringValue(status.status);
  const nextName = readStringValue(status.name);
  const nextState = readStringValue(status.state);
  const nextLoadedProfile = readStringValue(status.loaded_profile);
  const nextProfile = readStringValue(status.profile);
  const sensors = readObjectValue(status.sensors);
  const nextWeight = readNumberValue(sensors?.w);
  const nextTemperature = readNumberValue(sensors?.t);

  return mergeJsonObject(machine, {
    ...(nextName ? { name: nextName } : {}),
    ...(nextState ? { current_state: nextState, state: nextState } : {}),
    ...(nextStatus || nextName || nextState
      ? { status: nextStatus ?? nextName ?? nextState }
      : {}),
    ...(nextLoadedProfile ? { loaded_profile: nextLoadedProfile } : {}),
    ...(nextProfile ? { profile: nextProfile } : {}),
    ...(nextTemperature !== undefined
      ? { temp: nextTemperature, temperature: nextTemperature, water_temperature: nextTemperature }
      : {}),
    ...(nextWeight !== undefined
      ? { current_weight: nextWeight, scale: nextWeight, weight: nextWeight }
      : {}),
  });
}

function patchMachineFromSensorsEvent(
  machine: JsonObject,
  payload: unknown[],
): JsonObject {
  const sensors = readFirstObject(payload);
  if (!sensors) {
    return machine;
  }

  const nextWeight = readNumberValue(sensors.weight_pred);
  if (nextWeight === undefined) {
    return machine;
  }

  if (readNumberValue(machine.weight) !== undefined) {
    return machine;
  }

  return mergeJsonObject(machine, {
    current_weight: nextWeight,
    scale: nextWeight,
    weight: nextWeight,
  });
}

function patchSettingsFromSettingsEvent(
  settings: Settings,
  payload: unknown[],
): Settings {
  const nextSettings = readFirstObject(payload);
  if (!nextSettings) {
    return settings;
  }

  return mergeJsonObject(settings, nextSettings) as Settings;
}

function patchLastProfileFromProfileEvent(
  lastProfile: LastProfileResponse,
  payload: unknown[],
): LastProfileResponse {
  const profile = readFirstObject(payload);
  if (!profile || readStringValue(profile.change) !== 'load') {
    return lastProfile;
  }

  const profileId = readStringValue(profile.profile_id);
  if (!profileId) {
    return lastProfile;
  }

  const nextProfile = mergeJsonObject(
    readObjectValue(lastProfile.profile) ?? {},
    { id: profileId },
  );

  return mergeJsonObject(lastProfile as JsonObject, {
    profile: nextProfile,
  }) as LastProfileResponse;
}

function mergeJsonObject(current: JsonObject, patch: JsonObject): JsonObject {
  let nextObject = current;

  for (const [key, value] of Object.entries(patch)) {
    if (current[key] === value) {
      continue;
    }

    if (nextObject === current) {
      nextObject = { ...current };
    }

    nextObject[key] = value;
  }

  return nextObject;
}

function readFirstObject(payload: unknown[]): JsonObject | undefined {
  return readObjectValue(payload[0]);
}

function readFirstNumber(payload: unknown[]): number | undefined {
  return readNumberValue(payload[0]);
}

function readObjectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function createDebugSocketSessionStore(): DebugSocketSessionStore {
  return {
    groups: new Map<string, DebugSocketMutableGroup>(),
    totalEvents: 0,
  };
}

function appendDebugSocketPacket(
  session: DebugSocketSessionStore,
  eventName: string,
  packet: DebugSocketPacket,
): void {
  const existingGroup = session.groups.get(eventName);
  const nextGroup: DebugSocketMutableGroup = existingGroup ?? {
    event: eventName,
    recentPackets: [],
    recentReceivedAtMs: [],
    totalCount: 0,
  };

  nextGroup.latestPacket = packet;
  nextGroup.totalCount += 1;
  nextGroup.recentPackets = [packet, ...nextGroup.recentPackets].slice(
    0,
    MAX_DEBUG_EVENTS_PER_GROUP,
  );
  nextGroup.recentReceivedAtMs = [
    packet.receivedAtMs,
    ...nextGroup.recentReceivedAtMs.filter(
      (timestamp) => timestamp >= packet.receivedAtMs - DEBUG_SOCKET_RATE_WINDOW_MS,
    ),
  ];

  session.groups.set(eventName, nextGroup);
  session.totalEvents += 1;
}

function buildDebugSocketSessionSnapshot(
  session: DebugSocketSessionStore,
): DebugSocketSessionSnapshot {
  return {
    groups: Array.from(session.groups.values())
      .toSorted((left, right) => left.event.localeCompare(right.event))
      .map((group) => ({
        event: group.event,
        latestPacket: group.latestPacket,
        payloadPreview: formatDebugPayloadPreview(group.latestPacket?.payload),
        recentPackets: group.recentPackets,
        recentRatePerSecond: group.recentReceivedAtMs.length
          / (DEBUG_SOCKET_RATE_WINDOW_MS / 1000),
        totalCount: group.totalCount,
      })),
    totalEvents: session.totalEvents,
  };
}

function createDebugSocketPacket(
  event: MeticulousSocketEvent,
  index: number,
): DebugSocketPacket {
  const receivedAt = new Date();

  return {
    id: `${receivedAt.getTime()}-${index}`,
    payload: event.payload,
    rawMachineTime: readRawMachineTime(event.payload),
    receivedAt: receivedAt.toLocaleString(),
    receivedAtMs: receivedAt.getTime(),
  };
}

function formatDebugPayloadPreview(payload: unknown[] | undefined): string {
  if (!payload || payload.length === 0) {
    return 'No payload';
  }

  const preview = formatDebugPayloadJson(payload[0]);
  if (!preview) {
    return 'Unreadable payload';
  }

  return preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;
}

function formatDebugPayloadJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'Unreadable payload';
  } catch {
    return 'Unreadable payload';
  }
}

function formatDebugSocketRate(value: number): string {
  if (value >= 10) {
    return `${value.toFixed(0)} events/s over last 5s`;
  }

  if (value >= 1) {
    return `${value.toFixed(1)} events/s over last 5s`;
  }

  return `${value.toFixed(2)} events/s over last 5s`;
}

function readDebugChipColor(
  status: DebugSocketSnapshot['status'],
): 'default' | 'error' | 'success' | 'warning' {
  switch (status) {
    case 'connected':
      return 'success';
    case 'connecting':
    case 'disconnected':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}

function readDebugSocketSnapshot(state: MeticulousSocketState): DebugSocketSnapshot {
  if (state.connected) {
    return {
      socketId: state.socketId,
      status: 'connected',
      transport: state.transport,
    };
  }

  if (state.error) {
    return {
      error: state.error,
      socketId: state.socketId,
      status: 'error',
      transport: state.transport,
    };
  }

  return {
    socketId: state.socketId,
    status: 'disconnected',
    transport: state.transport,
  };
}

function readRawMachineTime(payload: unknown[]): string | undefined {
  for (const entry of payload) {
    const rawTime = readRawMachineTimeFromValue(entry);
    if (rawTime) {
      return rawTime;
    }
  }

  return undefined;
}

function readRawMachineTimeFromValue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidateObject = value as Record<string, unknown>;
  for (const key of ['timestamp', 'created_at', 'brewed_at', 'time']) {
    const candidate = candidateObject[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  if (value === '1') {
    return true;
  }
  if (value === '0') {
    return false;
  }

  return fallback;
}

function writeStoredBoolean(key: string, value: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, value ? '1' : '0');
}

function ChartSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton height={20} variant="text" width="28%" />
      <Skeleton height={280} variant="rounded" width="100%" />
    </Stack>
  );
}

function ShotSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton height={28} variant="text" width="48%" />
      <Skeleton height={20} variant="text" width="34%" />
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} height={56} variant="rounded" width="100%" />
        ))}
      </Box>
      <Stack direction="row" spacing={1}>
        <Skeleton height={36} variant="rounded" width={96} />
        <Skeleton height={36} variant="rounded" width={96} />
      </Stack>
    </Stack>
  );
}

function HistorySkeleton() {
  return (
    <Stack spacing={1}>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} height={40} variant="rounded" width="100%" />
      ))}
    </Stack>
  );
}
