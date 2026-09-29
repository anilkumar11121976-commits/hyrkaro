'use client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import theme from '@/lib/theme';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { I18nProvider } from '@/i18n/I18nProvider';

export default function Providers({ children, lang }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider initial={lang}>
        <AuthProvider>
          <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
      </I18nProvider>
      <ToastContainer
        position="top-center"
        autoClose={3500}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        theme="light"
        limit={3}
      />
    </ThemeProvider>
  );
}
