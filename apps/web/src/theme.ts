import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    background: {
      default: '#edf1f4',
      paper: '#f8fafb',
    },
    primary: {
      main: '#4f7a90',
    },
    secondary: {
      main: '#7e8f9a',
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
  },
});
