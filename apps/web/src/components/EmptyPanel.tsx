import { Box, Typography } from '@mui/material';

interface EmptyPanelProps {
  text: string;
}

export function EmptyPanel(props: EmptyPanelProps) {
  return (
    <Box
      sx={{
        border: '1px dashed rgba(79, 122, 144, 0.3)',
        borderRadius: 3,
        height: '100%',
        minWidth: 0,
        px: 2,
        py: 4,
        width: '100%',
      }}
    >
      <Typography color="text.secondary">{props.text}</Typography>
    </Box>
  );
}
