import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getEcho } from '@/lib/echo';
import { useAuctionLiveStore } from '@/stores/auctionLiveStore';

/**
 * WebSocket切断時の自動復旧フック
 *
 * 切断中はTanStack QueryがrefetchIntervalを使ってポーリングに自動フォールバック。
 * 再接続時にキャッシュを強制更新してUI状態を最新に同期する。
 */
export function useSocketReconnect(auctionId: number) {
  const queryClient = useQueryClient();
  const setSocketConnected = useAuctionLiveStore((s) => s.setSocketConnected);

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const pusher = (echo as any).connector?.pusher;
    if (!pusher) return;

    const onConnected = () => {
      setSocketConnected(true);
      // 再接続時は最新状態を強制取得
      queryClient.invalidateQueries({ queryKey: ['auction-live', auctionId] });
      queryClient.invalidateQueries({ queryKey: ['auction-won-items', auctionId] });
    };

    const onDisconnected = () => {
      setSocketConnected(false);
      // 切断後はTanStack QueryのrefetchIntervalが自動でポーリングを開始する
    };

    pusher.connection.bind('connected', onConnected);
    pusher.connection.bind('disconnected', onDisconnected);

    return () => {
      pusher.connection.unbind('connected', onConnected);
      pusher.connection.unbind('disconnected', onDisconnected);
    };
  }, [auctionId, queryClient, setSocketConnected]);
}
