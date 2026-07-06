import { Stack, Typography } from '@mui/material';

interface MetricProps {
  label: string;
  value: string;
}

export function Metric(props: MetricProps) {
  return (
    <Stack spacing={0.5}>
      <Typography color="text.secondary" variant="body2">
        {props.label}
      </Typography>
      <Typography variant="body1">{props.value}</Typography>
    </Stack>
  );
}
