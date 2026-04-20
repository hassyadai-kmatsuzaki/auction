import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from '../lib/axios';
import type { Role, User } from '../types';

// 認証済みユーザー型（rolesが必須）
interface AuthUser extends Omit<User, 'roles'> {
  roles: Role[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ twoFactorRequired?: boolean; userId?: number } | void>;
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

  const login = async (email: string, password: string): Promise<{ twoFactorRequired?: boolean; userId?: number } | void> => {
    const response = await axios.post('/api/auth/login', {
      email,
      password,
    });

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
