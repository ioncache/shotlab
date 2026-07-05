import { Alert } from '@mui/material';

interface DashboardAlertsProps {
  loadErrors: string[];
  meticulousBaseUrlError?: string;
}

export function DashboardAlerts(props: DashboardAlertsProps) {
  return (
    <>
      {props.meticulousBaseUrlError ? (
        <Alert severity="warning">
          Live machine data is unavailable until `METICULOUS_BASE_URL` is valid
          in the shell environment.
        </Alert>
      ) : null}
      {props.loadErrors.map((error) => (
        <Alert key={error} severity="warning">
          {error}
        </Alert>
      ))}
    </>
  );
}
