// npm imports
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { useEffect, useState } from 'react';

// local imports
import type {
  HistoryResponse,
  JsonObject,
} from '../../../packages/meticulous-client/src/index';
import { readAppConfig } from './config';
import { createDashboardClient } from './lib/create-dashboard-client';
import { selectDashboardSnapshot } from './lib/dashboard-selectors';
import {
  buildShotChartSummary,
  getShotChartSeries,
  getShotPointDetails,
  selectShotPointIndex,
} from './lib/shot-chart';

interface LoadState {
  history: boolean;
  lastProfile: boolean;
  machine: boolean;
  settings: boolean;
}

const emptyHistory: HistoryResponse = {};
const emptyObject: JsonObject = {};

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
      return loading.machine && loading.lastProfile;
    case 'Pre-heat':
      return loading.settings;
    default:
      return false;
  }
}

function readLoadError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function App() {
  const config = readAppConfig();
  const [machine, setMachine] = useState<JsonObject>(emptyObject);
  const [settings, setSettings] = useState<JsonObject>(emptyObject);
  const [history, setHistory] = useState<HistoryResponse>(emptyHistory);
  const [lastProfile, setLastProfile] = useState<JsonObject>(emptyObject);
  const [loading, setLoading] = useState<LoadState>(() =>
    createLoadState(Boolean(config.meticulousBaseUrl)),
  );
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<string | undefined>();
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | undefined>();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | undefined>();

  useEffect(() => {
    if (!config.meticulousBaseUrl) {
      setLoading(createLoadState(false));
      return;
    }

    let isCancelled = false;
    const client = createDashboardClient(config.meticulousBaseUrl);

    setMachine(emptyObject);
    setSettings(emptyObject);
    setHistory(emptyHistory);
    setLastProfile(emptyObject);
    setLoadErrors([]);
    setSelectedShotId(undefined);
    setSelectedPointIndex(undefined);
    setHoveredPointIndex(undefined);
    setLoading(createLoadState(true));

    client
      .getMachine()
      .then((nextMachine) => {
        if (!isCancelled) {
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
    };
  }, [config.meticulousBaseUrl]);

  const snapshot = selectDashboardSnapshot(machine, settings, history, lastProfile);

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

  useEffect(() => {
    setSelectedPointIndex(undefined);
    setHoveredPointIndex(undefined);
  }, [selectedShotId]);

  const selectedShot =
    snapshot.shots.find((shot) => shot.id === selectedShotId) ??
    snapshot.shots[0];
  const selectedShotIndex = selectedShot
    ? snapshot.shots.findIndex((shot) => shot.id === selectedShot.id)
    : -1;
  const activePointIndex = selectedShot
    ? selectShotPointIndex(
        selectedShot,
        hoveredPointIndex ?? selectedPointIndex,
      )
    : -1;
  const chartSummary = selectedShot ? buildShotChartSummary(selectedShot) : undefined;
  const chartSeries = selectedShot ? getShotChartSeries(selectedShot) : undefined;
  const pointDetails =
    selectedShot && activePointIndex >= 0
      ? getShotPointDetails(selectedShot, activePointIndex)
      : undefined;

  return (
    <Box sx={{ minHeight: '100vh', px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
      <Stack spacing={3} sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Stack spacing={1}>
          <Typography variant="h3">ShotLab</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
            Informational dashboard first: safe actions, current machine state,
            and a shared chart surface for history now and live streaming later.
          </Typography>
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
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
            alignItems: 'start',
          }}
        >
          <Card>
            <CardContent>
                <Stack spacing={3}>
                  <Stack spacing={1}>
                    <Typography variant="h5">Actions</Typography>
                    <Typography color="text.secondary">
                      Controls stay disabled until the machine actions are wired.
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    <Button disabled variant="contained">Tare</Button>
                    <Button disabled variant="contained">Purge</Button>
                  <Button disabled variant="contained">Raise</Button>
                </Stack>
                <Chip
                  color="default"
                  label="Action wiring not added yet"
                  sx={{ width: 'fit-content' }}
                />
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={3}>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr 1fr',
                  md: 'repeat(3, minmax(0, 1fr))',
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
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
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
                      label={loading.machine ? 'Loading machine' : snapshot.machineStateLabel}
                      sx={{ width: 'fit-content' }}
                    />
                  </Stack>
                  {selectedShot ? (
                    <Stack spacing={2}>
                      {pointDetails ? (
                        <Box
                          sx={{
                            display: 'grid',
                            gap: 1.5,
                            gridTemplateColumns: {
                              xs: '1fr 1fr',
                              lg: 'repeat(6, minmax(0, 1fr))',
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
                        highlightedAxis={
                          activePointIndex >= 0
                            ? [{ axisId: 'shot-time', dataIndex: activePointIndex }]
                            : []
                        }
                        margin={{ left: 56, right: 24, top: 16, bottom: 40 }}
                        onAxisClick={(_event, data) => {
                          if (data) {
                            setSelectedPointIndex(data.dataIndex);
                          }
                        }}
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
                        tooltipAxis={
                          activePointIndex >= 0
                            ? [{ axisId: 'shot-time', dataIndex: activePointIndex }]
                            : []
                        }
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
                    loading.history ? <ChartSkeleton /> : (
                      <EmptyPanel text="No chartable shot data has been mapped yet." />
                    )
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { xs: '1fr', xl: '320px minmax(0, 1fr)' },
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

function EmptyPanel(props: EmptyPanelProps) {
  return (
    <Box
      sx={{
        border: '1px dashed rgba(79, 122, 144, 0.3)',
        borderRadius: 3,
        px: 2,
        py: 4,
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
