// npm imports
import { Box, Card, CardContent, Stack } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

// local imports
import {
  connectSocket,
  type HistoryResponse,
  type JsonObject,
  type LastProfileResponse,
  type MachineProfile,
  type Settings,
} from '@shotlab/meticulous-client';
import { ActionsCard } from './components/ActionsCard';
import { DashboardAlerts } from './components/DashboardAlerts';
import { DashboardHeader } from './components/DashboardHeader';
import { HistoryTableCard } from './components/HistoryTableCard';
import { LiveInfoCards } from './components/LiveInfoCards';
import { ProfilesCard } from './components/ProfilesCard';
import { ShotChartCard } from './components/ShotChartCard';
import { ShotDetailsCard } from './components/ShotDetailsCard';
import { SocketDebugDrawer } from './components/SocketDebugDrawer';
import { readAppConfig } from './config';
import { createDashboardClient } from './lib/create-dashboard-client';
import { type ChartSource } from './lib/dashboard-display';
import { selectDashboardSnapshot } from './lib/dashboard-selectors';
import { type DashboardShot } from './lib/dashboard-types';
import { applyLiveSocketEvent } from './lib/live-telemetry';
import {
  findProfileIdByReference,
  readProfileId,
  selectProfileBrowserState,
} from './lib/profile-display';
import {
  appendDebugSocketPacket,
  buildDebugSocketSessionSnapshot,
  createDebugSocketPacket,
  createDebugSocketSessionStore,
  emptyDebugSocketSession,
  readDebugSocketSnapshot,
  type DebugSocketSessionSnapshot,
  type DebugSocketSessionStore,
  type DebugSocketSnapshot,
} from './lib/socket-debug';

const DEBUG_SOCKET_FLUSH_INTERVAL_MS = 250;

interface LoadState {
  history: boolean;
  lastProfile: boolean;
  machine: boolean;
  settings: boolean;
}

const emptyHistory: HistoryResponse = {};
const emptyObject: JsonObject = {};
const emptyLastProfile: LastProfileResponse = {};
const emptyProfiles: MachineProfile[] = [];
const emptySettings: Settings = {};

