import { Button, Card, CardContent, Stack, Typography } from '@mui/material';

interface ActionsCardProps {
  canPreheat: boolean;
  canTare: boolean;
  isPreheatPending: boolean;
  isTarePending: boolean;
  onPreheat: () => void;
  onTare: () => void;
  preheatError?: string;
  preheatLabel: string;
  tareError?: string;
}

export function ActionsCard(props: ActionsCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant="h5">Actions</Typography>
          <Stack spacing={1.5}>
            <Button
              disabled={!props.canTare || props.isTarePending}
              onClick={props.onTare}
              variant="contained"
            >
              {props.isTarePending ? 'Sending...' : 'Tare'}
            </Button>
            <Button disabled variant="contained">
              Purge
            </Button>
            <Button disabled variant="contained">
              Raise
            </Button>
            <Button
              disabled={!props.canPreheat || props.isPreheatPending}
              onClick={props.onPreheat}
              variant="contained"
            >
              {props.isPreheatPending ? 'Sending...' : props.preheatLabel}
            </Button>
          </Stack>
          {props.tareError ? (
            <Typography color="error" variant="body2">
              {props.tareError}
            </Typography>
          ) : null}
          {props.preheatError ? (
            <Typography color="error" variant="body2">
              {props.preheatError}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
