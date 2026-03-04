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

let echoInstance: Echo | null = null;

/**
 * Laravel Echo インスタンスを取得（Reverb接続）
 * Reverb は Pusher プロトコル互換のため pusher-js をトランスポートとして使用
 */
export const getEcho = (): Echo | null => {
  if (echoInstance) {
    return echoInstance;
  }

  if (!REVERB_APP_KEY) {
    if (import.meta.env.DEV) {
      console.warn('[Echo] VITE_REVERB_APP_KEY が設定されていません。リアルタイム機能は無効です。');
    }
    return null;
  }

  try {
    console.log('[Echo] Initializing Reverb connection:', REVERB_HOST, ':', REVERB_PORT);

    echoInstance = new Echo({
      broadcaster: 'reverb',
      key: REVERB_APP_KEY,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT ?? 80,
      wssPort: REVERB_PORT ?? 443,
      forceTLS: REVERB_SCHEME === 'https',
      enabledTransports: ['ws', 'wss'],
    });

    window.Echo = echoInstance;

    const pusher = (echoInstance as unknown as { connector: { pusher: Pusher } }).connector?.pusher;
    if (pusher) {
      pusher.connection.bind('connected', () => {
        console.info('[Echo] Reverb connected successfully');
      });
      pusher.connection.bind('error', (err: unknown) => {
        console.error('[Echo] Reverb connection error:', err);
      });
      pusher.connection.bind('disconnected', () => {
        console.warn('[Echo] Reverb disconnected');
      });
      pusher.connection.bind('state_change', (states: { current: string; previous: string }) => {
        console.log('[Echo] Reverb state:', states.previous, '->', states.current);
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
