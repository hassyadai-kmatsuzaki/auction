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

// ─── ユーザー向けエラーメッセージ ─────────────────────────────────────────
//
// 文言ポリシー:
//   1. 「エラー」「サーバー」のような技術用語は最低限にする
//   2. 全て「お試しください」で締めて操作指示を明確にする（連打抑止）
//   3. 「画面を更新」は更新で改善が見込めるケースのみ案内する。
//      電波切れや権限/入力エラー時に更新を促すのは逆効果（直らないのに何度も refresh を誘発する）
//   4. 5xx 系は「混雑」表現に統一（worker 再起動・OPcache・DB 一時障害など実態は混雑が近い）
//      ただし真のサーバーエラーが Sentry 等で検知できる体制が前提
const STATUS_MESSAGES: Record<number, string> = {
  400: 'リクエストに問題があります。内容をご確認ください。',
  401: 'ログインが必要です。再度ログインしてください。',
  403: 'この操作を行う権限がありません。',
  404: '対象のデータが見つかりませんでした。画面を更新してご確認ください。',
  405: '許可されていない操作です。',
  408: '通信に時間がかかっています。電波状況をご確認のうえ、もう一度お試しください。',
  409: '操作が競合しました。画面を更新してから、もう一度お試しください。',
  413: 'ファイルサイズが大きすぎます。上限を超えない画像・動画を選択してください。',
  419: 'セッションが切れました。画面を更新するか、再度ログインしてください。',
  422: '入力内容に誤りがあります。ご確認ください。',
  429: '操作が多すぎます。少し時間をおいてからお試しください。',
  500: '回線が混み合っています。少し時間をおいてから画面を更新してお試しください。',
  502: '回線が混み合っています。少し時間をおいてから画面を更新してお試しください。',
  503: '回線が混み合っています。少し時間をおいてから画面を更新してお試しください。',
  504: '回線が混み合っています。少し時間をおいてから画面を更新してお試しください。',
};

export function resolveErrorMessage(error: AxiosError): string {
  // 通信そのものが届いていない: 電波/Wi-Fi 切れの可能性が高いので画面更新は案内しない
  if (error.code === 'ERR_NETWORK') {
    return '電波状況が不安定です。通信環境をご確認のうえ、もう一度お試しください。';
  }
  if (error.code === 'ECONNABORTED') {
    return '通信に時間がかかっています。電波状況をご確認のうえ、もう一度お試しください。';
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

  // fallback: 何が起きているか特定できないケースの最終逃げ道。
  // 画面更新の選択肢を必ず併記して、デプロイ直後の旧 JS / WS死亡 / キャッシュ食い違い等を救う。
  return '通信エラーが発生しました。画面を更新するか、時間をおいてもう一度お試しください。';
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
