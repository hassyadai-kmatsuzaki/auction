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

// ─── 通信エラー（インフラ起因・全ユーザー同時に起きうる）判定 ─────────────
//
// ネットワーク未達・タイムアウト・5xx は、デプロイ・worker 再起動・Reverb 全断・
// 一時的な混雑などで「全クライアントが同時に」発生しうる。これらの背景 GET 失敗で
// 全員に通信エラートーストが一斉表示され困惑させた事故があったため、GET の通信エラーは
// トーストせずログのみ残す（呼び出し側の reject ハンドリングは従来どおり維持）。
// 4xx の actionable なエラー（403/404/409/419/422 等）は分類外＝従来どおりトーストする。
export function isCommunicationError(error: AxiosError): boolean {
  if (!error.response) return true;                    // サーバー未達（瞬断/中断/CORS）
  if (error.code === 'ERR_NETWORK') return true;       // 電波・Wi-Fi 切れ
  if (error.code === 'ECONNABORTED') return true;      // タイムアウト
  const status = error.response.status;
  if (status >= 500) return true;                      // 5xx（デプロイ/再起動/混雑/DB 一時障害）
  if (status === 408 || status === 429) return true;   // タイムアウト/レート制限
  return false;
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
    // AbortController による中断（入札連打・unmount 等）はユーザー通知もログも不要。
    // ※ 早期 return しないと CanceledError が fallback トースト「通信エラー…」を誤発火する。
    if (error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

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

    // 全ユーザーに同時発生しうる通信エラー（背景 GET の一斉失敗＝Reverb 全断時の
    // 5秒ポーリング／商品切替ごとの再取得波／再接続時の won-items invalidate 等）は、
    // トーストを出さずログのみ残す。前回「全員に同じタイミングで通信エラー」事故の恒久対策。
    // 書き込み（POST/PUT/DELETE 等）は従来どおりトーストしてフィードバックを残す（GET 限定）。
    const method = (error.config?.method ?? 'get').toLowerCase();
    if (method === 'get' && isCommunicationError(error)) {
      console.error('[api] communication error on GET (toast suppressed)', {
        url: error.config?.url,
        code: error.code,
        status,
      });
      return Promise.reject(error);
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
