import { Box } from '@mui/material';
import { readSourceLabel, type ChartSource } from '../lib/dashboard-display';

interface SourceDefaultIconProps {
  source: ChartSource;
}

export function SourceDefaultIcon(props: SourceDefaultIconProps) {
  const backgroundColor = props.source === 'live' ? '#6c9a8b' : '#c06c84';

  return (
    <Box
      aria-label={`${readSourceLabel(props.source)} default icon`}
      role="img"
      sx={{
        alignItems: 'center',
        backgroundColor,
        borderRadius: 2,
        color: '#fffaf2',
        display: 'flex',
        fontSize: 26,
        fontWeight: 700,
        height: 56,
        justifyContent: 'center',
        width: 56,
      }}
    >
      {props.source === 'live' ? 'L' : 'H'}
    </Box>
  );
}
