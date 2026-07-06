import { Box, Stack, Typography } from '@mui/material';
import type { MachineProfile } from '@shotlab/meticulous-client';
import {
  readProfileDescription,
  readProfileName,
} from '../lib/profile-display';
import { formatCelsius, formatGrams } from '../lib/dashboard-display';
import { Metric } from './Metric';

interface ProfileDetailsProps {
  profile?: MachineProfile;
}

export function ProfileDetails(props: ProfileDetailsProps) {
  const temperature = props.profile?.temperature;
  const finalWeight = props.profile?.final_weight;
  const stageCount = props.profile?.stages?.length ?? 0;
  const variableCount = props.profile?.variables?.length ?? 0;
  const description = readProfileDescription(props.profile);

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography variant="h6">{readProfileName(props.profile)}</Typography>
        {description ? (
          <Typography color="text.secondary" variant="body2">
            {description}
          </Typography>
        ) : null}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        <Metric
          label="Temperature"
          value={temperature === undefined ? '—' : formatCelsius(temperature)}
        />
        <Metric
          label="Yield"
          value={finalWeight === undefined ? '—' : formatGrams(finalWeight)}
        />
        <Metric label="Stages" value={String(stageCount)} />
        <Metric label="Variables" value={String(variableCount)} />
      </Box>
    </Stack>
  );
}
