import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from '../lib/axios';
import type { Role, User } from '../types';

// 認証済みユーザー型（rolesが必須）
interface AuthUser extends Omit<User, 'roles'> {
  roles: Role[];
}

export interface LoginResult {
  twoFactorRequired?: boolean;
  userId?: number;
  /** サーバが ALREADY_LOGGED_IN を返した場合に true（呼び出し側で確認モーダルを出す） */
  alreadyLoggedIn?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, opts?: { forceLogoutOthers?: boolean }) => Promise<LoginResult | void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初回ロード時に認証状態を確認
    checkAuth();
  }, []);

  // ログイン中は /api/auth/me を 60 秒ごとにポーリングし、他端末ログインで強制ログアウトされた場合に
  // 速やかにログイン画面へ遷移させる（401 で axios インターセプタがリダイレクトする）
  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      axios
        .get('/api/auth/me', { silent: true })
        .catch(() => {
          // 401 はインターセプタが処理する。それ以外は無視（ネットワーク断など）
        });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      setLoading(false);
      return;
    }

    // Axiosのデフォルトヘッダーにトークンを設定
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.data.user);
    } catch (error) {
      // トークンが無効な場合はクリア
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string,
    opts?: { forceLogoutOthers?: boolean }
  ): Promise<LoginResult | void> => {
    try {
      const response = await axios.post(
        '/api/auth/login',
        {
          email,
          password,
          force_logout_others: opts?.forceLogoutOthers === true,
        },
        // 409 ALREADY_LOGGED_IN は呼び出し側で扱うので snackbar を抑制する
        { silent: true }
      );

      const data = response.data.data;

      // 2FA が必要な場合
      if (data.two_factor_required) {
        return { twoFactorRequired: true, userId: data.user_id };
      }

      const { token, user: userData } = data;

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setUser(userData);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string; data?: { user_id?: number } } } };
      if (e?.response?.status === 409 && e.response.data?.code === 'ALREADY_LOGGED_IN') {
        return { alreadyLoggedIn: true, userId: e.response.data.data?.user_id };
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    }
  };

  const hasRole = (roleName: string): boolean => {
    return user?.roles.some(role => role.name === roleName) || false;
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const response = await axios.get('/api/auth/me');
      const fresh = response.data.data.user;
      setUser(fresh);
      localStorage.setItem('user', JSON.stringify(fresh));
    } catch {
      // 失敗時は既存 state を維持
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
