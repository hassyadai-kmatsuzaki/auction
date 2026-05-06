import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bidApi } from '@/api/participant/bidApi';
import { useAuctionLiveStore } from '@/stores/auctionLiveStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { LIVE_STATE_QUERY_KEY } from './useAuctionLive';
import type { LiveState } from '@/types';

/**
 * 単方向入札仕様: ON のリクエストだけを送信する。
 * 旧仕様の「もう一度押すと OFF（離脱）」動線は廃止。落札権利者・非権利者を問わず
 * ユーザー操作からは離脱できない。サーバー側でも `is_active=false` は 403 で拒否される。
 *
 * 負荷レビュー H1 対応:
 * - bidApi.toggle に AbortController.signal を渡し、連打や unmount で前リクエストを即キャンセル
 * - onSettled での無条件 invalidate は廃止。onError 時のみサーバーと再同期する
 *   （成功時の状態反映は WebSocket = BidderUpdated / PriceUpdated に任せる）
 *   → 240入札 × 全 observer refetch のカスケードを根絶
 */
export function useBidToggle(auctionId: number) {
  const queryClient = useQueryClient();
  const { lockBid, unlockBid, isBidLocked } = useAuctionLiveStore();
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);
  const abortControllerRef = useRef<AbortController | null>(null);

  // unmount 時には進行中のリクエストを必ずキャンセルしてリーク防止
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const mutation = useMutation({
    mutationFn: ({ itemId }: { itemId: number }) => {
      // 直前のリクエストが残っていたら破棄してから新しい AbortController を発行
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      return bidApi.toggle(itemId, true, controller.signal);
    },

    // 実装書 F12: retry: 0 でリトライ抑制
    //   旧: TanStack Query デフォルトの retry が走る → 120 名 × 失敗 × N 回 = サーバー連鎖過負荷
    //   新: 失敗したら 1 回で諦める。WebSocket イベントで状態は同期される
    retry: 0,

    // 楽観的更新: APIレスポンスを待たずに UI を 'active' に切り替える
    onMutate: async ({ itemId }) => {
      lockBid(itemId);
      await queryClient.cancelQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });

      const previousData = queryClient.getQueryData<LiveState>(
        LIVE_STATE_QUERY_KEY(auctionId)
      );

      queryClient.setQueryData<LiveState>(LIVE_STATE_QUERY_KEY(auctionId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lanes: prev.lanes.map((lane) =>
            lane.current_item?.id === itemId
              ? {
                  ...lane,
                  current_item: {
                    ...lane.current_item,
                    my_bid_status: 'active',
                  },
                }
              : lane
          ),
        };
      });

      return { previousData };
    },

    onSuccess: (result) => {
      if (result.success) {
        showSnackbar(result.message || '入札に参加しました', 'success');
      } else if (!result.silent) {
        showSnackbar(result.message || '入札に失敗しました', 'error');
      }
    },

    // 失敗時: 楽観的更新をロールバック ＋ サーバーと再同期（invalidate）
    onError: (err: any, variables, context) => {
      // axios.isCancel 相当: AbortController による中断はユーザーには通知しない
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return;
      }
      if (context?.previousData) {
        queryClient.setQueryData(LIVE_STATE_QUERY_KEY(auctionId), context.previousData);
      }
      // silent=true: サーバー再検証で正常に弾かれた競合（pre_bid/freeze/価格不一致/他者権利者）。
      //   ユーザー誤操作ではないのでトースト出さず、invalidate もしない（WS イベントで UI 同期）。
      const silent = err?.response?.data?.silent === true;
      if (!silent) {
        showSnackbar(
          err?.response?.data?.message || '入札に失敗しました',
          'error'
        );
        // 失敗時のみサーバーと再同期（成功時は WS 経由で更新されるので不要）
        queryClient.invalidateQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });
      }
    },

    // 成功・失敗どちらでも lock は解除する。ただし invalidate は onError 限定（負荷削減）
    onSettled: (_data, _err, variables) => {
      unlockBid(variables.itemId);
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current = null;
      }
    },
  });

  // 旧 API 互換: BidButton から呼ばれる関数名は `toggle` のまま残すが、
  // 動作は単方向（ON のみ送信）。既に自分が active なら no-op。
  const toggle = (itemId: number, currentStatus: 'active' | 'inactive' | null) => {
    if (isBidLocked(itemId)) return;
    if (currentStatus === 'active') return;
    mutation.mutate({ itemId });
  };

  return {
    toggle,
    isPending: mutation.isPending,
    isLocked: isBidLocked,
  };
}
