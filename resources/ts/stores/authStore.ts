import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  roles?: { name: string; display_name: string }[];
}

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  clearUser: () => void;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isAuthenticated: false,

        setUser: (user) =>
          set({ user, isAuthenticated: !!user }, false, 'setUser'),

        clearUser: () =>
          set({ user: null, isAuthenticated: false }, false, 'clearUser'),

        hasRole: (role) =>
          get().user?.roles?.some((r) => r.name === role) ?? false,
      }),
      { name: 'auth-storage' }
    ),
    { name: 'AuthStore' }
  )
);
