import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Pusherをグローバルに設定
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo | null;
  }
}

window.Pusher = Pusher;

// 環境変数の取得と検証
const PUSHER_APP_KEY = import.meta.env.VITE_PUSHER_APP_KEY;
const PUSHER_APP_CLUSTER = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'ap3';

// Echo インスタンス（遅延初期化）
let echoInstance: Echo | null = null;

/**
 * Laravel Echo インスタンスを取得
 * 環境変数が設定されていない場合はnullを返す
 */
export const getEcho = (): Echo | null => {
  // すでに初期化済みの場合はそのまま返す
  if (echoInstance) {
    return echoInstance;
  }

  // 環境変数チェック
  if (!PUSHER_APP_KEY) {
    if (import.meta.env.DEV) {
      console.warn('[Echo] VITE_PUSHER_APP_KEY が設定されていません。リアルタイム機能は無効です。');
    }
    return null;
  }

  try {
    // Laravel Echo設定
    echoInstance = new Echo({
      broadcaster: 'pusher',
      key: PUSHER_APP_KEY,
      cluster: PUSHER_APP_CLUSTER,
      forceTLS: true,
      encrypted: true,
    });

    // グローバルに設定
    window.Echo = echoInstance;

    // 接続状態の監視（開発環境のみ）
    if (import.meta.env.DEV) {
      const pusher = (echoInstance as unknown as { connector: { pusher: Pusher } }).connector?.pusher;
      if (pusher) {
        pusher.connection.bind('connected', () => {
          console.info('[Echo] Pusher connected');
        });
        pusher.connection.bind('error', (err: unknown) => {
          console.error('[Echo] Pusher connection error:', err);
        });
        pusher.connection.bind('disconnected', () => {
          console.warn('[Echo] Pusher disconnected');
        });
      }
    }

    return echoInstance;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Echo] 初期化エラー:', error);
    }
    return null;
  }
};

/**
 * Echo接続が有効かどうかをチェック
 */
export const isEchoEnabled = (): boolean => {
  return !!PUSHER_APP_KEY;
};

/**
 * Echo接続を切断
 */
export const disconnectEcho = (): void => {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
    window.Echo = null;
  }
};

// デフォルトエクスポート（後方互換性のため）
const echo = getEcho();
export default echo;