function createLoadState(isLoading: boolean): LoadState {
  return {
    history: isLoading,
    lastProfile: isLoading,
    machine: isLoading,
    settings: isLoading,
  };
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
  const [lastProfile, setLastProfile] =
    useState<LastProfileResponse>(emptyLastProfile);
  const [liveShot, setLiveShot] = useState<DashboardShot | undefined>();
  const [profiles, setProfiles] = useState<MachineProfile[]>(emptyProfiles);
  const [preheatEndsAtMs, setPreheatEndsAtMs] = useState<number | null>(null);
  const [preheatNowMs, setPreheatNowMs] = useState(() => Date.now());
  const [isTarePending, setIsTarePending] = useState(false);
  const [tareError, setTareError] = useState<string | undefined>();
  const [isPreheatPending, setIsPreheatPending] = useState(false);
  const [preheatError, setPreheatError] = useState<string | undefined>();
  const [socketDebug, setSocketDebug] = useState<DebugSocketSnapshot>({
    status: config.meticulousBaseUrl ? 'disconnected' : 'disabled',
  });
  const [socketSession, setSocketSession] =
    useState<DebugSocketSessionSnapshot>(emptyDebugSocketSession);
  const [loading, setLoading] = useState<LoadState>(() =>
    createLoadState(Boolean(config.meticulousBaseUrl)),
  );
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [activeChartSource, setActiveChartSource] =
    useState<ChartSource>('live');
  const [selectedProfileId, setSelectedProfileId] = useState<
    string | undefined
  >();
  const [selectedShotId, setSelectedShotId] = useState<string | undefined>();
  const lastSyncedHistoryShotIdRef = useRef<string | undefined>();
  const liveSessionIdRef = useRef<string | undefined>();
  const liveShotRef = useRef<DashboardShot | undefined>();
  const machineRef = useRef<JsonObject>(emptyObject);
  const settingsRef = useRef<Settings>(emptySettings);
  const lastProfileRef = useRef<LastProfileResponse>(emptyLastProfile);
  const preheatEndsAtRef = useRef<number | null>(null);
  const sessionStoreRef = useRef<DebugSocketSessionStore>(
    createDebugSocketSessionStore(),
  );
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
    setLiveShot(undefined);
    setProfiles(emptyProfiles);
    liveShotRef.current = undefined;
    machineRef.current = emptyObject;
    settingsRef.current = emptySettings;
    lastProfileRef.current = emptyLastProfile;
    preheatEndsAtRef.current = null;
    setPreheatEndsAtMs(null);
    setLoadErrors([]);
    setActiveChartSource('live');
    setSelectedProfileId(undefined);
    setSelectedShotId(undefined);
    lastSyncedHistoryShotIdRef.current = undefined;
    liveSessionIdRef.current = undefined;
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

    client
      .listProfiles({ full: true })
      .then((nextProfiles) => {
        if (!isCancelled) {
          setProfiles(
            Array.isArray(nextProfiles) ? nextProfiles : emptyProfiles,
          );
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setLoadErrors((current) => [
            ...current,
            `Profiles: ${readLoadError(error, 'Failed to load profiles.')}`,
          ]);
        }
      });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [config.meticulousBaseUrl]);

  const isSocketBootstrapReady =
    Boolean(config.meticulousBaseUrl) &&
    !loading.machine &&
    !loading.settings &&
    !loading.lastProfile;
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
        setLiveShot(liveShotRef.current);
        setMachine(machineRef.current);
        setSettings(settingsRef.current);
        setLastProfile(lastProfileRef.current);
      }

      if (hasPendingSocketEventsRef.current) {
        hasPendingSocketEventsRef.current = false;
        setSocketSession(
          buildDebugSocketSessionSnapshot(sessionStoreRef.current),
        );
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
        appendDebugSocketPacket(
          sessionStoreRef.current,
          event.event,
          nextPacket,
        );
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
            heaterStatus !== undefined &&
            heaterStatus > 0 &&
            !isBrewing &&
            preheatDurationMinutes !== undefined &&
            preheatEndsAtRef.current === null
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
          liveShot: liveShotRef.current,
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

        if (patchedState.liveShot !== liveShotRef.current) {
          const nextLiveSessionId = patchedState.liveShot?.id;
          const isNewLiveSession =
            nextLiveSessionId !== undefined &&
            nextLiveSessionId !== liveSessionIdRef.current;

          liveShotRef.current = patchedState.liveShot;
          liveSessionIdRef.current = nextLiveSessionId;
          hasPendingLiveStateRef.current = true;

          if (isNewLiveSession) {
            setActiveChartSource('live');
          }
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
  }, [
    config.meticulousBaseUrl,
    isSocketBootstrapReady,
    preheatDurationMinutes,
  ]);

  const snapshot = selectDashboardSnapshot(
    machine,
    settings,
    history,
    lastProfile,
  );
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

    const stillExists = snapshot.shots.some(
      (shot) => shot.id === selectedShotId,
    );
    if (selectedShotId !== undefined && !stillExists) {
      setSelectedShotId(undefined);
    }
  }, [selectedShotId, snapshot.shots]);

  useEffect(() => {
    if (
      selectedProfileId &&
      !profiles.some((profile) => readProfileId(profile) === selectedProfileId)
    ) {
      setSelectedProfileId(undefined);
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (activeChartSource !== 'history' || !selectedShotId) {
      return;
    }

    if (lastSyncedHistoryShotIdRef.current === selectedShotId) {
      return;
    }

    const historyShot = snapshot.shots.find(
      (shot) => shot.id === selectedShotId,
    );
    if (!historyShot) {
      return;
    }

    const nextProfileId = findProfileIdByReference(
      profiles,
      historyShot.profileId ?? historyShot.profile,
    );

    if (nextProfileId && nextProfileId !== selectedProfileId) {
      setSelectedProfileId(nextProfileId);
    }

    lastSyncedHistoryShotIdRef.current = selectedShotId;
  }, [
    activeChartSource,
    profiles,
    selectedProfileId,
    selectedShotId,
    snapshot.shots,
  ]);

  const selectedShot =
    selectedShotId === undefined
      ? undefined
      : snapshot.shots.find((shot) => shot.id === selectedShotId);
  const displayedShot =
    activeChartSource === 'history' ? selectedShot : liveShot;
  const selectedShotIndex = selectedShot
    ? snapshot.shots.findIndex((shot) => shot.id === selectedShot.id)
    : -1;
  const profileBrowserState = selectProfileBrowserState({
    lastProfile,
    machine,
    profiles,
    selectedProfileId,
    settings,
  });

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
    <Box
      sx={{ minHeight: '100vh', px: { md: 4, xs: 2 }, py: { md: 4, xs: 2 } }}
    >
      <Stack spacing={3} sx={{ maxWidth: 1440, mx: 'auto' }}>
        <DashboardHeader
          debugControl={
            <SocketDebugDrawer
              socketDebug={socketDebug}
              socketSession={socketSession}
            />
          }
        />

        <DashboardAlerts
          loadErrors={loadErrors}
          meticulousBaseUrlError={config.meticulousBaseUrlError}
        />

        <Box
          sx={{
            alignItems: 'start',
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { lg: '280px minmax(0, 1fr)', xs: '1fr' },
          }}
        >
          <Stack spacing={3}>
            <ActionsCard
              canPreheat={
                Boolean(config.meticulousBaseUrl) &&
                !loading.settings &&
                preheatDurationMinutes !== undefined
              }
              canTare={Boolean(config.meticulousBaseUrl)}
              isPreheatPending={isPreheatPending}
              isTarePending={isTarePending}
              onPreheat={() => {
                void handlePreheatClick();
              }}
              onTare={() => {
                void handleTareClick();
              }}
              preheatError={preheatError}
              preheatLabel={preheatLabel}
              tareError={tareError}
            />

            <ProfilesCard
              activeProfile={profileBrowserState.activeProfile}
              activeProfileId={profileBrowserState.activeProfileId}
              isLocked={
                activeChartSource === 'live' && profileBrowserState.isBrewing
              }
              machineBaseUrl={config.meticulousBaseUrl}
              onSelectProfile={setSelectedProfileId}
              profiles={profileBrowserState.orderedProfiles}
            />
          </Stack>

          <Stack spacing={3}>
            <LiveInfoCards liveCards={snapshot.liveCards} loading={loading} />

            <Card>
              <CardContent>
                <ShotChartCard
                  activeSource={activeChartSource}
                  machineBaseUrl={config.meticulousBaseUrl}
                  isMachineLoading={loading.machine}
                  isShotLoading={loading.history}
                  machineStateLabel={snapshot.machineStateLabel}
                  onSourceChange={setActiveChartSource}
                  shot={displayedShot}
                />
              </CardContent>
            </Card>

            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { lg: '320px minmax(0, 1fr)', xs: '1fr' },
              }}
            >
              <ShotDetailsCard
                activeSource={activeChartSource}
                historyLoading={loading.history}
                isProfileSelectionDisabled={
                  activeChartSource === 'live' && profileBrowserState.isBrewing
                }
                machineBaseUrl={config.meticulousBaseUrl}
                onNext={() =>
                  setSelectedShotId(snapshot.shots[selectedShotIndex + 1].id)
                }
                onProfileSelect={() => {
                  const profileReference =
                    displayedShot?.profileId ?? displayedShot?.profile;
                  const nextProfileId = findProfileIdByReference(
                    profiles,
                    profileReference,
                  );

                  if (nextProfileId) {
                    setSelectedProfileId(nextProfileId);
                  }
                }}
                onPrevious={() =>
                  setSelectedShotId(snapshot.shots[selectedShotIndex - 1].id)
                }
                selectedShot={displayedShot}
                selectedShotIndex={
                  activeChartSource === 'history' ? selectedShotIndex : -1
                }
                shotCount={
                  activeChartSource === 'history' ? snapshot.shots.length : 0
                }
              />

              <HistoryTableCard
                historyLoading={loading.history}
                machineBaseUrl={config.meticulousBaseUrl}
                onSelectShot={(shotId) => {
                  setSelectedShotId(shotId);
                  setActiveChartSource('history');
                }}
                selectedShotId={selectedShot?.id}
                shots={snapshot.shots}
              />
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function readFirstNumber(payload: unknown[]): number | undefined {
  return readNumberValue(payload[0]);
}

function readNumberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
