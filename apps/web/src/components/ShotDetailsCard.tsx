import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import type { DashboardShot } from '../lib/dashboard-types';
import {
  type ChartSource,
  formatGrams,
  formatSeconds,
  readSourceEmptyText,
  readSourceLabel,
  resolveMachineAssetUrl,
} from '../lib/dashboard-display';
import { Metric } from './Metric';
import { SourceDefaultIcon } from './SourceDefaultIcon';
import { ShotSkeleton } from './SkeletonStates';

interface ShotDetailsCardProps {
  activeSource: ChartSource;
  historyLoading: boolean;
  isProfileSelectionDisabled: boolean;
  machineBaseUrl?: string;
  onNext: () => void;
  onProfileSelect?: () => void;
  onPrevious: () => void;
  selectedShot?: DashboardShot;
  selectedShotIndex: number;
  shotCount: number;
}

export function ShotDetailsCard(props: ShotDetailsCardProps) {
  const shotId = props.selectedShot?.id;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ sm: 'row', xs: 'column' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between' }}
          >
            <Typography variant="h5">
              {readSourceLabel(props.activeSource)}
            </Typography>
            <Chip
              label={props.activeSource === 'live' ? 'Live' : 'History'}
              sx={{ width: 'fit-content' }}
            />
          </Stack>
          {props.historyLoading && props.activeSource === 'history' ? (
            <ShotSkeleton />
          ) : (
            <>
              <ButtonBase
                disabled={
                  props.isProfileSelectionDisabled || !props.onProfileSelect
                }
                onClick={props.onProfileSelect}
                sx={{
                  borderRadius: 2,
                  display: 'block',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center' }}
                >
                  {props.selectedShot?.profileImage ? (
                    <Box
                      alt={`${props.selectedShot.profile} selected profile image`}
                      component="img"
                      src={resolveMachineAssetUrl(
                        props.machineBaseUrl,
                        props.selectedShot.profileImage,
                      )}
                      sx={{
                        borderRadius: 2,
                        display: 'block',
                        height: 48,
                        objectFit: 'cover',
                        width: 48,
                      }}
                    />
                  ) : (
                    <SourceDefaultIcon source={props.activeSource} />
                  )}
                  <Stack spacing={1}>
                    <Typography variant="h6">
                      {props.selectedShot?.profile ??
                        readSourceLabel(props.activeSource)}
                    </Typography>
                    <Typography color="text.secondary">
                      {props.selectedShot?.brewedAt ??
                        readSourceEmptyText(props.activeSource)}
                    </Typography>
                  </Stack>
                </Stack>
              </ButtonBase>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: '1fr 1fr',
                }}
              >
                <Metric
                  label="Dose"
                  value={
                    props.selectedShot
                      ? formatGrams(props.selectedShot.doseGrams)
                      : '0 g'
                  }
                />
                <Metric
                  label="Yield"
                  value={
                    props.selectedShot
                      ? formatGrams(props.selectedShot.yieldGrams)
                      : '0 g'
                  }
                />
                <Metric
                  label="Duration"
                  value={
                    props.selectedShot
                      ? formatSeconds(props.selectedShot.durationSeconds)
                      : '0 s'
                  }
                />
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography color="text.secondary" variant="body2">
                    Shot ID
                  </Typography>
                  <ButtonBase
                    aria-label="Copy shot ID"
                    disabled={!props.selectedShot?.id}
                    onClick={() => {
                      void copyShotId(props.selectedShot?.id);
                    }}
                    sx={{
                      display: 'block',
                      maxWidth: '100%',
                      minWidth: 0,
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <Typography
                      sx={{ display: 'block', minWidth: 0, width: '100%' }}
                      noWrap
                      title={shotId}
                      variant="body1"
                    >
                      {shotId ?? '—'}
                    </Typography>
                  </ButtonBase>
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  disabled={props.selectedShotIndex <= 0}
                  onClick={props.onPrevious}
                  variant="outlined"
                >
                  Previous
                </Button>
                <Button
                  disabled={
                    props.selectedShotIndex >= props.shotCount - 1 ||
                    !props.selectedShot
                  }
                  onClick={props.onNext}
                  variant="outlined"
                >
                  Next
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

async function copyShotId(shotId: string | undefined): Promise<void> {
  if (
    !shotId ||
    typeof navigator === 'undefined' ||
    !navigator.clipboard?.writeText
  ) {
    return;
  }

  await navigator.clipboard.writeText(shotId);
}
