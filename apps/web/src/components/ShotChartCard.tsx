import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useEffect, useRef, useState } from 'react';
import type { DashboardShot } from '../lib/dashboard-types';
import {
  DEFAULT_CHART_POINT_DETAILS,
  type ChartSource,
  readSourceEmptyText,
  resolveMachineAssetUrl,
} from '../lib/dashboard-display';
import {
  buildShotChartSummary,
  getShotChartExtents,
  getShotChartSeries,
  getShotPointDetails,
  isShotReplayAvailable,
  readShotReplayDurationMs,
  readShotReplayElapsedMs,
  selectShotPointIndex,
  selectShotReplayPointIndex,
} from '../lib/shot-chart';
import { Metric } from './Metric';
import { SourceDefaultIcon } from './SourceDefaultIcon';
import { ChartSkeleton } from './SkeletonStates';

interface ShotChartCardProps {
  activeSource: ChartSource;
  machineBaseUrl?: string;
  isMachineLoading: boolean;
  isShotLoading: boolean;
  machineStateLabel: string;
  onSourceChange: (source: ChartSource) => void;
  shot?: DashboardShot;
}

export function ShotChartCard(props: ShotChartCardProps) {
  const [displayedPointIndex, setDisplayedPointIndex] = useState<
    number | undefined
  >();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<
    number | undefined
  >();
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const replayFrameRef = useRef<number | undefined>(undefined);
  const replayStartedAtRef = useRef<number | undefined>(undefined);
  const replayStartElapsedMsRef = useRef(0);

  useEffect(() => {
    setDisplayedPointIndex(
      props.shot ? selectShotPointIndex(props.shot) : undefined,
    );
    setHoveredPointIndex(undefined);
    setIsReplayPlaying(false);
    replayStartedAtRef.current = undefined;
    replayStartElapsedMsRef.current = 0;
  }, [props.shot?.id]);

  useEffect(() => {
    return () => {
      if (replayFrameRef.current !== undefined) {
        window.cancelAnimationFrame(replayFrameRef.current);
      }
    };
  }, []);

  const displayedChartPointIndex = props.shot
    ? selectShotPointIndex(props.shot, displayedPointIndex)
    : -1;
  const clampedHoveredPointIndex =
    hoveredPointIndex === undefined ||
    displayedChartPointIndex < 0 ||
    hoveredPointIndex > displayedChartPointIndex
      ? undefined
      : hoveredPointIndex;
  const previewedPointIndex = props.shot
    ? selectShotPointIndex(props.shot, clampedHoveredPointIndex)
    : -1;
  const inspectedPointIndex = props.shot
    ? selectShotPointIndex(
        props.shot,
        clampedHoveredPointIndex ?? displayedPointIndex,
      )
    : -1;
  const isReplayAvailable = props.shot
    ? isShotReplayAvailable(props.shot)
    : false;
  const canShowReplayControls = props.shot?.source === 'history';
  const chartSummary = props.shot
    ? buildShotChartSummary(props.shot)
    : {
        subtitle: '0 s • 0 g',
        title:
          props.activeSource === 'live'
            ? 'Live brew chart'
            : 'Selected shot chart',
      };
  const chartSeries = props.shot ? getShotChartSeries(props.shot) : undefined;
  const chartExtents = props.shot
    ? getShotChartExtents(props.shot)
    : { brewMax: 1, weightMax: 1 };
  const visibleChartSeries =
    chartSeries && displayedChartPointIndex >= 0
      ? {
          flow: chartSeries.flow.map((value, index) =>
            index <= displayedChartPointIndex ? value : null,
          ),
          gravimetricFlow: chartSeries.gravimetricFlow.map((value, index) =>
            index <= displayedChartPointIndex ? value : null,
          ),
          pressure: chartSeries.pressure.map((value, index) =>
            index <= displayedChartPointIndex ? value : null,
          ),
          time: chartSeries.time,
          weight: chartSeries.weight.map((value, index) =>
            index <= displayedChartPointIndex ? value : null,
          ),
        }
      : chartSeries;
  const pointDetails =
    props.shot && inspectedPointIndex >= 0
      ? getShotPointDetails(props.shot, inspectedPointIndex)
      : DEFAULT_CHART_POINT_DETAILS;

  useEffect(() => {
    if (!props.shot || !isReplayAvailable || !isReplayPlaying) {
      if (replayFrameRef.current !== undefined) {
        window.cancelAnimationFrame(replayFrameRef.current);
        replayFrameRef.current = undefined;
      }
      replayStartedAtRef.current = undefined;
      return;
    }

    const replayDurationMs = readShotReplayDurationMs(props.shot);
    if (replayDurationMs <= 0) {
      setIsReplayPlaying(false);
      return;
    }

    const replayShot = props.shot;

    const animateReplay = (now: number) => {
      if (replayStartedAtRef.current === undefined) {
        replayStartedAtRef.current = now;
      }

      const elapsedMs =
        replayStartElapsedMsRef.current + (now - replayStartedAtRef.current);
      const nextIndex = selectShotReplayPointIndex(replayShot, elapsedMs);
      setDisplayedPointIndex((currentIndex) =>
        currentIndex === nextIndex ? currentIndex : nextIndex,
      );

      if (
        elapsedMs >= replayDurationMs ||
        nextIndex >= replayShot.points.length - 1
      ) {
        setDisplayedPointIndex(replayShot.points.length - 1);
        setIsReplayPlaying(false);
        replayFrameRef.current = undefined;
        return;
      }

      replayFrameRef.current = window.requestAnimationFrame(animateReplay);
    };

    replayFrameRef.current = window.requestAnimationFrame(animateReplay);

    return () => {
      if (replayFrameRef.current !== undefined) {
        window.cancelAnimationFrame(replayFrameRef.current);
        replayFrameRef.current = undefined;
      }
    };
  }, [
    displayedChartPointIndex,
    isReplayAvailable,
    isReplayPlaying,
    props.shot,
  ]);

  function handleReplayToggle() {
    if (!props.shot || !isReplayAvailable) {
      return;
    }

    if (displayedChartPointIndex >= props.shot.points.length - 1) {
      setDisplayedPointIndex(0);
      setHoveredPointIndex(undefined);
      replayStartElapsedMsRef.current = 0;
      replayStartedAtRef.current = undefined;
      setIsReplayPlaying(true);
      return;
    }

    setIsReplayPlaying((currentValue) => {
      const nextValue = !currentValue;
      if (nextValue) {
        setHoveredPointIndex(undefined);
        replayStartElapsedMsRef.current = readShotReplayElapsedMs(
          props.shot as DashboardShot,
          displayedChartPointIndex,
        );
        replayStartedAtRef.current = undefined;
      }
      return nextValue;
    });
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ md: 'row', xs: 'column' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {props.shot?.profileImage ? (
            <Box
              alt={`${props.shot.profile} selected profile image`}
              component="img"
              src={resolveMachineAssetUrl(
                props.machineBaseUrl,
                props.shot.profileImage,
              )}
              sx={{
                borderRadius: 2,
                height: 56,
                objectFit: 'cover',
                width: 56,
              }}
            />
          ) : (
            <SourceDefaultIcon source={props.activeSource} />
          )}
          <Stack spacing={0.5}>
            <Typography variant="h5">{chartSummary.title}</Typography>
            <Typography color="text.secondary">
              {chartSummary.subtitle}
            </Typography>
          </Stack>
        </Stack>
        <Stack
          direction={{ sm: 'row', xs: 'column' }}
          spacing={1}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <ButtonGroup aria-label="Chart source">
            <Button
              onClick={() => props.onSourceChange('live')}
              variant={props.activeSource === 'live' ? 'contained' : 'outlined'}
            >
              Live
            </Button>
            <Button
              onClick={() => props.onSourceChange('history')}
              variant={
                props.activeSource === 'history' ? 'contained' : 'outlined'
              }
            >
              History
            </Button>
          </ButtonGroup>
          <Chip
            label={
              props.isMachineLoading
                ? 'Loading machine'
                : props.machineStateLabel
            }
            sx={{ width: 'fit-content' }}
          />
        </Stack>
      </Stack>
      {props.isShotLoading ? (
        <ChartSkeleton />
      ) : (
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                md: 'repeat(5, minmax(0, 1fr))',
                xs: 'repeat(2, minmax(0, 1fr))',
              },
              justifyItems: 'center',
              textAlign: 'center',
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
          <LineChart
            aria-label="Shot chart"
            axisHighlight={{ x: 'line' }}
            disableLineItemHighlight={false}
            height={360}
            highlightedAxis={
              previewedPointIndex >= 0 && clampedHoveredPointIndex !== undefined
                ? [{ axisId: 'shot-time', dataIndex: previewedPointIndex }]
                : []
            }
            tooltipAxis={
              previewedPointIndex >= 0 && clampedHoveredPointIndex !== undefined
                ? [{ axisId: 'shot-time', dataIndex: previewedPointIndex }]
                : []
            }
            hideLegend
            localeText={{
              noData: readSourceEmptyText(props.activeSource),
            }}
            margin={{ bottom: 40, left: 56, right: 24, top: 16 }}
            onHighlightedAxisChange={(axisItems) => {
              const nextItem = axisItems.find(
                (axisItem) => axisItem.axisId === 'shot-time',
              );
              setHoveredPointIndex(
                nextItem?.dataIndex !== undefined &&
                  nextItem.dataIndex <= displayedChartPointIndex
                  ? nextItem.dataIndex
                  : undefined,
              );
            }}
            series={[
              {
                color: '#355c7d',
                curve: 'monotoneX',
                data: visibleChartSeries?.pressure ?? [],
                label: 'Pressure',
                showMark: false,
                yAxisId: 'brew-axis',
              },
              {
                color: '#c06c84',
                curve: 'monotoneX',
                data: visibleChartSeries?.flow ?? [],
                label: 'Flow',
                showMark: false,
                yAxisId: 'brew-axis',
              },
              {
                color: '#f67280',
                curve: 'monotoneX',
                data: visibleChartSeries?.gravimetricFlow ?? [],
                label: 'Grav. flow',
                showMark: false,
                yAxisId: 'brew-axis',
              },
              {
                color: '#6c9a8b',
                curve: 'monotoneX',
                data: visibleChartSeries?.weight ?? [],
                label: 'Weight',
                showMark: false,
                yAxisId: 'weight-axis',
              },
            ]}
            xAxis={[
              {
                data: visibleChartSeries?.time ?? [],
                id: 'shot-time',
                label: 'Time (s)',
                scaleType: 'linear',
              },
            ]}
            yAxis={[
              {
                id: 'brew-axis',
                label: 'Flow / pressure',
                max: chartExtents.brewMax,
                min: 0,
                scaleType: 'linear',
              },
              {
                disableLine: true,
                disableTicks: true,
                id: 'weight-axis',
                max: chartExtents.weightMax,
                min: 0,
                position: 'right',
                scaleType: 'linear',
                tickLabelStyle: { display: 'none' },
                width: 8,
              },
            ]}
          />
          {canShowReplayControls ? (
            <Stack spacing={1.5}>
              <Slider
                aria-label="Shot replay position"
                disabled={!isReplayAvailable || !props.shot}
                max={props.shot ? Math.max(props.shot.points.length - 1, 0) : 0}
                min={0}
                onChange={(_, nextValue) => {
                  setIsReplayPlaying(false);
                  setHoveredPointIndex(undefined);
                  setDisplayedPointIndex(
                    Array.isArray(nextValue) ? nextValue[0] : nextValue,
                  );
                }}
                step={1}
                value={
                  displayedChartPointIndex >= 0 ? displayedChartPointIndex : 0
                }
              />
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: 'center' }}
              >
                <IconButton
                  aria-label="Start"
                  disabled={!isReplayAvailable || displayedChartPointIndex <= 0}
                  onClick={() => {
                    setIsReplayPlaying(false);
                    setHoveredPointIndex(undefined);
                    replayStartElapsedMsRef.current = 0;
                    replayStartedAtRef.current = undefined;
                    setDisplayedPointIndex(0);
                  }}
                >
                  <FirstPageIcon />
                </IconButton>
                <IconButton
                  aria-label={isReplayPlaying ? 'Pause' : 'Play'}
                  disabled={!isReplayAvailable}
                  onClick={handleReplayToggle}
                >
                  {isReplayPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
                <IconButton
                  aria-label="End"
                  disabled={
                    !isReplayAvailable ||
                    !props.shot ||
                    displayedChartPointIndex >= props.shot.points.length - 1
                  }
                  onClick={() => {
                    setIsReplayPlaying(false);
                    setHoveredPointIndex(undefined);
                    replayStartElapsedMsRef.current = props.shot
                      ? readShotReplayDurationMs(props.shot)
                      : 0;
                    replayStartedAtRef.current = undefined;
                    setDisplayedPointIndex(props.shot.points.length - 1);
                  }}
                >
                  <LastPageIcon />
                </IconButton>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}
