import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Axiosインスタンスを作成
const api = axios.create({
  baseURL: '',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // リクエスト時にトークンを動的に設定
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // 認証エラー（401）の場合
    if (error.response?.status === 401) {
      // 現在のパスがログインページでない場合のみリダイレクト
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && !currentPath.startsWith('/auth/')) {
        // トークンをクリア
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        // ログインページへリダイレクト
        window.location.href = '/login';
      }
    }
    
    // 権限エラー（403）の場合
    if (error.response?.status === 403) {
      // 必要に応じてエラー処理
    }
    
    // サーバーエラー（500系）の場合
    if (error.response?.status && error.response.status >= 500) {
      // 必要に応じてエラーログ送信等
    }
    
    return Promise.reject(error);
  }
);

// トークン設定用のユーティリティ関数
export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

// トークン削除用のユーティリティ関数
export const clearAuthToken = (): void => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
};

export default api;
