import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo | null;
  }
}

window.Pusher = Pusher;

const REVERB_APP_KEY = import.meta.env.VITE_REVERB_APP_KEY;
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST;
const REVERB_PORT = import.meta.env.VITE_REVERB_PORT;
const REVERB_SCHEME = import.meta.env.VITE_REVERB_SCHEME || 'https';
const IS_DEV = import.meta.env.DEV;

let echoInstance: Echo | null = null;

/**
 * Laravel Echo インスタンスを取得（Reverb接続）
 * Reverb は Pusher プロトコル互換のため pusher-js をトランスポートとして使用
 *
 * 実装書 W1/W2: 120名同時接続向けの堅牢設定
 *   - activityTimeout / pongTimeout を明示（接続死活監視）
 *   - 切断検出時に jitter (0-3秒) を入れて再接続スパイクを分散
 *   - production では console.log 抑制（ブラウザのメモリ圧力対策）
 */
export const getEcho = (): Echo | null => {
  if (echoInstance) {
    return echoInstance;
  }

  if (!REVERB_APP_KEY) {
    if (IS_DEV) {
      console.warn('[Echo] VITE_REVERB_APP_KEY が設定されていません。リアルタイム機能は無効です。');
    }
    return null;
  }

  try {
    if (IS_DEV) {
      console.log('[Echo] Initializing Reverb connection:', REVERB_HOST, ':', REVERB_PORT);
    }

    echoInstance = new Echo({
      broadcaster: 'reverb',
      key: REVERB_APP_KEY,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT ?? 80,
      wssPort: REVERB_PORT ?? 443,
      forceTLS: REVERB_SCHEME === 'https',
      enabledTransports: ['ws', 'wss'],
      // 実装書 W1: 接続死活監視（120 名規模の robust 化）
      activityTimeout: 30_000,    // 30 秒無通信で ping 送信
      pongTimeout: 15_000,         // ping から 15 秒以内に pong が返らないと切断扱い
      unavailableTimeout: 10_000,  // 接続試行が 10 秒で「利用不可」判定
    } as any);

    window.Echo = echoInstance;

    const pusher = (echoInstance as unknown as { connector: { pusher: Pusher } }).connector?.pusher;
    if (pusher) {
      // 実装書 W2: 再接続時の jitter
      //   120 接続が同じタイミングで再接続するとサーバーに connection storm が起きる。
      //   切断検出時に 0〜3 秒のランダム遅延を入れて分散させる。
      pusher.connection.bind('disconnected', () => {
        if (IS_DEV) console.warn('[Echo] Reverb disconnected');
        const jitter = Math.floor(Math.random() * 3000);
        setTimeout(() => {
          try {
            const state = pusher.connection.state;
            if (state === 'disconnected' || state === 'failed' || state === 'unavailable') {
              pusher.connect();
            }
          } catch (e) {
            if (IS_DEV) console.error('[Echo] reconnect error:', e);
          }
        }, jitter);
      });

      pusher.connection.bind('connected', () => {
        if (IS_DEV) console.info('[Echo] Reverb connected successfully');
      });

      pusher.connection.bind('error', (err: unknown) => {
        // production でも error は CloudWatch 等で拾うため残す
        console.error('[Echo] Reverb connection error:', err);
      });

      pusher.connection.bind('state_change', (states: { current: string; previous: string }) => {
        if (IS_DEV) console.log('[Echo] Reverb state:', states.previous, '->', states.current);
      });
    }

    return echoInstance;
  } catch (error) {
    console.error('[Echo] 初期化エラー:', error);
    return null;
  }
};

export const isEchoEnabled = (): boolean => {
  return !!REVERB_APP_KEY;
};

export const disconnectEcho = (): void => {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
    window.Echo = null;
  }
};

const echo = getEcho();
export default echo;
