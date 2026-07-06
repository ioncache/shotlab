import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type { DashboardMetric } from '../lib/dashboard-types';

interface LoadState {
  history: boolean;
  lastProfile: boolean;
  machine: boolean;
  settings: boolean;
}

interface LiveInfoCardsProps {
  liveCards: DashboardMetric[];
  loading: LoadState;
}

export function LiveInfoCards(props: LiveInfoCardsProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          lg: 'repeat(4, minmax(0, 1fr))',
          sm: 'repeat(2, minmax(0, 1fr))',
          xs: '1fr',
        },
      }}
    >
      {props.liveCards.map((card) => (
        <Card key={card.label}>
          <CardContent>
            <Stack spacing={0.75}>
              <Typography color="text.secondary" variant="body2">
                {card.label}
              </Typography>
              {isLiveCardLoading(card.label, props.loading) ? (
                <Skeleton height={36} variant="rounded" width="70%" />
              ) : (
                <Typography variant="h6">{card.value}</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function isLiveCardLoading(label: string, loading: LoadState): boolean {
  switch (label) {
    case 'Temperature':
    case 'Machine status':
    case 'Weight':
      return loading.machine;
    case 'Last loaded profile':
      return loading.lastProfile;
    default:
      return false;
  }
}
