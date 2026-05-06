import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { notifyFromOutsideReact } from '../contexts/SnackbarContext';

// 独自の axios リクエストオプション。silent=true で response interceptor の snackbar を抑制する。
declare module 'axios' {
  interface AxiosRequestConfig {
    silent?: boolean;
  }
  interface InternalAxiosRequestConfig {
    silent?: boolean;
  }
}

type ApiErrorBody = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'リクエストに問題があります。内容をご確認ください。',
  401: 'ログインが必要です。再度ログインしてください。',
  403: 'この操作を行う権限がありません。',
  404: '対象のデータが見つかりませんでした。',
  405: '許可されていない操作です。',
  408: 'タイムアウトしました。通信状況をご確認のうえ再度お試しください。',
  409: '競合が発生しました。画面を更新してから再度お試しください。',
  413: 'ファイルサイズが大きすぎます。上限を超えない画像・動画を選択してください。',
  419: 'セッションが切れました。再度ログインしてください。',
  422: '入力内容に誤りがあります。ご確認ください。',
  429: 'リクエストが多すぎます。しばらく待ってから再度お試しください。',
  500: 'サーバーエラーが発生しました。時間をおいて再度お試しください。',
  502: 'サーバーに接続できませんでした。時間をおいて再度お試しください。',
  503: 'ただいまメンテナンス中、または混雑しています。時間をおいて再度お試しください。',
  504: 'サーバーの応答がありません。時間をおいて再度お試しください。',
};

export function resolveErrorMessage(error: AxiosError): string {
  if (error.code === 'ERR_NETWORK') {
    return 'ネットワークに接続できませんでした。通信状況をご確認ください。';
  }
  if (error.code === 'ECONNABORTED') {
    return 'タイムアウトしました。通信状況をご確認のうえ再度お試しください。';
  }

  const status = error.response?.status;
  const data = error.response?.data as ApiErrorBody | undefined;

  if (data?.message && typeof data.message === 'string') {
    return data.message;
  }

  if (data?.errors) {
    const first = Object.values(data.errors).flat().find((v) => typeof v === 'string');
    if (first) return first;
  }

  if (status && STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status];
  }

  return 'エラーが発生しました。時間をおいて再度お試しください。';
}

const api = axios.create({
  baseURL: '',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    // silent はリクエスト側オプション（config.silent）と
    // サーバー応答ボディ（response.data.silent）の両方を尊重する。
    // 後者は BidResultDto::failure(..., silent: true) のように
    // サーバー側が「正常な競合なのでトーストを出さないでほしい」と返してくるケース。
    const configSilent = (error.config as InternalAxiosRequestConfig & { silent?: boolean })?.silent === true;
    const responseSilent = (error.response?.data as { silent?: boolean } | undefined)?.silent === true;
    const silent = configSilent || responseSilent;

    if (status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && !currentPath.startsWith('/auth/')) {
        const hadToken = !!localStorage.getItem('auth_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        // 「ログイン済みだったのに 401」= 他端末で奪われたケースが多いので reason を付けてバナー表示する
        const target = hadToken ? '/login?reason=session_expired' : '/login';
        if (!hadToken) {
          notifyFromOutsideReact('ログインが必要です。再度ログインしてください。', 'warning');
        }
        window.location.href = target;
        return Promise.reject(error);
      }
    }

    if (!silent) {
      notifyFromOutsideReact(resolveErrorMessage(error), 'error');
    }

    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const clearAuthToken = (): void => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
};

export default api;
