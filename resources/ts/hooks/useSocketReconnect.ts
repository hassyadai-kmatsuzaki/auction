import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getEcho } from '@/lib/echo';
import { useAuctionLiveStore } from '@/stores/auctionLiveStore';

/**
 * WebSocket切断時の自動復旧フック
 *
 * 切断中はTanStack QueryがrefetchIntervalを使ってポーリングに自動フォールバック。
 * 再接続時にキャッシュを強制更新してUI状態を最新に同期する。
 *
 * 実装書 W4: 120 名同時再接続のスパイク回避
 *   - 再接続時の invalidateQueries に jitter (0-2秒) を付与
 *   - これがないと 120 名が一斉に refetch して PHP-FPM 飽和
 *
 * 実装書 W5: 「unavailable」「failed」も切断扱い
 *   - 旧: 'disconnected' のみで切断検知
 *   - 新: state_change で robust に検知
 */
export function useSocketReconnect(auctionId: number) {
  const queryClient = useQueryClient();
  const setSocketConnected = useAuctionLiveStore((s) => s.setSocketConnected);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const pusher = (echo as any).connector?.pusher;
    if (!pusher) return;

    const onConnected = () => {
      setSocketConnected(true);
      // 実装書 W4: 120 名一斉 refetch のスパイク回避のため jitter を入れる
      const jitter = Math.floor(Math.random() * 2000); // 0-2 秒
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['auction-live', auctionId] });
        queryClient.invalidateQueries({ queryKey: ['auction-won-items', auctionId] });
      }, jitter);
    };

    const onDisconnected = () => {
      setSocketConnected(false);
      // 切断後は useAuctionLive の refetchInterval が自動でポーリングを開始する
    };

    // 実装書 W5: state_change で connected/disconnected 系を robust に検知
    const onStateChange = (states: { current: string; previous: string }) => {
      if (states.current === 'connected') {
        setSocketConnected(true);
      } else if (
        states.current === 'disconnected' ||
        states.current === 'unavailable' ||
        states.current === 'failed'
      ) {
        setSocketConnected(false);
      }
    };

    pusher.connection.bind('connected', onConnected);
    pusher.connection.bind('disconnected', onDisconnected);
    pusher.connection.bind('state_change', onStateChange);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      pusher.connection.unbind('connected', onConnected);
      pusher.connection.unbind('disconnected', onDisconnected);
      pusher.connection.unbind('state_change', onStateChange);
    };
  }, [auctionId, queryClient, setSocketConnected]);
}
