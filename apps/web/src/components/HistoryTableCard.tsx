import {
  Box,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { DashboardShot } from '../lib/dashboard-types';
import {
  formatGrams,
  formatSeconds,
  resolveMachineAssetUrl,
} from '../lib/dashboard-display';
import { EmptyPanel } from './EmptyPanel';
import { HistorySkeleton } from './SkeletonStates';

interface HistoryTableCardProps {
  historyLoading: boolean;
  machineBaseUrl?: string;
  onSelectShot: (shotId: string) => void;
  selectedShotId?: string;
  shots: DashboardShot[];
}

export function HistoryTableCard(props: HistoryTableCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">History</Typography>
          <Typography color="text.secondary">
            Selecting a row loads that shot into the primary chart. The machine
            currently returns the most recent 20 entries.
          </Typography>
          {props.shots.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell aria-label="Profile image" />
                  <TableCell>Shot</TableCell>
                  <TableCell>Profile</TableCell>
                  <TableCell align="right">Yield</TableCell>
                  <TableCell align="right">Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.shots.map((shot) => {
                  const isSelected = shot.id === props.selectedShotId;

                  return (
                    <TableRow
                      hover
                      key={shot.id}
                      onClick={() => props.onSelectShot(shot.id)}
                      selected={isSelected}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        {shot.profileImage ? (
                          <Box
                            alt={`${shot.profile} history profile image`}
                            component="img"
                            src={resolveMachineAssetUrl(
                              props.machineBaseUrl,
                              shot.profileImage,
                            )}
                            sx={{
                              borderRadius: 1.5,
                              display: 'block',
                              height: 32,
                              objectFit: 'cover',
                              width: 32,
                            }}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell>{shot.brewedAt}</TableCell>
                      <TableCell>{shot.profile}</TableCell>
                      <TableCell align="right">
                        {formatGrams(shot.yieldGrams)}
                      </TableCell>
                      <TableCell align="right">
                        {formatSeconds(shot.durationSeconds)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : props.historyLoading ? (
            <HistorySkeleton />
          ) : (
            <EmptyPanel text="No history rows have been mapped yet." />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
