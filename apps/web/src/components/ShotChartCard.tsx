import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useEffect, useState } from 'react';
import type { DashboardShot } from '../lib/dashboard-types';
import {
  DEFAULT_CHART_POINT_DETAILS,
  type ChartSource,
  readSourceEmptyText,
  resolveMachineAssetUrl,
} from '../lib/dashboard-display';
import {
  buildShotChartSummary,
  getShotChartSeries,
  getShotPointDetails,
  selectShotPointIndex,
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
  const [hoveredPointIndex, setHoveredPointIndex] = useState<
    number | undefined
  >();

  useEffect(() => {
    setHoveredPointIndex(undefined);
  }, [props.shot?.id]);

  const activePointIndex = props.shot
    ? selectShotPointIndex(props.shot, hoveredPointIndex)
    : -1;
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
  const pointDetails =
    props.shot && activePointIndex >= 0
      ? getShotPointDetails(props.shot, activePointIndex)
      : DEFAULT_CHART_POINT_DETAILS;

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
          <LineChart
            aria-label="Shot chart"
            axisHighlight={{ x: 'line' }}
            disableLineItemHighlight={false}
            height={360}
            hideLegend
            localeText={{
              noData: readSourceEmptyText(props.activeSource),
            }}
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
      )}
    </Stack>
  );
}
