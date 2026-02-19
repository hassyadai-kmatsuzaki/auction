import { create } from 'zustand';

export type SnackbarSeverity = 'success' | 'error' | 'warning' | 'info';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: SnackbarSeverity;
}

interface NotificationStore {
  snackbar: SnackbarState;
  showSnackbar: (message: string, severity?: SnackbarSeverity) => void;
  hideSnackbar: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  snackbar: { open: false, message: '', severity: 'success' },

  showSnackbar: (message, severity = 'success') =>
    set({ snackbar: { open: true, message, severity } }),

  hideSnackbar: () =>
    set((s) => ({ snackbar: { ...s.snackbar, open: false } })),
}));
