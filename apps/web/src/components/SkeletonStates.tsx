import { Skeleton, Stack } from '@mui/material';

export function ChartSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton height={20} variant="text" width="28%" />
      <Skeleton height={280} variant="rounded" width="100%" />
    </Stack>
  );
}

export function ShotSkeleton() {
  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Skeleton height={28} variant="text" width="42%" />
        <Skeleton height={18} variant="text" width="60%" />
      </Stack>
      <Stack spacing={1.25}>
        <Skeleton height={52} variant="rounded" width="100%" />
        <Skeleton height={52} variant="rounded" width="100%" />
      </Stack>
      <Stack direction="row" spacing={1}>
        <Skeleton height={40} variant="rounded" width={96} />
        <Skeleton height={40} variant="rounded" width={96} />
      </Stack>
    </Stack>
  );
}

export function HistorySkeleton() {
  return (
    <Stack spacing={1.5}>
      <Skeleton height={18} variant="text" width="38%" />
      <Skeleton height={180} variant="rounded" width="100%" />
    </Stack>
  );
}
