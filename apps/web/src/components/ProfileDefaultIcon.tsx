import { Box } from '@mui/material';

interface ProfileDefaultIconProps {
  active?: boolean;
  label: string;
}

export function ProfileDefaultIcon(props: ProfileDefaultIconProps) {
  return (
    <Box
      aria-label={`${props.label} default profile icon`}
      role="img"
      sx={{
        alignItems: 'center',
        backgroundColor: props.active ? '#355c7d' : '#b7b7b7',
        borderRadius: 2,
        color: '#fffaf2',
        display: 'flex',
        flexShrink: 0,
        fontSize: 20,
        fontWeight: 700,
        height: 44,
        justifyContent: 'center',
        width: 44,
      }}
    >
      P
    </Box>
  );
}
