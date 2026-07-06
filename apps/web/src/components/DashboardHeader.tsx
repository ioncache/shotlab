import { Box, Stack } from '@mui/material';
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
      <Stack>
        <Box
          alt="ShotLab logo"
          component="img"
          src="/logo.svg"
          sx={{
            display: 'block',
            height: { md: 72, xs: 56 },
            maxWidth: '100%',
            width: 'auto',
          }}
        />
      </Stack>
      {props.debugControl}
    </Stack>
  );
}
