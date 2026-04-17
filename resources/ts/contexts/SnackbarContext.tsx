import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

type SnackbarState = {
  open: boolean;
  message: string;
  severity: AlertColor;
  autoHideDuration: number;
};

type SnackbarContextValue = {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

type ExternalNotifier = (message: string, severity: AlertColor) => void;
let externalNotifier: ExternalNotifier | null = null;

export const notifyFromOutsideReact: ExternalNotifier = (message, severity) => {
  if (externalNotifier) {
    externalNotifier(message, severity);
  }
};

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'error',
    autoHideDuration: 6000,
  });

  const show = useCallback((message: string, severity: AlertColor, duration = 6000) => {
    setState({ open: true, message, severity, autoHideDuration: duration });
  }, []);

  const handleClose = useCallback((_?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  externalNotifier = (message, severity) => show(message, severity);

  const value = useMemo<SnackbarContextValue>(
    () => ({
      showError:   (m) => show(m, 'error', 6000),
      showSuccess: (m) => show(m, 'success', 4000),
      showInfo:    (m) => show(m, 'info', 4000),
      showWarning: (m) => show(m, 'warning', 5000),
    }),
    [show]
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={state.autoHideDuration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={state.severity}
          variant="filled"
          sx={{ width: '100%', whiteSpace: 'pre-line' }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }
  return ctx;
}
