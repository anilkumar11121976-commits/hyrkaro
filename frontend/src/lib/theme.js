'use client';
import { createTheme } from '@mui/material/styles';

export const brand = {
  ink: '#111111',
  purple: '#5B3FC4',
  deep: '#3F2A94',
  lilac: '#C9B8F5',
  soft: '#EFE9FD',
  line: '#E6E1F0',
  muted: '#56525F',
};

const heading = "'Bricolage Grotesque Variable', 'Hind', system-ui, sans-serif";

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.ink, contrastText: '#fff' },
    secondary: { main: brand.purple, dark: brand.deep, light: brand.lilac, contrastText: '#fff' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    text: { primary: brand.ink, secondary: brand.muted },
    divider: brand.line,
    info: { main: brand.purple },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'Hind', system-ui, -apple-system, 'Segoe UI', sans-serif",
    h1: { fontFamily: heading, fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontFamily: heading, fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontFamily: heading, fontWeight: 800, letterSpacing: '-0.01em' },
    h4: { fontFamily: heading, fontWeight: 700 },
    h5: { fontFamily: heading, fontWeight: 700 },
    h6: { fontFamily: heading, fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.95rem' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 12, paddingInline: 18 }, sizeLarge: { minHeight: 48 } },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 16, borderColor: brand.line } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 18 } } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: '#fff', color: brand.ink } } },
    MuiLink: { defaultProps: { underline: 'hover' }, styleOverrides: { root: { color: brand.purple } } },
  },
});

export default theme;
