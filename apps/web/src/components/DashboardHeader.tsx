import { Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface DashboardHeaderProps {
  debugControl: ReactNode;
}

export function DashboardHeader(props: DashboardHeaderProps) {
  return (
    <Stack
      direction={{ md: 'row', xs: 'column' }}
      spacing={2}
      sx={{ alignItems: { md: 'flex-start' }, justifyContent: 'space-between' }}
    >
      <Stack spacing={1}>
        <Typography variant="h3">ShotLab</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
          Current machine state, safe actions, and brew data.
        </Typography>
      </Stack>
      {props.debugControl}
    </Stack>
  );
}
